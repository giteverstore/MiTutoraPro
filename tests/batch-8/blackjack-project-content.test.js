import { describe, expect, it } from 'vitest';
import { projectCatalog } from '../../src/projects/repositories/ProjectCatalog';
import { learnerProjectCatalog } from '../../src/projects/presentation/learnerProjectCatalog';
import { resolveProjectRuntime } from '../../src/projects/runtime/projectRuntimeRegistry';
import { createInitialProjectFiles } from '../../src/projects/workspace/projectWorkspaceFiles';
import { resolveProjectForRoute } from '../../src/projects/pages/ProjectsPage';

const project = projectCatalog.getProjectById('blackjack');

describe('Blackjack authoritative project content', () => {
  it('activates Blackjack while leaving the other preview projects coming soon', () => {
    const cards = learnerProjectCatalog(projectCatalog.getProjects(), []);
    const blackjack = cards.find(({ id }) => id === 'blackjack');
    expect(blackjack).toMatchObject({ difficulty: 'Beginner' });
    expect(blackjack).not.toHaveProperty('comingSoon');
    expect(cards.filter(({ comingSoon }) => comingSoon).map(({ id }) => id)).toEqual(['stone-paper-scissors', 'currency-converter']);
  });

  it('preserves the sixteen source-ordered tasks and source-backed overview content', () => {
    expect(project.supportedLanguages).toEqual(['python', 'cpp', 'java']);
    expect(project.checkpoints).toHaveLength(16);
    expect(project.checkpoints[0].title).toBe('Task 1: Welcome Message');
    expect(project.checkpoints[15].title).toBe('Task 16: Application Entry Point');
    expect(project.learningObjectives).toHaveLength(9);
    expect(project.prerequisites).toHaveLength(6);
    expect(project.finalValidation.checks).toHaveLength(16);
  });

  it.each([
    ['python', 'Blackjack.py', 'python Blackjack.py'],
    ['cpp', 'Blackjack.cpp', './blackjack'],
    ['java', 'Blackjack.java', 'java Blackjack'],
  ])('provides a runnable %s starter workspace', (languageId, entrypoint, runCommand) => {
    const runtime = resolveProjectRuntime(project, languageId);
    const workspace = createInitialProjectFiles(project, {}, runtime);
    expect(runtime).toMatchObject({ entrypoint, runCommand });
    expect(workspace.entryFilePath).toBe(entrypoint);
    expect(workspace.files[entrypoint].content).toContain('Welcome to Blackjack!');
    project.checkpoints.forEach((checkpoint) => {
      expect(checkpoint.guide.length).toBeGreaterThan(0);
      expect(checkpoint.validation.checks[0].patternsByLanguage[languageId]).toHaveLength(1);
    });
  });

  it('resolves through the bundled fallback when no published Blackjack exists', async () => {
    const publicationRepository = { resolveProject: async () => null };
    await expect(resolveProjectForRoute('blackjack', {}, publicationRepository)).resolves.toBe(project);
  });
});
