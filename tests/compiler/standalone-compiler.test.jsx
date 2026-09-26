import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPublicCompilerLanguage, publicCompilerLanguages } from '../../src/compiler/languages/supportedLanguages.js';
import { parseStandaloneCompilerRoute } from '../../src/standalone-compiler/standaloneCompilerRouting.js';
import { StandaloneLanguagePicker } from '../../src/standalone-compiler/StandaloneLanguagePicker.jsx';
import { EditorHeader } from '../../src/components/EditorHeader.jsx';
import { createCompilerData } from '../../src/components/blocks/CompilerBlock.jsx';
import { StandaloneCompilerPage } from '../../src/standalone-compiler/StandaloneCompilerPage.jsx';
import { isStandaloneCompilerRequest } from '../../src/standalone-compiler/standaloneCompilerHost.js';

const { execute } = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('../../src/compiler/CompilerProvider.jsx', () => ({ useCompilerManager: () => ({ execute }) }));
vi.mock('../../src/components/MonacoCodeEditor.jsx', () => ({ default: ({ editor, value }) => <textarea aria-label={editor.ariaLabel} value={value} readOnly /> }));
vi.mock('../../src/standalone-compiler/useStandaloneCompilerPreferences.js', () => ({
  useStandaloneCompilerPreferences: () => ({ preferences: { fontSize: 13, tabSize: 4, wordWrap: true }, resolvedTheme: 'light', update: vi.fn(), reset: vi.fn() }),
}));

afterEach(cleanup);

describe('standalone compiler routing', () => {
  it('selects the standalone application for production compiler hosts and the local development prefix', () => {
    expect(isStandaloneCompilerRequest({ hostname: 'compiler.ycoders.com', pathname: '/' })).toBe(true);
    expect(isStandaloneCompilerRequest({ hostname: 'ycoders-compiler.vercel.app', pathname: '/' })).toBe(true);
    expect(isStandaloneCompilerRequest({ hostname: 'ycoders.com', pathname: '/' })).toBe(false);
    expect(isStandaloneCompilerRequest({ hostname: 'localhost', pathname: '/__compiler' })).toBe(true);
    expect(isStandaloneCompilerRequest({ hostname: 'preview.example', pathname: '/', deploymentTarget: 'compiler' })).toBe(true);
  });

  it('resolves the root, all canonical languages, aliases, unknown routes, and reserved shares', () => {
    expect(parseStandaloneCompilerRoute('/', 'compiler.ycoders.com')).toEqual({ kind: 'index' });
    for (const language of publicCompilerLanguages) expect(parseStandaloneCompilerRoute(`/${language.publicSlug}`, 'compiler.ycoders.com').language.id).toBe(language.id);
    expect(parseStandaloneCompilerRoute('/js', 'compiler.ycoders.com')).toEqual(expect.objectContaining({ kind: 'language', canonical: false }));
    expect(parseStandaloneCompilerRoute('/vb', 'compiler.ycoders.com').language.id).toBe('visualbasic');
    expect(parseStandaloneCompilerRoute('/share/example', 'compiler.ycoders.com')).toEqual({ kind: 'share', shareId: 'example' });
    expect(parseStandaloneCompilerRoute('/not-a-language', 'compiler.ycoders.com')).toEqual({ kind: 'not-found' });
    expect(parseStandaloneCompilerRoute('/__compiler/python', 'localhost').language.id).toBe('python');
    expect(parseStandaloneCompilerRoute('/python', 'ycoders-compiler.vercel.app').language.id).toBe('python');
  });

  it('keeps human-readable public slugs adjacent to the canonical registry', () => {
    expect(publicCompilerLanguages).toHaveLength(17);
    expect(getPublicCompilerLanguage('visual-basic').id).toBe('visualbasic');
    expect(getPublicCompilerLanguage('c#').id).toBe('csharp');
  });
});

describe('standalone language picker', () => {
  it('renders all languages, searches aliases, identifies the selection, and routes selection', () => {
    const onSelect = vi.fn();
    render(<StandaloneLanguagePicker open activeLanguage={getPublicCompilerLanguage('python')} onClose={vi.fn()} onSelect={onSelect} />);
    expect(screen.getAllByRole('radio')).toHaveLength(17);
    expect(screen.getByRole('radio', { name: 'Python' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('MySQL')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search languages' }), { target: { value: 'c++' } });
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    fireEvent.click(screen.getByRole('radio', { name: 'C++' }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'cpp', publicSlug: 'cpp' }));
  });
});

describe('standalone launch state', () => {
  it.each([
    ['go', 'Go'],
    ['rust', 'Rust'],
    ['mysql', 'MySQL'],
  ])('renders the public %s editor with execution marked Coming Soon', async (id, label) => {
    const language = getPublicCompilerLanguage(id);
    render(<StandaloneCompilerPage language={language} onNavigate={vi.fn()} />);

    expect(await screen.findByRole('textbox', { name: `${label} source editor` })).toHaveValue(language.defaultSource);
    expect(screen.getByText(`Public ${label} execution is coming soon.`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Coming Soon' })).toBeDisabled();
    expect(execute).not.toHaveBeenCalled();
  });

  it.each([
    ['python', 'Python'],
    ['sql', 'SQL'],
  ])('keeps browser-backed standalone %s runnable', async (id, label) => {
    execute.mockResolvedValueOnce({ status: 'success', output: 'Hello\n', errors: [] });
    render(<StandaloneCompilerPage language={getPublicCompilerLanguage(id)} onNavigate={vi.fn()} />);

    const run = screen.getByRole('button', { name: 'Run' });
    expect(run).toBeEnabled();
    fireEvent.click(run);
    await waitFor(() => expect(execute).toHaveBeenCalledWith(expect.objectContaining({ language: id, execution: { publicStandalone: true } })));
    expect(screen.queryByText('Coming Soon')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: `${label} source editor` })).toBeInTheDocument();
  });
});

describe('embedded compiler separation', () => {
  it('does not expose standalone tools in the embedded header', () => {
    const data = createCompilerData({ id: 'embedded', type: 'compiler', language: 'python', fileName: 'main.py', starterCode: '', expectedOutput: '' });
    render(<EditorHeader data={data} executionStatus="idle" onRun={vi.fn()} onReset={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /settings/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /feedback/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /share/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run code' })).toBeEnabled();
  });

  it('keeps embedded MySQL execution controls unchanged', () => {
    const data = createCompilerData({ id: 'embedded-mysql', type: 'compiler', language: 'mysql', fileName: 'query.sql', starterCode: 'SELECT 1;', expectedOutput: '' });
    render(<EditorHeader data={data} executionStatus="idle" onRun={vi.fn()} onReset={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Run code' })).toBeEnabled();
    expect(screen.queryByText('Coming Soon')).not.toBeInTheDocument();
  });
});
