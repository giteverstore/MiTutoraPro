import React, { useReducer } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalDraftRepository } from '../src/content-studio/persistence/DraftRepository.js';
import { useDraftAutosave } from '../src/content-studio/persistence/useDraftAutosave.js';
import { createEmptyEditorDocument } from '../src/content-studio/serialization/editorSerialization.js';
import { createEditorState, editorReducer } from '../src/content-studio/state/editorState.js';

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('structured content draft persistence', () => {
  it('round-trips a draft through the repository abstraction', async () => {
    const values = new Map();
    const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    const repository = new LocalDraftRepository(storage, 'test-drafts');
    const document = { ...createEmptyEditorDocument(), title: 'Recovered draft' };
    await repository.save(document);
    expect(await repository.load(document.documentId)).toEqual(document);
    expect(await repository.load('new-route-generated-id')).toEqual(document);
  });

  it('debounces successful saves and reports completion', async () => {
    vi.useFakeTimers();
    const repository = { save: vi.fn().mockResolvedValue({ savedAt: 'now' }) };
    const document = createEmptyEditorDocument();
    const { result } = renderHook(() => {
      const [state, dispatch] = useReducer(editorReducer, createEditorState(document));
      useDraftAutosave({ state, dispatch, repository, delay: 40 });
      return { state, dispatch };
    });
    act(() => result.current.dispatch({ type: 'metadata', patch: { title: 'Autosaved' } }));
    expect(repository.save).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(40); });
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(result.current.state).toMatchObject({ dirty: false, saveState: 'saved' });
  });

  it('keeps a failed draft dirty and exposes the failure state', async () => {
    vi.useFakeTimers();
    const repository = { save: vi.fn().mockRejectedValue(new Error('storage unavailable')) };
    const document = createEmptyEditorDocument();
    const { result } = renderHook(() => {
      const [state, dispatch] = useReducer(editorReducer, createEditorState(document));
      useDraftAutosave({ state, dispatch, repository, delay: 20 });
      return { state, dispatch };
    });
    act(() => result.current.dispatch({ type: 'metadata', patch: { title: 'Still local' } }));
    await act(async () => { await vi.advanceTimersByTimeAsync(20); });
    expect(result.current.state).toMatchObject({ dirty: true, saveState: 'failed' });
  });
});
