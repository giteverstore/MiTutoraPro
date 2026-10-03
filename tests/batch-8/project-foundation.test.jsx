import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { projectCatalog } from '../../src/projects/repositories/ProjectCatalog';
import { resolveProjectRuntime } from '../../src/projects/runtime/projectRuntimeRegistry';
import { ProjectProgressService } from '../../src/projects/services/ProjectProgressService';
import { ProjectStartDialog } from '../../src/projects/components/ProjectStartDialog';
import { ProjectGuideRenderer } from '../../src/projects/components/ProjectGuideRenderer';
import { ProjectContextualAI, createProjectAIContext } from '../../src/projects/components/ProjectContextualAI';
import { ProjectExporter } from '../../src/projects/export/ProjectExporter';
import { ProjectValidator } from '../../src/projects/validation/ProjectValidator';
import { createInitialProjectFiles } from '../../src/projects/workspace/projectWorkspaceFiles';
import { ProjectWorkspace } from '../../src/projects/pages/ProjectWorkspace';

vi.mock('../../src/compiler/CompilerProvider', () => ({ useCompilerManager: () => ({ execute: vi.fn() }) }));
vi.mock('../../src/components/EditorPlaceholder', () => ({ EditorPlaceholder: ({ editor, value, onChange }) => <textarea aria-label={editor.ariaLabel} value={value} onChange={(event) => onChange(event.target.value)} /> }));

const storage = new Map();
vi.stubGlobal('localStorage', {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
  clear: () => storage.clear(),
});

const project = projectCatalog.getProjectById('cli-task-manager');

beforeEach(() => storage.clear());
afterEach(cleanup);

describe('language-agnostic Projects foundation', () => {
  it('uses one project and guide skeleton for four runtime configurations', () => {
    expect(project.supportedLanguages).toEqual(['python', 'javascript', 'java', 'cpp']);
    expect(project.checkpoints).toHaveLength(5);
    expect(resolveProjectRuntime(project, 'python')).toMatchObject({ entrypoint: 'main.py', runCommand: 'python main.py' });
    expect(resolveProjectRuntime(project, 'javascript')).toMatchObject({ entrypoint: 'index.js', runCommand: 'node index.js' });
    expect(resolveProjectRuntime(project, 'cpp').filesystem).toMatchObject({ multiFile: true, mutationCapture: true, persistentRuns: true });
    expect(resolveProjectRuntime(project, 'java').filesystem).toMatchObject({ multiFile: true, mutationCapture: false, persistentRuns: false });
    expect(() => resolveProjectRuntime(project, 'rust')).toThrow(/not supported/);
    expect(project.difficulty).toBe('Beginner');
    expect(project.checkpoints.map(({ executionMode }) => executionMode)).toEqual(['run_or_terminal', 'run_or_terminal', 'terminal_only', 'run_or_terminal', 'terminal_only']);
  });

  it.each(['python', 'javascript', 'java', 'cpp'])('provides starter, runtime, snippets, and validation for %s', (languageId) => {
    const runtime = resolveProjectRuntime(project, languageId);
    const workspace = createInitialProjectFiles(project, {}, runtime);
    expect(workspace.entryFilePath).toBe(runtime.entrypoint);
    expect(workspace.files[runtime.entrypoint].content).toMatch(/Task Manager/);
    expect(runtime.runCommand).toBeTruthy();
    expect(project.languageContent[languageId]).toMatchObject({ taskModelHint: expect.any(String), taskModelCode: expect.any(String), inputCode: expect.any(String), persistenceHint: expect.any(String), persistenceCode: expect.any(String) });
    project.checkpoints.forEach((checkpoint) => {
      expect(checkpoint.guide.length).toBeGreaterThan(0);
      expect(checkpoint.requirements.length).toBeGreaterThan(0);
      expect(checkpoint.validation.type).toBe('project-checks');
      checkpoint.validation.checks.filter(({ type }) => type === 'source_matches').forEach((check) => expect(check.patternsByLanguage[languageId]?.length).toBeGreaterThan(0));
    });
  });

  it('renders shared guide blocks with runtime commands and language hints', () => {
    const runtime = resolveProjectRuntime(project, 'java');
    render(<ProjectGuideRenderer blocks={[...project.guide, { type: 'language-hint', key: 'taskModelHint' }]} project={project} runtime={runtime} />);
    expect(screen.getByText('java Main')).toBeInTheDocument();
    expect(screen.getByText(/A Task class is natural/)).toBeInTheDocument();
  });

  it('requires language confirmation before initializing an active project', () => {
    const onConfirm = vi.fn();
    render(<ProjectStartDialog open project={project} onClose={vi.fn()} onConfirm={onConfirm} />);
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    fireEvent.click(screen.getByRole('radio', { name: /JavaScript/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'Name your project' })).toBeInTheDocument();
    expect(screen.getByLabelText('Project name')).toHaveValue(project.title);
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: "Avi's Task Tracker" } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText(/resets checkpoint progress and workspace files/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Start Project' }));
    expect(onConfirm).toHaveBeenCalledWith('javascript', "Avi's Task Tracker");
  });

  it('rejects an empty learner project name', () => {
    const onConfirm = vi.fn();
    render(<ProjectStartDialog open project={project} onClose={vi.fn()} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Project name'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Project name is required');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('persists one active attempt and replaces it when language changes', () => {
    const service = new ProjectProgressService();
    service.resetForLanguage(project.id, 'python');
    service.saveWorkspace(project.id, { 'main.py': { path: 'main.py', content: 'print(1)' } }, 'main.py');
    service.completeCheckpoint(project.id, 'setup', 0, 5);
    expect(service.get(project.id)).toMatchObject({ languageId: 'python', currentCheckpoint: 1, completedCheckpoints: ['setup'] });
    service.resetForLanguage(project.id, 'java');
    expect(service.get(project.id)).toMatchObject({ languageId: 'java', currentCheckpoint: 0, completedCheckpoints: [], workspace: null });
  });

  it('exposes contextual AI metadata without a free-form composer', () => {
    const context = createProjectAIContext({ project, checkpoint: project.checkpoints[0], languageId: 'cpp', selectedContent: 'int main()', selectionType: 'user_code', guideContext: 'setup' });
    render(<ProjectContextualAI context={context} accessTier="PREMIUM" />);
    expect(screen.getByText('user code')).toBeInTheDocument();
    expect(screen.getByText('int main()')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('exports learner workspace files without internal project metadata', async () => {
    const archive = await new ProjectExporter().createWorkspaceArchive(project, { 'index.js': { path: 'index.js', content: 'console.log("done")' }, 'data/tasks.json': { path: 'data/tasks.json', content: '[]' }, 'Main.class': { path: 'Main.class', content: 'build artifact' } }, 'uint8array', "Avi's Task Tracker");
    const zip = await JSZip.loadAsync(archive);
    const names = Object.keys(zip.files);
    expect(names).toContain('avis-task-tracker/index.js');
    expect(names).toContain('avis-task-tracker/data/tasks.json');
    expect(names).toContain('avis-task-tracker/README.md');
    expect(names).not.toContain('avis-task-tracker/Main.class');
    expect(names.some((name) => /ycoders|metadata|progress/i.test(name))).toBe(false);
  });

  it.each(['python', 'javascript', 'java', 'cpp'])('exports a clean standalone %s workspace', async (languageId) => {
    const runtime = resolveProjectRuntime(project, languageId);
    const workspace = createInitialProjectFiles(project, {}, runtime);
    const archive = await new ProjectExporter().createWorkspaceArchive(project, workspace.files, 'uint8array');
    const zip = await JSZip.loadAsync(archive);
    expect(zip.file(`cli-task-manager/${runtime.entrypoint}`)).not.toBeNull();
    expect(zip.file('cli-task-manager/README.md')).not.toBeNull();
    expect(Object.keys(zip.files).some((name) => /progress|validation|checkpoint|ai-state/i.test(name))).toBe(false);
  });

  it('runs generic behavior checks and preserves hidden-check privacy', async () => {
    const compiler = { execute: vi.fn(async ({ projectFiles }) => ({ status: 'success', output: 'Task Manager Production task Read the guide Invalid Persisted task', errors: [], executionTimeMs: 2, filesystemSupported: true, projectFiles: [...(projectFiles ?? []), ...((projectFiles ?? []).some(({ path }) => path === 'tasks.json') ? [] : [{ path: 'tasks.json', content: '[]' }])] })) };
    const checkpointProject = { ...project, language: 'python', template: { sourcePath: 'main.py' }, validation: { type: 'project-checks', checks: [
      { id: 'run', name: 'Application starts', type: 'execution', outputIncludes: ['Task Manager'], visible: true },
      { id: 'model', name: 'Internal representation', type: 'source_matches', patternsByLanguage: { python: ['class\\s+Task', 'completed'] }, visible: false },
    ] } };
    const result = await new ProjectValidator(compiler).validateProject(checkpointProject, 'class Task:\n    completed = False');
    expect(result).toMatchObject({ passed: true, score: 100 });
    expect(result.tests[1]).toMatchObject({ name: 'Internal representation', passed: true, visible: false, message: 'Protected check passed' });
  });

  it('keeps Run visible and disabled on terminal-only checkpoints', () => {
    new ProjectProgressService().resetForLanguage(project.id, 'python');
    render(<ProjectWorkspace project={project} tier="PREMIUM" initialPageIndex={2} onBack={vi.fn()} onProgress={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Run' })).toHaveAttribute('title', 'Use the terminal for this checkpoint.');
    fireEvent.click(screen.getByRole('tab', { name: 'terminal' }));
    expect(screen.getByText('Use the terminal for this checkpoint.')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('python main.py')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Execute' })).not.toBeInTheDocument();
  });

  it('requires the complete production checklist before final completion', async () => {
    const compiler = { execute: vi.fn(async ({ projectFiles = [] }) => ({
      status: 'success', output: 'Task Manager Production task Read the guide Invalid Persisted task', errors: [], executionTimeMs: 2,
      filesystemSupported: true,
      projectFiles: projectFiles.some(({ path }) => path === 'tasks.json') ? projectFiles : [...projectFiles, { path: 'tasks.json', content: '[]' }],
    })) };
    const finalProject = { ...project, language: 'python', template: { sourcePath: 'main.py' }, validation: project.finalValidation };
    const completeSource = `
print('Task Manager Add Task List Tasks Complete Task Delete Task Exit')
tasks = []
tasks.append('one')
for task in tasks: print(task)
completed = True
tasks.pop()
json.dump(tasks, file)
json.load(file)
FileNotFoundError
print('Invalid choice')
break
`;
    const validationOptions = { files: { 'main.py': { path: 'main.py', content: completeSource } }, entrypoint: 'main.py', runtime: { runCommand: 'python main.py' } };
    const passing = await new ProjectValidator(compiler).validateProject(finalProject, completeSource, validationOptions);
    expect(passing.passed).toBe(true);
    expect(passing.tests.map(({ name }) => name)).toEqual(expect.arrayContaining(['Application starts', 'Tasks can be added', 'Task data is saved', 'Invalid choices are handled', 'Application exits cleanly']));
    const failing = await new ProjectValidator(compiler).validateProject(finalProject, 'print("Task Manager")', { ...validationOptions, files: { 'main.py': { path: 'main.py', content: 'print("Task Manager")' } } });
    expect(failing.passed).toBe(false);
    expect(failing.score).toBeLessThan(100);
  });
});
