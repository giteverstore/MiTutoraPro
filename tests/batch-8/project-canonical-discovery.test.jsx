import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProjectAIContext } from '../../src/projects/ai/projectAIContext.js';
import { ProjectGuideRenderer } from '../../src/projects/components/ProjectGuideRenderer.jsx';
import { ProjectWorkspace } from '../../src/projects/pages/ProjectWorkspace.jsx';
import { mergeProjectCatalog, ProjectsPage, resolveProjectForRoute } from '../../src/projects/pages/ProjectsPage.jsx';
import { adaptPublishedProject, PublishedContentRepository } from '../../src/projects/repositories/PublishedContentRepository.js';
import { resolveProjectRuntime } from '../../src/projects/runtime/projectRuntimeRegistry.js';
import { deriveTaskProgress } from '../../src/projects/services/ProjectTaskProgression.js';
import { createInitialProjectFiles } from '../../src/projects/workspace/projectWorkspaceFiles.js';
import { createProjectMentorProviderRequest, normalizeProjectMentorRequest } from '../../server/ai/project/projectMentorRequest.js';
import { validateContent } from '../../shared/content/validation.js';

vi.mock('../../src/compiler/CompilerProvider', () => ({ useCompilerManager: () => ({}) }));
vi.mock('../../src/components/EditorPlaceholder', () => ({ EditorPlaceholder: ({ editor }) => <div aria-label={editor.ariaLabel}>Editor</div> }));

const storage = new Map();
vi.stubGlobal('localStorage', {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
});
beforeEach(() => storage.clear());

const languages = ['python', 'cpp', 'java'];
const starters = {
  python: { entrypoint: 'bingo.py', runtimeId: 'python', files: [{ path: 'bingo.py', content: '' }] },
  cpp: { entrypoint: 'main.cpp', runtimeId: 'cpp', files: [{ path: 'main.cpp', content: '' }] },
  java: { entrypoint: 'Main.java', runtimeId: 'java', files: [{ path: 'Main.java', content: '' }] },
};
const guideBlock = (number) => ({ blockId: `page-${number}`, type: 'paragraph', text: `Guide page ${number}` });
const checkpoints = Array.from({ length: 8 }, (_, index) => {
  const count = index === 7 ? 3 : 2;
  const tasks = Array.from({ length: count }, (_, taskIndex) => {
    const number = index * 2 + taskIndex + 1;
    return {
      taskId: `bingo-task-${number}`, order: taskIndex + 1, title: `Task ${number}`,
      objective: `Build task ${number}`, why: 'Learn this behavior.', expectedBehavior: ['Expected behavior'],
      blocks: [guideBlock(number)], implementationContractIds: [], validators: [],
      mentor: { hints: [
        { hintId: `hint-${number}`, level: 'hint', text: `Hint for task ${number}` },
        { hintId: `deeper-${number}`, level: 'deeper_hint', text: 'Deeper hint' },
        { hintId: `example-${number}`, level: 'focused_example', text: 'Unrevealed focused example', requiresExplicitReveal: true },
        { hintId: `reference-${number}`, level: 'reference', text: 'SECRET_REFERENCE_SOLUTION', requiresExplicitReveal: true },
      ], revealPolicy: { referenceAllowed: false } },
    };
  });
  return {
    checkpointId: `bingo-c${index + 1}`, order: index + 1, title: `Checkpoint ${index + 1}`,
    summary: `Checkpoint ${index + 1} objective`, blocks: [guideBlock(index + 18)],
    tasks, validators: [], completionBlocks: [guideBlock(index + 30)],
  };
});
const content = {
  projectId: 'bingo', title: 'Bingo', description: 'Build a terminal Bingo game.',
  difficulty: 'Intermediate', category: 'Guided coding project', estimatedMinutes: 600,
  learningOutcomes: ['Build a game'], tags: [], prerequisites: [], supportedLanguages: languages, starterWorkspaces: starters,
  implementationContracts: [], checkpoints, finalValidators: [],
  completionBlocks: Array.from({ length: 5 }, (_, index) => guideBlock(index + 62)),
};
const published = adaptPublishedProject(content, 1);
const document = { contentId: 'bingo', contentType: 'PROJECT', schemaVersion: '1.0.0', version: 1, status: 'published', locale: 'en', metadata: {}, content };
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
afterEach(cleanup);

describe('canonical Project learner discovery', () => {
  it('uses a valid canonical Project fixture', () => {
    expect(validateContent(document)).toMatchObject({ valid: true, errors: [] });
  });
  it('lists only published ACTIVE Projects and loads the canonical artifact', async () => {
    const fetcher = vi.fn(async (url) => url.endsWith('?contentType=PROJECT')
      ? json({ items: [{ contentId: 'bingo', activeVersion: 1 }] })
      : json({ document }));
    const repository = new PublishedContentRepository({ fetcher });
    expect((await repository.listProjects()).map(({ id, contentVersion }) => [id, contentVersion])).toEqual([['bingo', 1]]);
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual(['/api/admin-content/public?contentType=PROJECT', '/api/admin-content/public/bingo']);
    const unpublished = new PublishedContentRepository({ fetcher: async () => json({ items: [] }) });
    expect(await unpublished.listProjects()).toEqual([]);
  });

  it('rejects a non-Project artifact returned for a Project route', async () => {
    const repository = new PublishedContentRepository({ fetcher: async () => json({ document: { ...document, contentType: 'COURSE' } }) });
    await expect(repository.resolveProject('bingo')).rejects.toMatchObject({ code: 'content/artifact-corrupt' });
  });

  it('requests an exact published version when resuming pinned progress', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ document }));
    const repository = new PublishedContentRepository({ fetcher });
    expect((await repository.resumeProject('bingo', 1)).project).toMatchObject({ id: 'bingo', contentVersion: 1 });
    expect(fetcher).toHaveBeenCalledWith('/api/admin-content/public/bingo/1');
  });

  it('gives canonical projects duplicate-ID precedence without removing bundled projects', () => {
    const bundled = [{ id: 'bingo', title: 'Old Bingo' }, { id: 'calculator', title: 'Calculator' }];
    expect(mergeProjectCatalog(bundled, [published]).map(({ id, title }) => [id, title]))
      .toEqual([['calculator', 'Calculator'], ['bingo', 'Bingo']]);
  });

  it('resolves direct routes from ACTIVE, exact pinned version, bundled fallback, or fails closed', async () => {
    const repository = {
      resolveProject: vi.fn(async (id) => id === 'bingo' ? { project: published } : null),
      resumeProject: vi.fn(async (_, version) => ({ project: { ...published, contentVersion: version } })),
    };
    const bundled = { getProjectById: (id) => id === 'calculator' ? { id } : null };
    expect(await resolveProjectForRoute('bingo', {}, repository, bundled)).toBe(published);
    expect(await resolveProjectForRoute('bingo', { contentVersion: 2 }, repository, bundled)).toMatchObject({ contentVersion: 2 });
    expect(repository.resumeProject).toHaveBeenCalledWith('bingo', 2);
    expect(await resolveProjectForRoute('calculator', {}, repository, bundled)).toEqual({ id: 'calculator' });
    expect(await resolveProjectForRoute('missing', {}, repository, bundled)).toBeNull();
    repository.resolveProject.mockRejectedValueOnce(new Error('delivery failure'));
    await expect(resolveProjectForRoute('bingo', {}, repository, bundled)).rejects.toThrow('delivery failure');
  });

  it('opens /projects/bingo without requiring a bundled Bingo record', async () => {
    const repository = {
      listProjects: vi.fn().mockResolvedValue([published]),
      resolveProject: vi.fn().mockResolvedValue({ project: published }),
      resumeProject: vi.fn(),
    };
    render(<ProjectsPage browseOnly initialProjectId="bingo" publishedRepository={repository} />);
    expect(await screen.findByRole('heading', { name: 'Bingo' })).toBeInTheDocument();
    await waitFor(() => expect(repository.resolveProject).toHaveBeenCalledWith('bingo'));
  });

  it('fails closed for an unknown direct Project route', async () => {
    const repository = { listProjects: vi.fn().mockResolvedValue([]), resolveProject: vi.fn().mockResolvedValue(null) };
    render(<ProjectsPage browseOnly initialProjectId="not-a-project" publishedRepository={repository} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Project not found.');
    expect(screen.queryByRole('heading', { name: 'Bingo' })).not.toBeInTheDocument();
  });

  it('keeps eight checkpoints, seventeen tasks, all Guide blocks, and empty language starters', () => {
    expect(published.checkpoints).toHaveLength(8);
    expect(published.checkpoints.map(({ tasks }) => tasks.length)).toEqual([2, 2, 2, 2, 2, 2, 2, 3]);
    expect(deriveTaskProgress(published).checkpoints).toHaveLength(8);
    expect(published.completionBlocks.map(({ blockId }) => blockId)).toEqual(['page-62', 'page-63', 'page-64', 'page-65', 'page-66']);
    render(<ProjectGuideRenderer blocks={published.completionBlocks} project={published} />);
    expect(screen.getByText('Guide page 66')).toBeInTheDocument();
    for (const [language, filename] of [['python', 'bingo.py'], ['cpp', 'main.cpp'], ['java', 'Main.java']]) {
      const runtime = resolveProjectRuntime(published, language);
      const workspace = createInitialProjectFiles(published, {}, runtime);
      expect(runtime.id).toBe(language);
      expect(runtime.entrypoint).toBe(filename);
      expect(workspace.files[filename].content).toBe('');
    }
  });

  it('renders the selected Guide language rather than always falling back to Python', () => {
    const variant = [{ blockId: 'language-example', type: 'paragraph', text: { variants: { python: 'Python guide', cpp: 'C++ guide', java: 'Java guide' }, requiredLanguages: languages } }];
    render(<ProjectGuideRenderer blocks={variant} project={{ ...published, language: 'java', runtime: 'java' }} />);
    expect(screen.getByText('Java guide')).toBeInTheDocument();
    expect(screen.queryByText('Python guide')).not.toBeInTheDocument();
  });

  it('keeps locked canonical checkpoints behind the existing Premium boundary', () => {
    render(<ProjectWorkspace project={published} tier="FREE" initialPageIndex={3} onBack={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled();
    expect(screen.getByLabelText('Project editor locked')).toBeInTheDocument();
    expect(screen.queryByText('Guide page 7')).not.toBeInTheDocument();
  });

  it.each([3, 8, 12, 16])('sends only bounded current-task AI context for task %i', (number) => {
    const checkpoint = published.checkpoints.find(({ tasks }) => tasks.some(({ taskId }) => taskId === `bingo-task-${number}`));
    const context = createProjectAIContext({
      project: published, checkpoint, taskId: `bingo-task-${number}`, languageId: 'python',
      selectionType: 'guide_text', selectedContent: 'Selected guide text',
    });
    expect(context).toMatchObject({ project: { id: 'bingo', version: 1 }, mentor: { taskId: `bingo-task-${number}`, objective: `Build task ${number}` } });
    expect(context.mentor.hints.map(({ level }) => level)).toEqual(['hint', 'deeper_hint']);
    const request = normalizeProjectMentorRequest({ requestType: 'project-questions', context: { ...context, futureTasks: ['SECRET_FUTURE_TASK'], fullGuide: 'SECRET_FULL_GUIDE', workspace: 'SECRET_WORKSPACE', mentor: { ...context.mentor, referenceSolution: 'SECRET_REFERENCE_SOLUTION' } } });
    const forwarded = createProjectMentorProviderRequest(request).userContent;
    expect(forwarded).toContain(`bingo-task-${number}`);
    expect(forwarded).not.toMatch(/SECRET_|focused_example|referenceSolution/);
  });

  it('rejects reference hints, keeps ordinary Project AI unchanged, and never logs secrets', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const ordinary = { requestType: 'project-questions', context: {
      project: { id: 'calculator', title: 'Calculator', difficulty: 'Easy' },
      checkpoint: { id: 'start', title: 'Start' }, languageId: 'python',
      selectionType: 'guide_text', selectedContent: 'Select this text', guideContext: '',
    } };
    expect(normalizeProjectMentorRequest(ordinary).context).not.toHaveProperty('mentor');
    const forbidden = { ...ordinary, context: { ...ordinary.context, mentor: { taskId: 'task-1', objective: 'Objective', hints: [{ level: 'reference', text: 'SECRET_REFERENCE_SOLUTION' }] } } };
    expect(() => normalizeProjectMentorRequest(forbidden)).toThrow(/Reference or unrevealed/);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
