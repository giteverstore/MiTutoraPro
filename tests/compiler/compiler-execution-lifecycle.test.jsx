import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CompilerProvider } from '../../src/compiler/CompilerProvider.jsx';
import { CompilerPanel } from '../../src/components/CompilerPanel.jsx';

vi.mock('../../src/components/EditorPlaceholder.jsx', () => ({
  EditorPlaceholder: ({ editor, value, onChange }) => <textarea aria-label="Code editor" data-language={editor.language} value={value} onChange={(event) => onChange(event.target.value)} />,
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

function selectDevelopmentLanguage(label) {
  fireEvent.click(screen.getByRole('button', { name: 'Development compiler runtime' }));
  fireEvent.click(screen.getByRole('menuitemradio', { name: label }));
}

describe('shared compiler execution lifecycle', () => {
  it('keeps Course lessons content-locked even when the DEV selector is available elsewhere', () => {
    const manager = {
      execute: vi.fn(), format: vi.fn(), reset: vi.fn(), validateOutput: vi.fn(), dispose: vi.fn(),
    };
    render(<CompilerProvider manager={manager}><CompilerPanel compiler={compiler} activityType="lesson" /></CompilerProvider>);
    expect(screen.queryByRole('button', { name: 'Development compiler runtime' })).not.toBeInTheDocument();
    expect(screen.getByText('Python')).toHaveClass('compiler-language-label');
  });

  it('switches registered runtimes locally in development and executes without content validation metadata', async () => {
    const manager = {
      execute: vi.fn().mockResolvedValue({ status: 'success', output: 'runtime result', errors: [], executionTimeMs: 4 }),
      format: vi.fn(), reset: vi.fn().mockResolvedValue({ status: 'idle' }), validateOutput: vi.fn(), dispose: vi.fn(),
    };
    render(<CompilerProvider manager={manager}><CompilerPanel compiler={compiler} activityType="practice" /></CompilerProvider>);
    expect(screen.getByText('DEV Compiler:')).toBeVisible();
    selectDevelopmentLanguage('Java');
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Code editor' })).toHaveAttribute('data-language', 'java'));
    expect(screen.getByRole('textbox', { name: 'Code editor' })).toHaveValue('print("Hello there")');
    fireEvent.click(screen.getByRole('button', { name: 'Run code' }));
    await screen.findByText('runtime result');
    expect(manager.execute).toHaveBeenCalledWith(expect.objectContaining({ language: 'java', filename: 'Main.java' }));
    expect(screen.getByRole('button', { name: 'Check Output' })).toBeDisabled();
    expect(manager.validateOutput).not.toHaveBeenCalled();
  });

  it('switches between preview and terminal modes and clears preview output on reset', async () => {
    const manager = {
      execute: vi.fn(({ language }) => Promise.resolve(language === 'html-css'
        ? { status: 'success', output: '', errors: [], executionTimeMs: 2, preview: { channel: 'html-run', srcDoc: '<h1>Hello YCoders</h1>' } }
        : language === 'sql'
          ? { status: 'success', output: 'value\n1', errors: [], executionTimeMs: 3, database: { resultSets: [{ columns: ['value'], rows: [[1]], rowCount: 1 }], affectedRows: 0 } }
          : { status: 'success', output: 'terminal result', errors: [], executionTimeMs: 2 })),
      format: vi.fn(), reset: vi.fn().mockResolvedValue({ status: 'idle' }), validateOutput: vi.fn(), dispose: vi.fn(),
    };
    render(<CompilerProvider manager={manager}><CompilerPanel compiler={compiler} activityType="practice" /></CompilerProvider>);
    selectDevelopmentLanguage('HTML/CSS');
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Code editor' })).toHaveAttribute('data-language', 'html'));
    fireEvent.click(screen.getByRole('button', { name: 'Run code' }));
    expect(await screen.findByTitle('Learner web preview')).toHaveAttribute('srcdoc', '<h1>Hello YCoders</h1>');

    fireEvent.change(screen.getByRole('textbox', { name: 'Code editor' }), { target: { value: '<h1>Edited</h1>' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset code' }));
    await waitFor(() => expect(screen.queryByTitle('Learner web preview')).not.toBeInTheDocument());
    expect(screen.getByRole('textbox', { name: 'Code editor' }).value).toContain('Hello YCoders');

    selectDevelopmentLanguage('Python');
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Code editor' })).toHaveAttribute('data-language', 'python'));
    fireEvent.click(screen.getByRole('button', { name: 'Run code' }));
    expect(await screen.findByText('terminal result')).toBeVisible();
    expect(screen.queryByRole('tab', { name: 'Preview' })).not.toBeInTheDocument();

    selectDevelopmentLanguage('SQL');
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Code editor' })).toHaveAttribute('data-language', 'sql'));
    expect(screen.getByRole('textbox', { name: 'Code editor' }).value).toContain('CREATE TABLE users');
    fireEvent.click(screen.getByRole('button', { name: 'Run code' }));
    expect(await screen.findByRole('table')).toBeVisible();
    expect(screen.getByRole('columnheader', { name: 'value' })).toBeVisible();
  });

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
