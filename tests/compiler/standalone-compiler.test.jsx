import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublicCompilerLanguage, publicCompilerLanguages } from '../../src/compiler/languages/supportedLanguages.js';
import { parseStandaloneCompilerRoute } from '../../src/standalone-compiler/standaloneCompilerRouting.js';
import { StandaloneLanguagePicker } from '../../src/standalone-compiler/StandaloneLanguagePicker.jsx';
import { EditorHeader } from '../../src/components/EditorHeader.jsx';
import { createCompilerData } from '../../src/components/blocks/CompilerBlock.jsx';
import { StandaloneCompilerPage } from '../../src/standalone-compiler/StandaloneCompilerPage.jsx';
import { StandaloneTerminalPanel } from '../../src/standalone-compiler/StandaloneTerminalPanel.jsx';
import { isStandaloneCompilerRequest } from '../../src/standalone-compiler/standaloneCompilerHost.js';
import { STANDALONE_MONACO_THEMES, standaloneMonacoOptions } from '../../src/standalone-compiler/standaloneMonacoThemes.js';

const standaloneCompilerCss = readFileSync(resolve(process.cwd(), 'src/styles/standalone-compiler.css'), 'utf8');
const standalonePreferencesSource = readFileSync(resolve(process.cwd(), 'src/standalone-compiler/useStandaloneCompilerPreferences.js'), 'utf8');

const { execute, submitStdin, preferenceState } = vi.hoisted(() => ({ execute: vi.fn(), submitStdin: vi.fn(), preferenceState: { theme: 'light' } }));
vi.mock('../../src/compiler/CompilerProvider.jsx', () => ({ useCompilerManager: () => ({ execute, submitStdin }) }));
vi.mock('../../src/components/MonacoCodeEditor.jsx', () => ({ default: ({ editor, value, onChange, standalonePreferences, layoutSignal }) => <textarea aria-label={editor.ariaLabel} data-layout-signal={layoutSignal} data-monaco-theme={standalonePreferences?.monacoTheme} value={value} onChange={(event) => onChange(event.target.value)} /> }));
vi.mock('../../src/standalone-compiler/useStandaloneCompilerPreferences.js', () => ({
  useStandaloneCompilerPreferences: () => ({ preferences: { fontSize: 13, tabSize: 4, wordWrap: true }, resolvedTheme: preferenceState.theme, update: vi.fn(), reset: vi.fn() }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  preferenceState.theme = 'light';
  const values = new Map();
  Object.defineProperty(window, 'localStorage', { configurable: true, value: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

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

  it('keeps dark picker labels, fallback monograms, search, selection, and title explicitly readable', () => {
    document.body.dataset.standaloneCompilerTheme = 'dark';
    const { container } = render(<StandaloneLanguagePicker open activeLanguage={getPublicCompilerLanguage('java')} onClose={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Choose a Language' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Search languages' })).toHaveAttribute('placeholder', 'Search languages...');
    expect(screen.getByRole('radio', { name: 'Java' })).toHaveClass('is-selected');
    for (const label of ['C', 'MySQL', 'PHP', 'R', 'Visual Basic', 'Assembly']) {
      const card = screen.getByText(label, { selector: '.standalone-language-label' }).closest('button');
      expect(card.querySelector('.standalone-language-label')).toBeInTheDocument();
      expect(card.querySelector('.standalone-language-monogram')).toBeInTheDocument();
    }
    expect(container).toBeEmptyDOMElement();
    expect(standaloneCompilerCss).toContain('body[data-standalone-compiler-theme="dark"] .standalone-language-grid button{color:#dce5e0}');
    expect(standaloneCompilerCss).toContain('body[data-standalone-compiler-theme="dark"] .standalone-language-grid button.is-selected{color:#f1f5f3');
    expect(standaloneCompilerCss).toContain('body[data-standalone-compiler-theme="dark"] .standalone-language-search input::placeholder{color:#aeb9b4;opacity:1}');
    expect(standaloneCompilerCss).toContain('.standalone-language-dialog>h2{color:var(--color-text)}');
    expect(standaloneCompilerCss).toContain('.standalone-language-dialog{scrollbar-width:thin');
    delete document.body.dataset.standaloneCompilerTheme;
  });
});

describe('standalone terminal status bar', () => {
  const baseProps = { supportsStdin: true, stdin: '', onStdinChange: vi.fn(), result: '', error: '', isRunning: false, executionTimeMs: null, activeLanguage: { label: 'Python' } };

  it('renders a compact idle status without placeholder timing', () => {
    render(<StandaloneTerminalPanel {...baseProps} />);
    const footer = screen.getByText('Ready').closest('footer');
    expect(footer).toHaveClass('standalone-result-statusbar');
    expect(footer).toHaveTextContent('Ready');
    expect(footer).not.toHaveTextContent('Time');
    expect(standaloneCompilerCss).toContain('grid-template-rows:var(--standalone-pane-header-height) minmax(0,1fr) 30px');
    expect(standaloneCompilerCss).toContain('.standalone-result-statusbar{display:flex;height:30px;align-items:center;justify-content:space-between');
  });

  it('places completed timing on the right without duplicating the minimize control', () => {
    render(<StandaloneTerminalPanel {...baseProps} result="done" executionTimeMs={24} />);
    const footer = screen.getByText('Success').closest('footer');
    expect(footer.querySelector('.standalone-result-status')).toHaveTextContent('Success');
    expect(footer.querySelector('.standalone-result-time')).toHaveTextContent('Time 24 ms');
    expect(footer.querySelector('.standalone-result-collapse')).not.toBeInTheDocument();
  });
});

describe('standalone launch state', () => {
  it('passes exact pre-supplied stdin to the shared compiler request on every run', async () => {
    execute.mockResolvedValue({ status: 'success', output: 'ok', errors: [] });
    render(<StandaloneCompilerPage language={getPublicCompilerLanguage('python')} onNavigate={vi.fn()} />);

    for (const stdin of ['25', '10\n20', 'one\n\ntwo', 'hello world', 'ನಮಸ್ಕಾರ\nこんにちは\nAvi 🚀']) {
      fireEvent.click(screen.getByRole('tab', { name: 'Input' }));
      const input = screen.getByRole('textbox', { name: 'Standard input' });
      fireEvent.change(input, { target: { value: stdin } });
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));
      await waitFor(() => expect(execute).toHaveBeenLastCalledWith(expect.objectContaining({ stdin })));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Run' })).toBeEnabled());
    }
  });

  it('restores opted-in shared stdin and executes that exact snapshot value', async () => {
    execute.mockResolvedValueOnce({ status: 'success', output: 'shared', errors: [] });
    const stdin = 'first\n\nthird  \nこんにちは';
    render(<StandaloneCompilerPage
      language={getPublicCompilerLanguage('python')}
      initialSnapshot={{ source: 'print(input())', stdinIncluded: true, stdin }}
      onNavigate={vi.fn()}
    />);
    fireEvent.click(screen.getByRole('tab', { name: 'Input' }));
    expect(screen.getByRole('textbox', { name: 'Standard input' })).toHaveValue(stdin);
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(execute).toHaveBeenCalledWith(expect.objectContaining({ stdin })));
  });

  it('does not expose an Input tab when the terminal capability is false', () => {
    render(<StandaloneTerminalPanel supportsStdin={false} stdin="" onStdinChange={vi.fn()} result="" error="" isRunning={false} executionTimeMs={null} activeLanguage={{ label: 'Assembly' }} />);
    expect(screen.queryByRole('tab', { name: 'Input' })).not.toBeInTheDocument();
  });

  it.each([
    ['python', true], ['java', true], ['javascript', true], ['typescript', true],
    ['c', true], ['cpp', true], ['php', true], ['r', true], ['csharp', true],
    ['visual-basic', true], ['go', true], ['rust', true], ['html-css', false],
    ['react', false], ['sql', false], ['mysql', false], ['assembly', false],
  ])('declares the canonical stdin capability for %s', (id, supportsStdin) => {
    expect(getPublicCompilerLanguage(id).supportsStdin).toBe(supportsStdin);
  });

  it('declares interactive stdin only for Python', () => {
    expect(getPublicCompilerLanguage('python').supportsInteractiveStdin).toBe(true);
    for (const language of publicCompilerLanguages.filter(({ id }) => id !== 'python')) {
      expect(language.supportsInteractiveStdin).toBe(false);
    }
  });

  it('shows a waiting composer, submits input separately, and preserves stdout', () => {
    const onSubmitStdin = vi.fn(() => true);
    render(<StandaloneTerminalPanel supportsStdin supportsInteractiveStdin stdin="" onStdinChange={vi.fn()} isRunning executionState="waiting_for_input" result="Name: " error="" executionTimeMs={null} activeLanguage={{ label: 'Python' }} stdinHistory={[]} onSubmitStdin={onSubmitStdin} />);
    expect(screen.getAllByText('Waiting for input')).toHaveLength(2);
    const composer = screen.getByRole('textbox', { name: 'Interactive standard input' });
    fireEvent.change(composer, { target: { value: 'Avi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSubmitStdin).toHaveBeenCalledWith('Avi');
    expect(composer).toHaveValue('');
    fireEvent.click(screen.getByRole('tab', { name: 'Output' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Name:');
    expect(screen.getByRole('tabpanel')).not.toHaveTextContent('Avi');
  });

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

describe('standalone workspace refinement', () => {
  it('combines navigation and actions, links to YCoders, and reserves the ad slot', async () => {
    render(<StandaloneCompilerPage language={getPublicCompilerLanguage('python')} onNavigate={vi.fn()} />);
    expect(document.querySelector('.standalone-compiler-navbar')).toBeInTheDocument();
    expect(document.querySelector('.standalone-compiler-toolbar')).not.toBeInTheDocument();
    const navbar = document.querySelector('.standalone-compiler-navbar');
    expect(navbar.querySelector('.standalone-compiler-brand')).toBe(navbar.firstElementChild);
    expect(navbar.querySelector('.standalone-navbar-right .standalone-language-trigger')).toBeInTheDocument();
    for (const label of ['Settings', 'Feedback', 'Share', 'Reset', 'Run']) expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Minimize compiler' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /try ycoders/i })).toHaveAttribute('href', 'https://ycoders.com');
    expect(screen.getByRole('complementary', { name: 'Advertisement' })).toBeInTheDocument();
    expect(await screen.findByRole('textbox', { name: 'Python source editor' })).toBeInTheDocument();
  });

  it('collapses only the result pane and preserves source, stdin, and the active result tab', async () => {
    render(<StandaloneCompilerPage language={getPublicCompilerLanguage('python')} onNavigate={vi.fn()} />);
    const editor = await screen.findByRole('textbox', { name: 'Python source editor' });
    fireEvent.change(editor, { target: { value: 'print("kept")' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Input' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Standard input' }), { target: { value: 'saved stdin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Minimize compiler panel' }));
    expect(screen.getByRole('button', { name: 'Restore compiler panel' })).toHaveTextContent('Compiler');
    expect(editor).toHaveAttribute('data-layout-signal', '60-true');
    expect(document.querySelector('.standalone-result-pane')).toHaveAttribute('hidden');
    expect(document.querySelector('.standalone-workspace-divider')).toHaveAttribute('hidden');
    expect(document.querySelector('.standalone-compiler-workspace')).toHaveClass('is-result-collapsed');
    expect(editor).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore compiler panel' }));
    expect(editor).toHaveAttribute('data-layout-signal', '60-false');
    expect(screen.getByRole('textbox', { name: 'Python source editor' })).toHaveValue('print("kept")');
    expect(screen.getByRole('tab', { name: 'Input' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('textbox', { name: 'Standard input' })).toHaveValue('saved stdin');
    expect(document.querySelector('.standalone-result-pane')).not.toHaveAttribute('hidden');
    expect(document.querySelector('.standalone-workspace-divider')).not.toHaveAttribute('hidden');
    expect(screen.queryByRole('button', { name: 'Restore compiler panel' })).not.toBeInTheDocument();
  });

  it('resizes within bounds, persists the split, and resets on double click', async () => {
    window.localStorage.removeItem('ycoders.standaloneCompiler.splitRatio');
    render(<StandaloneCompilerPage language={getPublicCompilerLanguage('python')} onNavigate={vi.fn()} />);
    await screen.findByRole('textbox', { name: 'Python source editor' });
    const separator = screen.getByRole('separator', { name: 'Resize editor and results' });
    fireEvent.keyDown(separator, { key: 'ArrowRight' });
    expect(separator).toHaveAttribute('aria-valuenow', '62');
    expect(window.localStorage.getItem('ycoders.standaloneCompiler.splitRatio')).toBe('62');
    fireEvent.click(screen.getByRole('button', { name: 'Minimize compiler panel' }));
    expect(window.localStorage.getItem('ycoders.standaloneCompiler.splitRatio')).toBe('62');
    fireEvent.click(screen.getByRole('button', { name: 'Restore compiler panel' }));
    expect(screen.getByRole('separator')).toHaveAttribute('aria-valuenow', '62');
    for (let index = 0; index < 20; index += 1) fireEvent.keyDown(separator, { key: 'ArrowRight' });
    expect(separator).toHaveAttribute('aria-valuenow', '75');
    fireEvent.doubleClick(separator);
    expect(separator).toHaveAttribute('aria-valuenow', '60');
    for (let index = 0; index < 20; index += 1) fireEvent.keyDown(separator, { key: 'ArrowLeft' });
    expect(separator).toHaveAttribute('aria-valuenow', '35');
  });

  it('keeps icon labels collapsed until sustained hover and exposes them on focus', () => {
    vi.useFakeTimers();
    render(<StandaloneCompilerPage language={getPublicCompilerLanguage('python')} onNavigate={vi.fn()} />);
    const settings = screen.getByRole('button', { name: 'Settings' });
    fireEvent.mouseEnter(settings);
    act(() => vi.advanceTimersByTime(1999));
    expect(settings).not.toHaveClass('is-expanded');
    fireEvent.mouseLeave(settings);
    act(() => vi.advanceTimersByTime(1));
    expect(settings).not.toHaveClass('is-expanded');
    fireEvent.mouseEnter(settings);
    act(() => vi.advanceTimersByTime(2000));
    expect(settings).toHaveClass('is-expanded');
    fireEvent.mouseLeave(settings);
    expect(settings).not.toHaveClass('is-expanded');
    fireEvent.focus(settings);
    expect(settings).toHaveClass('is-expanded');
    vi.useRealTimers();
  });

  it('centers every collapsed standalone action in the shared icon-only state', () => {
    render(<StandaloneCompilerPage language={getPublicCompilerLanguage('python')} onNavigate={vi.fn()} />);
    for (const label of ['Settings', 'Feedback', 'Share', 'Reset', 'Run']) {
      const control = screen.getByRole('button', { name: label });
      expect(control).toHaveClass('standalone-icon-control', 'is-icon-only');
      expect(control).not.toHaveClass('is-expanded');
      expect(control.querySelector(':scope > svg')).toBeInTheDocument();
    }
    expect(standaloneCompilerCss).toContain('.standalone-icon-control{display:inline-flex;align-items:center;justify-content:center;gap:0;');
  });

  it.each([
    ['python', '.standalone-execution-panel'],
    ['html', '.web-preview-panel'],
    ['sql', '.database-result-panel'],
    ['assembly', '.emulator-result-panel'],
  ])('applies the standalone dark theme around the %s mode shell', async (id, selector) => {
    preferenceState.theme = 'dark';
    const language = getPublicCompilerLanguage(id);
    const { container } = render(<StandaloneCompilerPage language={language} onNavigate={vi.fn()} />);
    await screen.findByRole('textbox', { name: `${language.label} source editor` });
    expect(container.querySelector('.standalone-compiler')).toHaveAttribute('data-theme', 'dark');
    expect(container.querySelector(selector)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: `${language.label} source editor` })).toHaveAttribute('data-monaco-theme', 'ycoders-standalone-dark');
  });

  it.each(['python', 'java', 'react', 'assembly'])('renders the canonical %s filename as the active standalone file tab', async (id) => {
    const language = getPublicCompilerLanguage(id);
    const { container, rerender } = render(<StandaloneCompilerPage language={language} onNavigate={vi.fn()} />);
    await screen.findByRole('textbox', { name: `${language.label} source editor` });
    const tab = container.querySelector('.standalone-file-tab');
    expect(tab).toHaveAttribute('role', 'tab');
    expect(tab).toHaveTextContent(language.defaultFileName);
    const nextLanguage = getPublicCompilerLanguage('sql');
    rerender(<StandaloneCompilerPage language={nextLanguage} onNavigate={vi.fn()} />);
    expect(container.querySelector('.standalone-file-tab')).toHaveTextContent(nextLanguage.defaultFileName);
  });

  it('uses a distinct standalone light Monaco theme for the editor gutter', async () => {
    render(<StandaloneCompilerPage language={getPublicCompilerLanguage('python')} onNavigate={vi.fn()} />);
    expect(await screen.findByRole('textbox', { name: 'Python source editor' })).toHaveAttribute('data-monaco-theme', 'ycoders-standalone-light');
  });

  it('defines visibly distinct Monaco editor and gutter colors without changing embedded theme names', () => {
    expect(STANDALONE_MONACO_THEMES.light.name).toBe('ycoders-standalone-light');
    expect(STANDALONE_MONACO_THEMES.dark.name).toBe('ycoders-standalone-dark');
    expect(STANDALONE_MONACO_THEMES.light.gutterBackground).not.toBe(STANDALONE_MONACO_THEMES.light.editorBackground);
    expect(STANDALONE_MONACO_THEMES.dark.gutterBackground).not.toBe(STANDALONE_MONACO_THEMES.dark.editorBackground);
  });

  it('uses a 30px code-area offset and one 40px pane-header token', () => {
    expect(standaloneCompilerCss).toContain('--standalone-editor-gutter-width:30px');
    expect(standaloneCompilerCss).toContain('--standalone-pane-header-height:40px');
    expect(standaloneCompilerCss).toContain('--standalone-code-left-padding:10px');
    expect(standaloneCompilerCss).toContain('padding:0 .45rem 0 calc(var(--standalone-editor-gutter-width) + var(--standalone-code-left-padding))');
    expect(standaloneCompilerCss).toContain('grid-template-rows:var(--standalone-pane-header-height)');
  });

  it('applies compact Monaco geometry only when standalone preferences are present', () => {
    expect(standaloneMonacoOptions({ monacoTheme: 'ycoders-standalone-light' })).toEqual(expect.objectContaining({
      folding: false,
      glyphMargin: false,
      lineNumbersMinChars: 2,
      lineDecorationsWidth: 26,
      minimap: { enabled: false },
      scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
    }));
    expect(standaloneMonacoOptions()).toEqual({});
  });

  it('normalizes standalone-only 16px and 14px typography', () => {
    expect(standalonePreferencesSource).toContain("fontSize: 14");
    expect(standaloneCompilerCss).toContain('background:var(--color-background);font-size:16px;color-scheme:light');
    expect(standaloneCompilerCss).toContain('.standalone-file-tab{display:inline-flex;height:2rem;');
    expect(standaloneCompilerCss).toContain('font-family:var(--font-family-mono);font-size:.875rem');
    expect(standaloneCompilerCss).toContain('.standalone-result-statusbar{display:flex;height:30px;align-items:center;justify-content:space-between;');
    expect(standaloneCompilerCss).toContain('border-top:1px solid var(--editor-border);font-size:.875rem');
  });

  it('uses a 16px padded restore badge and centered line-number gutter', () => {
    expect(standaloneCompilerCss).toContain('.standalone-result-restore{position:absolute;');
    expect(standaloneCompilerCss).toContain('padding:.45rem .9rem .45rem .45rem');
    expect(standaloneCompilerCss).toContain('font:inherit;font-size:1rem;font-weight:700');
    expect(standaloneCompilerCss).toContain('.line-numbers{width:var(--standalone-editor-gutter-width)!important;padding:0!important;text-align:center!important}');
    expect(standaloneCompilerCss).toContain('right:var(--standalone-code-left-padding)');
  });

  it('places the minimize control in the result header action layer, never the footer', async () => {
    const { container } = render(<StandaloneCompilerPage language={getPublicCompilerLanguage('python')} onNavigate={vi.fn()} />);
    await screen.findByRole('textbox', { name: 'Python source editor' });
    const actionLayer = container.querySelector('.standalone-result-header-actions');
    expect(actionLayer).toContainElement(screen.getByRole('button', { name: 'Minimize compiler panel' }));
    expect(container.querySelector('.standalone-execution-panel footer')).not.toContainElement(screen.getByRole('button', { name: 'Minimize compiler panel' }));
  });

  it.each(['light', 'dark'])('keeps Preview and Console readable and exposes active state in %s mode', async (theme) => {
    preferenceState.theme = theme;
    const { container } = render(<StandaloneCompilerPage language={getPublicCompilerLanguage('html')} onNavigate={vi.fn()} />);
    await screen.findByRole('textbox', { name: 'HTML/CSS source editor' });
    const preview = screen.getByRole('tab', { name: 'Preview' });
    const consoleTab = screen.getByRole('tab', { name: 'Console' });
    expect(container.querySelector('.standalone-compiler')).toHaveAttribute('data-theme', theme);
    expect(preview).toHaveClass('is-active');
    expect(preview).toHaveAttribute('aria-selected', 'true');
    expect(consoleTab).not.toHaveClass('is-active');
    expect(consoleTab).toHaveAttribute('aria-selected', 'false');
    fireEvent.click(consoleTab);
    expect(consoleTab).toHaveClass('is-active');
    expect(consoleTab).toHaveAttribute('aria-selected', 'true');
    expect(preview).not.toHaveClass('is-active');
  });

  it('defines explicit light and dark preview-tab contrast without disabled opacity', () => {
    expect(standaloneCompilerCss).toContain('[data-theme="light"] .web-preview-panel .ide-result-tabs button:not(.is-active)');
    expect(standaloneCompilerCss).toContain('[data-theme="dark"] .web-preview-panel .ide-result-tabs button:not(.is-active)');
    expect(standaloneCompilerCss).toContain('.standalone-compiler-workspace .ide-result-tabs button{display:flex;align-items:center;color:var(--editor-text-muted);font-size:.875rem;font-weight:600;opacity:1}');
  });

  it('uses zero-minimum grid tracks to isolate a long editor line from the result pane', async () => {
    const { container } = render(<StandaloneCompilerPage language={getPublicCompilerLanguage('python')} onNavigate={vi.fn()} />);
    const editor = await screen.findByRole('textbox', { name: 'Python source editor' });
    fireEvent.change(editor, { target: { value: `print("${'x'.repeat(1000)}")` } });
    const workspace = container.querySelector('.standalone-compiler-workspace');
    expect(workspace).toHaveClass('is-two-pane');
    expect(workspace.style.gridTemplateColumns).toContain('minmax(0,60fr)');
    expect(container.querySelector('.standalone-editor-pane')).toBeInTheDocument();
    expect(container.querySelector('.standalone-result-pane')).not.toHaveAttribute('hidden');
  });

  it.each(['python', 'react', 'sql', 'assembly', 'go', 'rust', 'mysql'])('collapses and restores the mounted %s result mode independently', async (id) => {
    const language = getPublicCompilerLanguage(id);
    const { container } = render(<StandaloneCompilerPage language={language} onNavigate={vi.fn()} />);
    await screen.findByRole('textbox', { name: `${language.label} source editor` });
    const collapse = screen.getByRole('button', { name: 'Minimize compiler panel' });
    fireEvent.click(collapse);
    expect(container.querySelector('.standalone-result-pane')).toHaveAttribute('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Restore compiler panel' }));
    expect(container.querySelector('.standalone-result-pane')).not.toHaveAttribute('hidden');
    expect(screen.queryByRole('button', { name: 'Restore compiler panel' })).not.toBeInTheDocument();
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
