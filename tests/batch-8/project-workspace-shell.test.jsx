import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projectCatalog } from '../../src/projects/repositories/ProjectCatalog';
import { ProjectWorkspace } from '../../src/projects/pages/ProjectWorkspace';

vi.mock('../../src/compiler/CompilerProvider', () => ({ useCompilerManager: () => ({}) }));
vi.mock('../../src/components/EditorPlaceholder', () => ({ EditorPlaceholder: ({ editor, value, onChange, onCursorPositionChange, workspacePreferences, loadingTheme }) => <textarea aria-label={editor.ariaLabel} data-font-size={workspacePreferences?.fontSize} data-tab-size={workspacePreferences?.tabSize} data-word-wrap={workspacePreferences?.wordWrap} data-monaco-theme={workspacePreferences?.monacoTheme} data-loading-theme={loadingTheme} value={value} onChange={(event) => onChange(event.target.value)} onSelect={() => onCursorPositionChange?.({ lineNumber: 7, column: 3 })} /> }));
vi.mock('../../src/ai/AITutorWorkspace', () => ({ AITutorWorkspace: () => { const [draft, setDraft] = React.useState(''); return <label>AI Guide workspace<input aria-label="AI draft" value={draft} onChange={(event) => setDraft(event.target.value)} /></label>; } }));

const css = readFileSync(resolve(process.cwd(), 'src/styles/pages/projects.css'), 'utf8');
const project = projectCatalog.getProjects()[0];
const storage = new Map();
beforeEach(() => { storage.clear(); vi.stubGlobal('localStorage', { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key), clear: () => storage.clear() }); });
afterEach(cleanup);

describe('immersive project workspace shell', () => {
  it('renders the VS Code-inspired structure without AppShell or public footer chrome', () => {
    const { container } = render(<ProjectWorkspace project={project} tier="PREMIUM" onBack={vi.fn()} onProgress={vi.fn()} />);
    expect(container.querySelector('.project-ide-shell')).toBeInTheDocument();
    expect(container.querySelector('.app-shell')).not.toBeInTheDocument();
    expect(container.querySelector('.app-footer')).not.toBeInTheDocument();
    expect(screen.getByText(project.title, { selector: '.project-ide-topbar strong' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Explorer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: project.template.sourcePath.split('/').at(-1) })).toBeInTheDocument();
    expect(screen.getByLabelText(`${project.title} implementation editor`)).toBeInTheDocument();
    for (const tab of ['terminal', 'output', 'problems', 'tests']) expect(screen.getByRole('tab', { name: tab })).toBeInTheDocument();
  });

  it('maps all four existing stages into tasks and updates the guide without losing source', () => {
    render(<ProjectWorkspace project={project} tier="PREMIUM" onBack={vi.fn()} onProgress={vi.fn()} />);
    const editor = screen.getByLabelText(`${project.title} implementation editor`);
    fireEvent.change(editor, { target: { value: 'def calculate():\n    return 42' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Guide' }));
    expect(screen.getByRole('heading', { name: 'Requirements' })).toBeInTheDocument();
    expect(screen.getByText(project.requirements[0])).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByRole('heading', { name: 'Function contract' })).toBeInTheDocument();
    expect(screen.getByText(/calculate\(left, right, operator\)/)).toBeInTheDocument();
    expect(editor).toHaveValue('def calculate():\n    return 42');
    expect(screen.getByText('2 / 4')).toBeInTheDocument();
    expect(document.querySelector('.project-ide-topbar')).not.toHaveTextContent('Project 2 / 4');
    expect(document.querySelector('.project-ide-statusbar')).not.toHaveTextContent('Project 2 / 4');
  });

  it('collapses optional left and bottom panels while keeping Guide and AI permanently visible', () => {
    const { container } = render(<ProjectWorkspace project={project} tier="PREMIUM" onBack={vi.fn()} onProgress={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Files' }));
    fireEvent.click(screen.getByRole('button', { name: 'Collapse bottom panel' }));
    expect(container.querySelector('.project-ide-shell')).toHaveClass('is-explorer-collapsed', 'is-bottom-collapsed');
    expect(container.querySelector('.project-ide-shell')).not.toHaveClass('is-guide-collapsed');
    expect(screen.getByLabelText(`${project.title} implementation editor`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Files' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore bottom panel' }));
    expect(screen.getByRole('complementary', { name: 'Explorer' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Guide and AI' })).toBeInTheDocument();
  });

  it('returns to Projects and preserves the existing Free implementation boundary', () => {
    const onBack = vi.fn();
    const { unmount } = render(<ProjectWorkspace project={project} tier="PREMIUM" onBack={onBack} onProgress={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Projects' }));
    expect(onBack).toHaveBeenCalledOnce();
    unmount();
    render(<ProjectWorkspace project={project} tier="FREE" initialPageIndex={3} onBack={onBack} onProgress={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Continue this project with Premium' })).toBeInTheDocument();
    expect(screen.queryByLabelText(`${project.title} implementation editor`)).not.toBeInTheDocument();
  });

  it('creates, edits, switches, renames, closes, and deletes virtual project files safely', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<ProjectWorkspace project={project} tier="PREMIUM" onBack={vi.fn()} onProgress={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'New File in src' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'New file name' }), { target: { value: 'utils.py' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'New file name' }), { key: 'Enter' });
    const helperEditor = screen.getByLabelText(`${project.title} src/utils.py editor`);
    fireEvent.change(helperEditor, { target: { value: 'def add(a, b):\n    return a + b' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename src/utils.py' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Rename src/utils.py' }), { target: { value: 'calculator.py' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Rename src/utils.py' }), { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'calculator.py' })).toBeInTheDocument();
    expect(screen.getByLabelText(`${project.title} src/calculator.py editor`)).toHaveValue('def add(a, b):\n    return a + b');
    fireEvent.click(screen.getByRole('button', { name: 'Close src/calculator.py' }));
    expect(screen.queryByLabelText(`${project.title} src/calculator.py editor`)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'calculator.py' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete src/calculator.py' }));
    expect(screen.queryByRole('button', { name: 'calculator.py' })).not.toBeInTheDocument();
  });

  it('keeps Explorer on the left and preserves mounted AI state across Guide/AI switching', () => {
    const { container } = render(<ProjectWorkspace project={project} tier="PREMIUM" onBack={vi.fn()} onProgress={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Project Guide' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'AI' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'AI draft' }), { target: { value: 'keep this question' } });
    fireEvent.click(screen.getByRole('tab', { name: 'Guide' }));
    fireEvent.click(screen.getByRole('tab', { name: 'AI' }));
    expect(screen.getByRole('textbox', { name: 'AI draft' })).toHaveValue('keep this question');
    expect(screen.queryByRole('button', { name: 'Collapse Guide and AI' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restore Guide and AI' })).not.toBeInTheDocument();
    expect(container.querySelector('.project-ai-panel')).toBeInTheDocument();
  });

  it('keeps only file tabs in the editor header while preserving project validation modules', () => {
    render(<ProjectWorkspace project={project} tier="PREMIUM" onBack={vi.fn()} onProgress={vi.fn()} />);
    expect(screen.getByRole('button', { name: project.template.sourcePath.split('/').at(-1) })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset entry file' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Validate/ })).not.toBeInTheDocument();
    expect(readFileSync(resolve(process.cwd(), 'src/projects/validation/ProjectValidator.js'), 'utf8')).toContain('validateProject');
  });

  it('shows live editor metadata and preserves the selected result tab in the collapsed full-width band', () => {
    const { container } = render(<ProjectWorkspace project={project} tier="PREMIUM" onBack={vi.fn()} onProgress={vi.fn()} />);
    fireEvent.select(screen.getByLabelText(`${project.title} implementation editor`));
    const statusbar = container.querySelector('.project-ide-statusbar');
    expect(statusbar).toHaveTextContent('Ln 7, Col 3');
    expect(statusbar).toHaveTextContent('Spaces: 4');
    expect(statusbar).toHaveTextContent('UTF-8');
    expect(statusbar).toHaveTextContent('LF');
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'problems' }));
    fireEvent.click(screen.getByRole('button', { name: 'Collapse bottom panel' }));
    for (const tab of ['terminal', 'output', 'problems', 'tests']) expect(screen.getByRole('tab', { name: tab })).toBeInTheDocument();
    expect(container.querySelector('.project-bottom-panel')).toHaveClass('is-collapsed');
    expect(container.querySelector('.project-bottom-restore')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'terminal' }));
    expect(container.querySelector('.project-bottom-panel')).not.toHaveClass('is-collapsed');
    expect(screen.getByRole('tab', { name: 'terminal' })).toHaveAttribute('aria-selected', 'true');
  });

  it('moves the canonical 17-language selector to the status bar without replacing project files', () => {
    const { container } = render(<ProjectWorkspace project={project} tier="PREMIUM" onBack={vi.fn()} onProgress={vi.fn()} />);
    expect(container.querySelector('.project-ide-topbar')).not.toHaveTextContent('Python');
    const editor = screen.getByLabelText(`${project.title} implementation editor`);
    fireEvent.change(editor, { target: { value: 'learner source stays' } });
    fireEvent.click(screen.getByRole('button', { name: 'Python' }));
    expect(screen.getAllByRole('radio')).toHaveLength(17);
    fireEvent.click(screen.getByRole('radio', { name: 'Rust' }));
    expect(screen.getByRole('button', { name: 'Rust' })).toHaveAttribute('aria-expanded', 'false');
    expect(editor).toHaveValue('learner source stays');
  });

  it('persists project-only Settings and sends them to the workspace Monaco adapter', () => {
    const { container } = render(<ProjectWorkspace project={project} tier="PREMIUM" onBack={vi.fn()} onProgress={vi.fn()} />);
    const shell = container.querySelector('.project-ide-shell');
    expect(shell).toHaveAttribute('data-project-theme', 'light');
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('complementary', { name: 'Settings' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Font size'), { target: { value: '18' } });
    fireEvent.change(screen.getByLabelText('Spaces'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Appearance'), { target: { value: 'dark' } });
    fireEvent.change(screen.getByLabelText('Word wrap'), { target: { value: 'off' } });
    const editor = screen.getByLabelText(`${project.title} implementation editor`);
    fireEvent.change(editor, { target: { value: 'theme-safe learner source' } });
    expect(shell).toHaveAttribute('data-project-theme', 'dark');
    expect(editor).toHaveAttribute('data-font-size', '18');
    expect(editor).toHaveAttribute('data-tab-size', '2');
    expect(editor).toHaveAttribute('data-word-wrap', 'false');
    expect(editor).toHaveAttribute('data-monaco-theme', 'ycoders-dark');
    expect(editor).toHaveAttribute('data-loading-theme', 'dark');
    expect(editor).toHaveValue('theme-safe learner source');
    fireEvent.click(screen.getByRole('button', { name: 'Python' }));
    expect(document.querySelector('.project-language-backdrop')).toHaveClass('is-dark');
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.change(screen.getByLabelText('Appearance'), { target: { value: 'light' } });
    expect(shell).toHaveAttribute('data-project-theme', 'light');
    expect(editor).toHaveAttribute('data-monaco-theme', 'ycoders-light');
    expect(editor).toHaveAttribute('data-loading-theme', 'light');
    expect(editor).toHaveValue('theme-safe learner source');
    expect(JSON.parse(storage.get('ycoders.projectWorkspace.editorPreferences'))).toMatchObject({ fontSize: 18, tabSize: 2, appearance: 'light', wordWrap: false });
  });

  it('removes the stage-list section while retaining compact Guide navigation', () => {
    const { container } = render(<ProjectWorkspace project={project} tier="PREMIUM" onBack={vi.fn()} onProgress={vi.fn()} />);
    expect(container.querySelector('.project-task-list')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Requirements' })).toBeInTheDocument();
    expect(screen.getByText('1 / 4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByRole('heading', { name: 'Function contract' })).toBeInTheDocument();
    expect(screen.getByText('2 / 4')).toBeInTheDocument();
    expect(css).toContain('.project-guide-content { font-size: 16px; }');
  });

  it('renders a semantic compact tree with inline folders and collapse-all behavior', () => {
    const { container } = render(<ProjectWorkspace project={project} tier="PREMIUM" onBack={vi.fn()} onProgress={vi.fn()} />);
    expect(screen.getByRole('tree', { name: `${project.title} files` })).toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: /src/ })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'New Folder' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'New folder name' }), { target: { value: 'docs' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'New folder name' }), { key: 'Enter' });
    expect(screen.getByRole('treeitem', { name: /docs/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Collapse All' }));
    expect(screen.getByRole('treeitem', { name: project.title })).toHaveAttribute('aria-expanded', 'false');
    expect(container.querySelector('.project-runtime-note')).not.toBeInTheDocument();
    expect(css).toContain('.project-tree-actions {');
    expect(css).toContain('opacity: 0;');
  });

  it('defines desktop, theme-aware, tablet, and mobile workspace contracts', () => {
    expect(css).toContain('.project-ide-shell {');
    expect(css).toContain('position: fixed;');
    expect(css).toContain('--project-ide-panel: var(--color-surface);');
    expect(css).toContain('--project-ide-canvas: var(--color-canvas);');
    expect(css).toContain('.project-ide-shell[data-project-theme="dark"]');
    expect(css).toContain('--project-surface: #161b22;');
    expect(css).toContain('.project-language-backdrop.is-dark');
    expect(css).toContain('@media (max-width: 900px)');
    expect(css).toContain('@media (max-width: 600px)');
    expect(css).toContain('.project-ai-panel { position: absolute;');
    expect(css).toContain('.project-activity-bar { grid-column: 1; grid-row: 2; flex-direction: row;');
  });
});
