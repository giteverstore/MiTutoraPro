import { describe, expect, it } from 'vitest';
import { projectCatalog } from '../../src/projects/repositories/ProjectCatalog';
import { learnerProjectCatalog } from '../../src/projects/presentation/learnerProjectCatalog';
import { resolveProjectRuntime } from '../../src/projects/runtime/projectRuntimeRegistry';
import { createInitialProjectFiles } from '../../src/projects/workspace/projectWorkspaceFiles';
import { resolveProjectForRoute } from '../../src/projects/pages/ProjectsPage';
import { createProjectAIContext } from '../../src/projects/components/ProjectContextualAI';

const project = projectCatalog.getProjectById('hangman');

describe('Hangman authoritative project content', () => {
  it('activates only Hangman among the remaining preview projects', () => {
    const cards = learnerProjectCatalog(projectCatalog.getProjects(), []);
    expect(cards.find(({ id }) => id === 'blackjack')).not.toHaveProperty('comingSoon');
    expect(cards.find(({ id }) => id === 'hangman')).toMatchObject({ difficulty: 'Beginner', estimatedMinutes: 0 });
    expect(cards.find(({ id }) => id === 'hangman')).not.toHaveProperty('comingSoon');
    expect(cards.filter(({ comingSoon }) => comingSoon)).toEqual([]);
  });

  it('maps all seventeen source tasks and overview facts', () => {
    expect(project.supportedLanguages).toEqual(['python', 'cpp', 'java']);
    expect(project.checkpoints).toHaveLength(17);
    expect(project.checkpoints.map(({ id }) => id)).toEqual(Array.from({ length: 17 }, (_, index) => `hangman-task-${index + 1}`));
    expect(project.checkpoints[0].title).toBe('Task 1: Welcome Banner');
    expect(project.checkpoints[16].title).toBe('Task 17: Application Entry Point');
    expect(project.learningObjectives).toHaveLength(8);
    expect(project.prerequisites).toHaveLength(4);
    expect(project.finalValidation.checks).toHaveLength(17);
  });

  it.each([['python', 'Hangman.py', 'python Hangman.py'], ['cpp', 'Hangman.cpp', './hangman'], ['java', 'Hangman.java', 'java Hangman']])('initializes the %s starter workspace', (languageId, entrypoint, runCommand) => {
    const runtime = resolveProjectRuntime(project, languageId);
    const workspace = createInitialProjectFiles(project, {}, runtime);
    expect(runtime).toMatchObject({ entrypoint, runCommand });
    expect(workspace.entryFilePath).toBe(entrypoint);
    expect(workspace.files[entrypoint].content).toContain('Welcome to Hangman!');
    project.checkpoints.forEach((checkpoint) => expect(checkpoint.validation.checks[0].patternsByLanguage[languageId]).toHaveLength(1));
  });

  it('supports bundled route resolution and standard contextual AI', async () => {
    await expect(resolveProjectForRoute('hangman', {}, { resolveProject: async () => null })).resolves.toBe(project);
    expect(createProjectAIContext({ project, checkpoint: project.checkpoints[0], languageId: 'python', selectedContent: 'print_welcome()', selectionType: 'user_code', guideContext: 'welcome' })).toMatchObject({ project: { id: 'hangman' }, languageId: 'python', checkpoint: { id: 'hangman-task-1' }, tutorScope: { activityId: 'hangman-task-1' } });
  });
});
