import { StrictMode } from 'react';
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAutosavedDraft } from '../src/content-studio/persistence/useAutosavedDraft.js';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const draft = (revision = 4, title = 'Original') => ({ contentId: 'draft-1', documentId: 'draft-1', draftRevision: revision, content: { title } });
const setup = (repository) => renderHook(() => useAutosavedDraft({
  routeId: 'draft-1', createDraft: () => draft(), repository, readOnly: false, onDirtyChange: () => {},
}));
const edit = (result, title) => act(() => result.current.edit((current) => ({ ...current, content: { title } })));
const tick = async () => act(async () => { await vi.advanceTimersByTimeAsync(650); });
const settle = async (pending, value) => act(async () => { pending.resolve(value); await pending.promise; });

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Admin Course/Practice/Challenge/Project draft autosave', () => {
  it('uses each authoritative server revision for sequential saves', async () => {
    vi.useFakeTimers();
    const repository = { load: vi.fn().mockResolvedValue(draft()), save: vi.fn()
      .mockResolvedValueOnce(draft(5, 'First')).mockResolvedValueOnce(draft(6, 'Second')) };
    const { result } = setup(repository);
    await act(async () => {});
    edit(result, 'First'); await tick();
    expect(repository.save).toHaveBeenNthCalledWith(1, expect.objectContaining({ draftRevision: 4 }), 4);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(repository.save).toHaveBeenCalledTimes(1);
    edit(result, 'Second'); await tick();
    expect(repository.save).toHaveBeenNthCalledWith(2, expect.objectContaining({ draftRevision: 5 }), 5);
    expect(result.current.draft).toEqual(draft(6, 'Second'));
    expect(result.current.dirty).toBe(false);
  });

  it('retains edits during an in-flight save and coalesces follow-up edits without parallel writes', async () => {
    vi.useFakeTimers();
    const first = deferred(); const second = deferred();
    let active = 0; let maximum = 0;
    const repository = { load: vi.fn().mockResolvedValue(draft()), save: vi.fn((_snapshot, revision) => {
      active += 1; maximum = Math.max(maximum, active);
      return (revision === 4 ? first : second).promise.finally(() => { active -= 1; });
    }) };
    const { result } = setup(repository);
    await act(async () => {});
    edit(result, 'First'); await tick();
    edit(result, 'Second'); edit(result, 'Final'); await tick();
    expect(repository.save).toHaveBeenCalledTimes(1);
    await settle(first, draft(5, 'First'));
    expect(result.current.draft).toEqual(draft(5, 'Final'));
    await tick();
    expect(repository.save).toHaveBeenNthCalledWith(2, draft(5, 'Final'), 5);
    await settle(second, draft(6, 'Final'));
    expect(maximum).toBe(1);
    expect(result.current.dirty).toBe(false);
  });

  it('latches a genuine conflict and never retries until reload', async () => {
    vi.useFakeTimers();
    const conflict = Object.assign(new Error('This draft was updated elsewhere. Reload the latest version before saving.'), { code: 'content/draft-conflict' });
    const repository = { load: vi.fn().mockResolvedValue(draft()), save: vi.fn().mockRejectedValue(conflict) };
    const { result } = setup(repository);
    await act(async () => {});
    edit(result, 'First'); await tick();
    expect(result.current.saveError).toMatch(/updated elsewhere/);
    edit(result, 'Second'); await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(result.current.draft.content.title).toBe('Second');
    repository.load.mockResolvedValueOnce(draft(5, 'Remote'));
    await act(async () => { await result.current.reload(); });
    expect(result.current.saveError).toBe('');
    edit(result, 'After reload'); await tick();
    expect(repository.save).toHaveBeenCalledTimes(2);
    expect(repository.save).toHaveBeenLastCalledWith(draft(5, 'After reload'), 5);
  });

  it('ignores an older response after reload starts and reads the latest revision', async () => {
    vi.useFakeTimers();
    const first = deferred();
    const repository = { load: vi.fn().mockResolvedValueOnce(draft(4)).mockResolvedValueOnce(draft(6, 'Remote')), save: vi.fn().mockReturnValue(first.promise) };
    const { result } = setup(repository);
    await act(async () => {});
    edit(result, 'Local'); await tick();
    let reloading;
    act(() => { reloading = result.current.reload(); });
    await settle(first, draft(5, 'Local'));
    await act(async () => { await reloading; });
    expect(result.current.draft).toEqual(draft(6, 'Remote'));
    expect(result.current.dirty).toBe(false);
  });

  it('does not save an edited placeholder before its existing revision loads', async () => {
    vi.useFakeTimers();
    const loading = deferred();
    const repository = { load: vi.fn().mockReturnValue(loading.promise), save: vi.fn() };
    const { result } = setup(repository);
    edit(result, 'Early local edit');
    await tick();
    expect(repository.save).not.toHaveBeenCalled();
    await settle(loading, draft(9, 'Remote content'));
    expect(result.current.saveError).toMatch(/finished loading after editing began/);
    expect(result.current.draft.content.title).toBe('Early local edit');
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('does not duplicate saves under React StrictMode effect replay', async () => {
    vi.useFakeTimers();
    const repository = { load: vi.fn().mockResolvedValue(draft()), save: vi.fn().mockResolvedValue(draft(5, 'Strict')) };
    const { result } = renderHook(() => useAutosavedDraft({
      routeId: 'draft-1', createDraft: () => draft(), repository, readOnly: false, onDirtyChange: () => {},
    }), { wrapper: StrictMode });
    await act(async () => {});
    edit(result, 'Strict'); await tick();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(result.current.draft.draftRevision).toBe(5);
  });
});
