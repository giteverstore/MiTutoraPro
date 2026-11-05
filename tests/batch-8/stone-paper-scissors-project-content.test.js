import { describe, expect, it } from 'vitest';
import { projectCatalog } from '../../src/projects/repositories/ProjectCatalog';
import { learnerProjectCatalog } from '../../src/projects/presentation/learnerProjectCatalog';
import { resolveProjectRuntime } from '../../src/projects/runtime/projectRuntimeRegistry';
import { createInitialProjectFiles } from '../../src/projects/workspace/projectWorkspaceFiles';
import { resolveProjectForRoute } from '../../src/projects/pages/ProjectsPage';
import { createProjectAIContext } from '../../src/projects/components/ProjectContextualAI';

const project = projectCatalog.getProjectById('stone-paper-scissors');

describe('Stone Paper Scissors authoritative project content', () => {
  it('activates Stone Paper Scissors while preserving neighboring availability', () => {
    const cards = learnerProjectCatalog(projectCatalog.getProjects(), []);
    expect(cards.find(({ id }) => id === 'blackjack')).not.toHaveProperty('comingSoon');
    expect(cards.find(({ id }) => id === 'hangman')).not.toHaveProperty('comingSoon');
    expect(cards.find(({ id }) => id === 'stone-paper-scissors')).toMatchObject({ difficulty: 'Beginner', estimatedMinutes: 0 });
    expect(cards.find(({ id }) => id === 'stone-paper-scissors')).not.toHaveProperty('comingSoon');
    expect(cards.filter(({ comingSoon }) => comingSoon).map(({ id }) => id)).toEqual(['currency-converter']);
  });

  it('maps all seventeen source tasks and overview facts', () => {
    expect(project.supportedLanguages).toEqual(['python', 'cpp', 'java']);
    expect(project.checkpoints).toHaveLength(17);
    expect(project.checkpoints.map(({ id }) => id)).toEqual(Array.from({ length: 17 }, (_, index) => `stone-paper-scissors-task-${index + 1}`));
    expect(project.checkpoints[0].title).toBe('Task 1: Welcome Banner');
    expect(project.checkpoints[16].title).toBe('Task 17: Application Entry Point');
    expect(project.learningObjectives).toHaveLength(8);
    expect(project.prerequisites).toHaveLength(6);
    expect(project.finalValidation.checks).toHaveLength(17);
  });

  it.each([['python', 'StonePaperScissors.py', 'python StonePaperScissors.py'], ['cpp', 'StonePaperScissors.cpp', './stone-paper-scissors'], ['java', 'StonePaperScissors.java', 'java StonePaperScissors']])('initializes the %s starter workspace', (languageId, entrypoint, runCommand) => {
    const runtime = resolveProjectRuntime(project, languageId);
    const workspace = createInitialProjectFiles(project, {}, runtime);
    expect(runtime).toMatchObject({ entrypoint, runCommand });
    expect(workspace.entryFilePath).toBe(entrypoint);
    expect(workspace.files[entrypoint].content).toContain('Welcome to Stone Paper Scissors!');
    project.checkpoints.forEach((checkpoint) => expect(checkpoint.validation.checks[0].patternsByLanguage[languageId]).toHaveLength(1));
  });

  it('uses bundled route resolution and standard contextual AI', async () => {
    await expect(resolveProjectForRoute('stone-paper-scissors', {}, { resolveProject: async () => null })).resolves.toBe(project);
    expect(createProjectAIContext({ project, checkpoint: project.checkpoints[0], languageId: 'cpp', selectedContent: 'printWelcome()', selectionType: 'user_code', guideContext: 'welcome' })).toMatchObject({ project: { id: 'stone-paper-scissors' }, checkpoint: { id: 'stone-paper-scissors-task-1' }, languageId: 'cpp', tutorScope: { activityId: 'stone-paper-scissors-task-1' } });
  });
});
