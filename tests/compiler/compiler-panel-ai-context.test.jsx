import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CompilerProvider } from '../../src/compiler/CompilerProvider.jsx';
import { CompilerPanel } from '../../src/components/CompilerPanel.jsx';

vi.mock('../../src/components/EditorPlaceholder.jsx', () => ({
  EditorPlaceholder: ({ value, onChange, onSelectionChange, onAskSelection }) => (
    <div>
      <textarea aria-label="Code editor" value={value} onChange={(event) => onChange(event.target.value)} />
      <button type="button" onClick={() => onSelectionChange({ text: 'print', source: value, startOffset: 0, endOffset: 5 })}>Select code</button>
      <button type="button" onClick={() => onAskSelection?.({ text: 'print', source: value, startOffset: 0, endOffset: 5, startLine: 1, endLine: 1, surroundingCode: value })}>Ask selection</button>
    </div>
  ),
}));

afterEach(cleanup);

const compiler = {
  id: 'python', language: 'python', resizeLabel: 'Resize output', stdin: '', expectedOutput: 'done',
  editor: { fileName: 'main.py', lines: [{ text: 'print("done")' }] }, output: {},
};
const manager = () => ({
  execute: vi.fn().mockResolvedValue({ status: 'success', output: 'done', errors: [], executionTimeMs: 2 }),
  format: vi.fn(), reset: vi.fn().mockResolvedValue(), validateOutput: vi.fn(), dispose: vi.fn(),
});

describe('CompilerPanel definition and AI context', () => {
  it('loads and executes an imperative example end to end', async () => {
    const compilerManager = manager();
    const panelRef = React.createRef();
    HTMLElement.prototype.scrollIntoView = vi.fn();
    render(<CompilerProvider manager={compilerManager}><CompilerPanel ref={panelRef} compiler={compiler} /></CompilerProvider>);
    await expect(act(() => panelRef.current.loadExample({ source: 'console.log(1)', language: 'javascript', filename: 'main.js' }))).resolves.toBe(true);
    expect(screen.getByRole('textbox', { name: 'Code editor' })).toHaveValue('console.log(1)');
    expect(compilerManager.execute).toHaveBeenCalledWith(expect.objectContaining({ source: 'console.log(1)', language: 'javascript', filename: 'main.js' }));
  });

  it('publishes an exact immutable Ask AI selection snapshot', async () => {
    const onAskAITutor = vi.fn();
    render(<CompilerProvider manager={manager()}><CompilerPanel compiler={compiler} aiEnabled onAskAITutor={onAskAITutor} /></CompilerProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Ask selection' }));
    await waitFor(() => expect(onAskAITutor).toHaveBeenCalledOnce());
    expect(onAskAITutor).toHaveBeenCalledWith(expect.objectContaining({
      code: 'print("done")', language: 'python', fileName: 'main.py',
      selectionContext: { text: 'print', snapshot: expect.objectContaining({ text: 'print', startOffset: 0, endOffset: 5, startLine: 1, endLine: 1, surroundingCode: 'print("done")', language: 'python', sourceHash: expect.stringMatching(/^[a-f0-9]{64}$/), selectionHash: expect.stringMatching(/^[a-f0-9]{64}$/) }) },
    }));
  });

  it('rejects a stale async selection after the source changes', async () => {
    const onContextChange = vi.fn();
    render(<CompilerProvider manager={manager()}><CompilerPanel compiler={compiler} onContextChange={onContextChange} /></CompilerProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Select code' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Code editor' }), { target: { value: 'changed' } });
    await waitFor(() => expect(onContextChange).toHaveBeenLastCalledWith(expect.objectContaining({ code: 'changed', selectionSnapshot: null })));
  });

  it('publishes context across edit, run, and reset', async () => {
    const onContextChange = vi.fn();
    render(<CompilerProvider manager={manager()}><CompilerPanel compiler={compiler} onContextChange={onContextChange} /></CompilerProvider>);
    fireEvent.change(screen.getByRole('textbox', { name: 'Code editor' }), { target: { value: 'print("edited")' } });
    await waitFor(() => expect(onContextChange).toHaveBeenLastCalledWith(expect.objectContaining({ code: 'print("edited")', compilerStatus: 'idle' })));
    fireEvent.click(screen.getByRole('button', { name: 'Run code' }));
    await waitFor(() => expect(onContextChange).toHaveBeenCalledWith(expect.objectContaining({ compilerStatus: 'success', compilerEvidence: expect.objectContaining({ output: 'done' }) })));
    fireEvent.click(screen.getByRole('button', { name: 'Reset code' }));
    await waitFor(() => expect(onContextChange).toHaveBeenLastCalledWith(expect.objectContaining({ code: 'print("done")', compilerStatus: 'idle', compilerEvidence: null })));
  });
});
