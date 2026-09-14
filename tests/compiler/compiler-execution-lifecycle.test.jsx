import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CompilerProvider } from '../../src/compiler/CompilerProvider.jsx';
import { CompilerPanel } from '../../src/components/CompilerPanel.jsx';

vi.mock('../../src/components/EditorPlaceholder.jsx', () => ({
  EditorPlaceholder: ({ value, onChange }) => <textarea aria-label="Code editor" value={value} onChange={(event) => onChange(event.target.value)} />,
}));
vi.mock('../../src/components/CompilerWorkspace.jsx', () => ({
  CompilerWorkspace: ({ editor }) => <div>{editor}</div>,
}));
vi.mock('../../src/ai/AITutorPanel.jsx', () => ({ AITutorPanel: () => null }));

afterEach(cleanup);

const compiler = {
  id: 'course-python',
  language: 'python',
  resizeLabel: 'Resize compiler output',
  editor: { fileName: 'main.py', lines: [{ number: 1, text: 'print("Hello there")' }] },
  output: {},
  expectedOutput: 'Hello there',
};

describe('shared compiler execution lifecycle', () => {
  it.each([
    ['Course', 'lesson', null],
    ['Practice', 'practice', <label>Language<select aria-label="Compiler language"><option>Python</option></select></label>],
    ['Challenge', 'challenge', <label>Language<select aria-label="Compiler language"><option>Python</option></select></label>],
  ])('does not abort an active %s run when opening the drawer rerenders CompilerPanel', async (_name, activityType, languageSelector) => {
    const execute = vi.fn(({ signal }) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve({
        status: 'success', output: 'Hello there', errors: [], executionTimeMs: 7,
      }), 20);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Execution cancelled.', 'AbortError'));
      }, { once: true });
    }));
    const manager = { execute, format: vi.fn(), reset: vi.fn(), validateOutput: vi.fn(), dispose: vi.fn() };

    render(<CompilerProvider manager={manager}><CompilerPanel compiler={compiler} activityType={activityType} languageSelector={languageSelector} /></CompilerProvider>);
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Run code' }));

    expect(await screen.findByText('Executing program…')).toBeVisible();
    expect(await screen.findByText('Hello there')).toBeVisible();
    await waitFor(() => expect(screen.getAllByText('Completed').some((node) => node.classList.contains('ide-status-dot'))).toBe(true));
    expect(execute).toHaveBeenCalledOnce();
    expect(execute.mock.calls[0][0].signal.aborted).toBe(false);
    expect(screen.getByRole('button', { name: 'Check Output' })).toBeEnabled();
  });

  it('invalidates a successful result after a source edit and enables verification again after a repeated successful run', async () => {
    const manager = {
      execute: vi.fn().mockResolvedValue({ status: 'success', output: 'Hello there', errors: [], executionTimeMs: 7 }),
      format: vi.fn(), reset: vi.fn(), validateOutput: vi.fn(() => true), dispose: vi.fn(),
    };
    render(<CompilerProvider manager={manager}><CompilerPanel compiler={compiler} activityType="practice" languageSelector={<span>Python</span>} /></CompilerProvider>);

    fireEvent.click(screen.getByRole('button', { name: 'Run code' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check Output' })).toBeEnabled());
    fireEvent.change(screen.getByRole('textbox', { name: 'Code editor' }), { target: { value: 'print("changed")' } });
    expect(screen.getByRole('button', { name: 'Check Output' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Run code' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check Output' })).toBeEnabled());
    expect(manager.execute).toHaveBeenCalledTimes(2);
  });

  it('keeps verification disabled after a terminal execution failure', async () => {
    const manager = {
      execute: vi.fn().mockResolvedValue({ status: 'error', output: '', errors: ['runtime failed'], executionTimeMs: 2 }),
      format: vi.fn(), reset: vi.fn(), validateOutput: vi.fn(), dispose: vi.fn(),
    };
    render(<CompilerProvider manager={manager}><CompilerPanel compiler={compiler} activityType="challenge" languageSelector={<span>Python</span>} /></CompilerProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Run code' }));
    await screen.findByText('runtime failed');
    expect(screen.getByRole('button', { name: 'Check Output' })).toBeDisabled();
  });
});
