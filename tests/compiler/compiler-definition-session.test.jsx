import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCompilerDefinitionSession } from '../../src/compiler/useCompilerDefinitionSession.js';

const python = { id: 'python', language: 'python', editor: { fileName: 'main.py', lines: [{ text: 'print(1)' }] } };
const java = { id: 'java', language: 'java', editor: { fileName: 'Main.java', lines: [{ text: 'class Main {}' }] } };

function setup() {
  const execution = { reset: vi.fn(), clear: vi.fn(), cancel: vi.fn() };
  const executionActionsRef = { current: execution };
  const onSourceChanged = vi.fn();
  return { execution, onSourceChanged, ...renderHook(() => useCompilerDefinitionSession({ initialCompiler: python, compilerManager: { reset: vi.fn() }, instanceId: 'test', executionActionsRef, onSourceChanged })) };
}

describe('useCompilerDefinitionSession', () => {
  it('keeps dirty source when replacement is cancelled', async () => {
    const { result } = setup();
    act(() => result.current.handleCodeChange('edited'));
    let loading;
    act(() => { loading = result.current.loadDefinition(java); });
    expect(result.current.replaceConfirmation).not.toBeNull();
    act(() => result.current.resolveReplaceConfirmation(false));
    await expect(loading).resolves.toBe(false);
    expect(result.current.code).toBe('edited');
    expect(result.current.activeCompiler).toBe(python);
  });

  it('replaces dirty source only after explicit acceptance', async () => {
    const { result, execution } = setup();
    act(() => result.current.handleCodeChange('edited'));
    let loading;
    act(() => { loading = result.current.loadDefinition(java); });
    let loaded;
    await act(async () => {
      result.current.resolveReplaceConfirmation(true);
      loaded = await loading;
    });
    expect(loaded).toBe(true);
    expect(result.current.code).toBe('class Main {}');
    expect(result.current.activeCompiler).toBe(java);
    expect(result.current.isDirty()).toBe(false);
    expect(execution.cancel).toHaveBeenCalledOnce();
    expect(execution.clear).toHaveBeenCalledWith(java);
  });
});
