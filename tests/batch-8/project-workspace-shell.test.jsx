import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projectCatalog } from '../../src/projects/repositories/ProjectCatalog';
import { ProjectWorkspace, projectModelOwnerPrefix, projectModelPath } from '../../src/projects/pages/ProjectWorkspace';
import { projectProgressService } from '../../src/projects/services/ProjectProgressService';
import { ProjectValidator } from '../../src/projects/validation/ProjectValidator';

vi.mock('../../src/compiler/CompilerProvider', () => ({ useCompilerManager: () => ({}) }));
vi.mock('../../src/components/EditorPlaceholder', () => ({ EditorPlaceholder: ({ editor, value, onChange, onCursorPositionChange, workspacePreferences, loadingTheme, modelOwnerPrefix, retainedModelPaths }) => <textarea aria-label={editor.ariaLabel} data-font-size={workspacePreferences?.fontSize} data-tab-size={workspacePreferences?.tabSize} data-word-wrap={workspacePreferences?.wordWrap} data-monaco-theme={workspacePreferences?.monacoTheme} data-loading-theme={loadingTheme} data-model-path={editor.modelPath} data-model-owner-prefix={modelOwnerPrefix} data-retained-model-paths={retainedModelPaths?.join(',')} value={value} onChange={(event) => onChange(event.target.value)} onSelect={() => onCursorPositionChange?.({ lineNumber: 7, column: 3 })} /> }));
vi.mock('../../src/ai/AITutorWorkspace', () => ({ AITutorWorkspace: () => { const [draft, setDraft] = React.useState(''); return <label>AI Guide workspace<input aria-label="AI draft" value={draft} onChange={(event) => setDraft(event.target.value)} /></label>; } }));

const css = readFileSync(resolve(process.cwd(), 'src/styles/pages/projects.css'), 'utf8');
const project = projectCatalog.getProjects()[0];
const storage = new Map();
beforeEach(() => { storage.clear(); vi.stubGlobal('localStorage', { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key), clear: () => storage.clear() }); });
afterEach(cleanup);

function selectElementText(element) {
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  Object.defineProperty(range, 'getBoundingClientRect', { value: () => ({ left: 240, right: 360, top: 180, bottom: 204, width: 120, height: 24 }) });
  selection.removeAllRanges();
  selection.addRange(range);
  fireEvent.mouseUp(element.closest('.project-guide-content'));
}

describe('immersive project workspace shell', () => {
  it('names models by encoded project/file identity so projects and renamed paths cannot collide', () => {
    expect(projectModelOwnerPrefix('project / one')).toBe('ycoders-project://project%20%2F%20one/');
    expect(projectModelPath('project / one', 'src/my file.py')).toBe('ycoders-project://project%20%2F%20one/src/my%20file.py');
    expect(projectModelPath('project-a', 'main.py')).not.toBe(projectModelPath('project-b', 'main.py'));
  });

  it('renders the VS Code-inspired structure without AppShell or public footer chrome', () => {
    const { container } = render(<ProjectWorkspace project={project} tier="PREMIUM" onBack={vi.fn()} onProgress={vi.fn()} />);
    expect(container.querySelector('.project-ide-shell')).toBeInTheDocument();
    expect(container.querySelector('.app-shell')).not.toBeInTheDocument();
    expect(container.querySelector('.app-footer')).not.toBeInTheDocument();
    expect(screen.getByText(project.title, { selector: '.project-ide-topbar strong' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Explorer and checkpoints' })).toBeInTheDocument();
    expect(container.querySelector('.project-files-section')).toBeInTheDocument();
    expect(container.querySelector('.project-checkpoints-section')).toBeInTheDocument();
    expect(container.querySelector('.project-files-section').compareDocumentPosition(container.querySelector('.project-checkpoints-section')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', { name: project.template.sourcePath.split('/').at(-1) })).toBeInTheDocument();
    expect(screen.getByLabelText(`${project.title} implementation editor`)).toBeInTheDocument();
    expect(screen.getByLabelText(`${project.title} implementation editor`)).toHaveAttribute('data-model-owner-prefix', projectModelOwnerPrefix(project.id));
    expect(screen.getByLabelText(`${project.title} implementation editor`)).toHaveAttribute('data-retained-model-paths', projectModelPath(project.id, project.template.sourcePath));
    for (const tab of ['terminal', 'output', 'problems', 'tests']) expect(screen.getByRole('tab', { name: tab })).toBeInTheDocument();
  });

  it('keeps save failures actionable and explains revision conflicts', () => {
    render(<ProjectWorkspace project={project} tier="PREMIUM" onBack={vi.fn()} onProgress={vi.fn()} />);
    act(() => projectProgressService.emit(project.id, 'error', new Error('offline')));
    expect(screen.getByRole('alert')).toHaveTextContent('Save failed');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();

    act(() => projectProgressService.emit(project.id, 'conflict', new Error('stale revision')));
    expect(screen.getByRole('alert')).toHaveTextContent('Conflict detected');
    expect(screen.getByRole('button', { name: 'Reload' }).closest('.project-cloud-save-control')).toHaveAttribute('title', 'A newer version of this project was saved elsewhere. Reload to continue with the latest version.');
    act(() => projectProgressService.emit(project.id, 'saved'));
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
    expect(projectProgressService.get(project.id).currentCheckpoint).toBe(0);
  });

  it('collapses optional left and bottom panels while keeping Guide and AI permanently visible', () => {
    const { container } = render(<ProjectWorkspace project={project} tier="PREMIUM" onBack={vi.fn()} onProgress={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Files and checkpoints' }));
    fireEvent.click(screen.getByRole('button', { name: 'Collapse bottom panel' }));
    expect(container.querySelector('.project-ide-shell')).toHaveClass('is-explorer-collapsed', 'is-bottom-collapsed');
    expect(container.querySelector('.project-ide-shell')).not.toHaveClass('is-guide-collapsed');
    expect(screen.getByLabelText(`${project.title} implementation editor`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Files and checkpoints' }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore bottom panel' }));
    expect(screen.getByRole('complementary', { name: 'Explorer and checkpoints' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Guide and AI' })).toBeInTheDocument();
  });

  it('removes active workspace resize listeners when navigation unmounts mid-drag', () => {
    const remove = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<ProjectWorkspace project={project} tier="PREMIUM" onBack={vi.fn()} onProgress={vi.fn()} />);
    fireEvent.pointerDown(screen.getByRole('separator', { name: 'Resize left panel' }), { clientX: 280 });
    unmount();
    expect(remove).toHaveBeenCalledWith('pointermove', expect.any(Function));
    expect(remove).toHaveBeenCalledWith('pointerup', expect.any(Function));
  });

  it('exposes keyboard-operable splitters and semantic file tabs', () => {
    render(<ProjectWorkspace project={project} tier="PREMIUM" onBack={vi.fn()} onProgress={vi.fn()} />);
    const left = screen.getByRole('separator', { name: 'Resize left panel' });
    const right = screen.getByRole('separator', { name: 'Resize Guide and AI' });
    const bottom = screen.getByRole('separator', { name: 'Resize bottom panel' });
    expect(left).toHaveAttribute('tabindex', '0');
    expect(left).toHaveAttribute('aria-valuenow', '280');
    fireEvent.keyDown(left, { key: 'ArrowRight' });
    expect(left).toHaveAttribute('aria-valuenow', '290');
    fireEvent.keyDown(right, { key: 'ArrowLeft' });
    expect(right).toHaveAttribute('aria-valuenow', right.getAttribute('aria-valuemax'));
    fireEvent.keyDown(bottom, { key: 'ArrowUp' });
    expect(bottom).toHaveAttribute('aria-valuenow', '200');
    expect(screen.getByRole('toolbar', { name: 'Open project files' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: project.template.sourcePath.split('/').at(-1) })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'output' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'problems' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Guide' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'AI' })).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps Guide active after text selection and opens AI only after the contextual action', async () => {
    const { container } = render(<ProjectWorkspace project={project} tier="PREMIUM" onBack={vi.fn()} onProgress={vi.fn()} />);
    const guideText = container.querySelector('.project-guide-content h2');
    selectElementText(guideText);

    expect(screen.getByRole('tab', { name: 'Guide' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'AI' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('button', { name: 'Ask AI' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }));
    expect(screen.getByRole('tab', { name: 'AI' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('guide text')).toBeInTheDocument();
    expect(screen.getByText(guideText.textContent, { selector: '.project-ai-context-preview pre' })).toBeInTheDocument();
  });

  it('captures Guide code before explicitly switching to AI', () => {
    const { container } = render(<ProjectWorkspace project={project} tier="PREMIUM" onBack={vi.fn()} onProgress={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    const code = container.querySelector('.project-guide-content code');
    selectElementText(code);

    expect(screen.getByRole('tab', { name: 'Guide' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Ask AI' }));
    expect(screen.getByRole('tab', { name: 'AI' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('guide code')).toBeInTheDocument();
    expect(screen.getByText(code.textContent, { selector: '.project-ai-context-preview pre' })).toBeInTheDocument();
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

  it('keeps Explorer on the left and keeps the contextual AI panel mounted without a composer', () => {
    const { container } = render(<ProjectWorkspace project={project} tier="PREMIUM" onBack={vi.fn()} onProgress={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Project Guide' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'AI' }));
    expect(screen.getByText('No context selected')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'AI draft' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Guide' }));
    fireEvent.click(screen.getByRole('tab', { name: 'AI' }));
    expect(screen.getByText('No context selected')).toBeInTheDocument();
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

  it('removes the redundant top-bar summary and limits the status-bar selector to supported languages', () => {
    const { container } = render(<ProjectWorkspace project={project} tier="PREMIUM" onBack={vi.fn()} onProgress={vi.fn()} />);
    expect(container.querySelector('.project-ide-topbar')).not.toHaveTextContent('Python');
    expect(container.querySelector('.project-checkpoint-summary')).not.toBeInTheDocument();
    expect(container.querySelector('.project-ide-statusbar')).toHaveTextContent('Python');
    const editor = screen.getByLabelText(`${project.title} implementation editor`);
    fireEvent.change(editor, { target: { value: 'learner source stays' } });
    fireEvent.click(screen.getByRole('button', { name: 'Python' }));
    expect(screen.getAllByRole('radio')).toHaveLength(1);
    expect(screen.getByRole('radio', { name: 'Python' })).toBeChecked();
    expect(editor).toHaveValue('learner source stays');
  });

  it('uses the same validator path for Run and an allowed terminal command', async () => {
    const validation = vi.spyOn(ProjectValidator.prototype, 'validateProject').mockResolvedValue({ passed: true, tests: [], score: 100, output: 'shared execution output', errors: [] });
    render(<ProjectWorkspace project={project} tier="PREMIUM" initialPageIndex={3} onBack={vi.fn()} onProgress={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(validation).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('tab', { name: 'terminal' }));
    const input = screen.getByRole('textbox', { name: 'Project terminal command' });
    fireEvent.change(input, { target: { value: '  python   main.py  ' } });
    fireEvent.submit(input.closest('form'));
    await waitFor(() => expect(validation).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('log')).toHaveTextContent('$ python main.py');
    expect(screen.getByRole('log')).toHaveTextContent('shared execution output');
    await waitFor(() => expect(input).toHaveFocus());
    validation.mockRestore();
  });

  it('rejects unsupported terminal commands without execution and keeps ephemeral command history', () => {
    const validation = vi.spyOn(ProjectValidator.prototype, 'validateProject');
    render(<ProjectWorkspace project={project} tier="PREMIUM" initialPageIndex={3} onBack={vi.fn()} onProgress={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: 'terminal' }));
    const input = screen.getByRole('textbox', { name: 'Project terminal command' });
    fireEvent.change(input, { target: { value: 'pip install unsafe-package' } });
    fireEvent.submit(input.closest('form'));
    expect(validation).not.toHaveBeenCalled();
    expect(screen.getByRole('log')).toHaveTextContent('Command not available in this project.');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('pip install unsafe-package');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveValue('');
    validation.mockRestore();
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
    expect(css).toContain('height: 100dvh;');
    expect(css).toContain('grid-template-rows: minmax(15rem,1fr) 4px clamp(7.5rem,var(--project-bottom-height),35dvh);');
    expect(css).toContain('grid-template-rows: 2.5rem minmax(12.5rem,1fr);');
    expect(css).toContain('.project-editor-pane .editor-window { grid-row: 2; width: 100%; height: auto;');
    expect(css).toContain('.project-editor-pane .monaco-editor-shell { width: 100%; height: 100%;');
    expect(css).toContain('.project-ide-topbar .project-run-button');
    expect(css).toContain('.project-workspace-navigation');
    expect(css).toContain('--project-surface: #161b22;');
    expect(css).toContain('.project-language-backdrop.is-dark');
    expect(css).toContain('@media (max-width: 900px)');
    expect(css).toContain('.project-ide-shell.is-explorer-collapsed .project-ide-main { grid-template-columns: var(--project-ide-rail) minmax(0,1fr); }');
    expect(css).toContain('@media (max-width: 600px)');
    expect(css).toContain('.project-explorer-panel,.project-guide-panel { left: 0; grid-column: 1; width: 100%; }');
    expect(css).toContain('grid-column: 1; width: auto; height: min(45dvh,var(--project-bottom-height));');
    expect(css).toContain('.project-ai-panel { position: absolute;');
    expect(css).toContain('.project-activity-bar { grid-column: 1; grid-row: 2; flex-direction: row;');
    expect(css).toContain('minmax(20rem,1fr) 4px var(--project-guide-width)');
    expect(css).toContain('.project-ai-conversation-scroll { min-width: 0; min-height: 0;');
    expect(css).toContain('overflow-y: auto; overscroll-behavior: contain;');
    expect(css).toContain('.project-ai-mode.is-active { display: block; min-height: 0; overflow: hidden; }');
    expect(css).toContain('.project-guide-mode.is-active { display: grid; grid-template-rows: minmax(0,1fr) auto; }');
  });
});
