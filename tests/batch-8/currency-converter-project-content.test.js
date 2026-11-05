import { describe, expect, it } from 'vitest';
import { projectCatalog } from '../../src/projects/repositories/ProjectCatalog';
import { learnerProjectCatalog } from '../../src/projects/presentation/learnerProjectCatalog';
import { resolveProjectRuntime } from '../../src/projects/runtime/projectRuntimeRegistry';
import { createInitialProjectFiles } from '../../src/projects/workspace/projectWorkspaceFiles';
import { resolveProjectForRoute } from '../../src/projects/pages/ProjectsPage';
import { createProjectAIContext } from '../../src/projects/components/ProjectContextualAI';

const project = projectCatalog.getProjectById('currency-converter');

describe('Currency Converter authoritative project content', () => {
  it('activates the final approved catalog project', () => {
    const cards = learnerProjectCatalog(projectCatalog.getProjects(), []);
    for (const id of ['blackjack', 'hangman', 'stone-paper-scissors', 'currency-converter']) expect(cards.find((card) => card.id === id)).not.toHaveProperty('comingSoon');
    expect(cards.find(({ id }) => id === 'currency-converter')).toMatchObject({ title: 'Multi-Unit & Currency Converter CLI', difficulty: 'Beginner', estimatedMinutes: 0 });
    expect(cards.filter(({ comingSoon }) => comingSoon)).toEqual([]);
  });

  it('maps all twelve source tasks and fixed local conversion contract', () => {
    expect(project.supportedLanguages).toEqual(['python', 'cpp', 'java']);
    expect(project.checkpoints).toHaveLength(12);
    expect(project.checkpoints.map(({ id }) => id)).toEqual(Array.from({ length: 12 }, (_, index) => `currency-converter-task-${index + 1}`));
    expect(project.checkpoints[0].title).toBe('Task 1: Welcome Header');
    expect(project.checkpoints[11].title).toBe('Task 12: Menu and Application Assembly');
    expect(project.learningObjectives).toHaveLength(7);
    expect(project.prerequisites).toHaveLength(6);
    expect(project.finalValidation.checks).toHaveLength(12);
    expect(JSON.stringify(project)).not.toMatch(/https?:|api[_-]?key/i);
  });

  it.each([['python', 'Converter.py', 'python Converter.py'], ['cpp', 'Converter.cpp', './Converter'], ['java', 'Converter.java', 'java Converter']])('initializes the %s starter workspace', (languageId, entrypoint, runCommand) => {
    const runtime = resolveProjectRuntime(project, languageId);
    const workspace = createInitialProjectFiles(project, {}, runtime);
    expect(runtime).toMatchObject({ entrypoint, runCommand });
    expect(workspace.entryFilePath).toBe(entrypoint);
    expect(workspace.files[entrypoint].content).toContain('Welcome to Multi-Unit & Currency Converter CLI!');
    project.checkpoints.forEach((checkpoint) => expect(checkpoint.validation.checks[0].patternsByLanguage[languageId]).toHaveLength(1));
  });

  it('uses bundled route resolution and standard contextual AI', async () => {
    await expect(resolveProjectForRoute('currency-converter', {}, { resolveProject: async () => null })).resolves.toBe(project);
    expect(createProjectAIContext({ project, checkpoint: project.checkpoints[0], languageId: 'java', selectedContent: 'printWelcome()', selectionType: 'user_code', guideContext: 'welcome' })).toMatchObject({ project: { id: 'currency-converter' }, checkpoint: { id: 'currency-converter-task-1' }, languageId: 'java', tutorScope: { activityId: 'currency-converter-task-1' } });
  });
});
