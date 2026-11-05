import { describe, expect, it } from 'vitest';
import { projectCatalog } from '../../src/projects/repositories/ProjectCatalog';
import { buildProjectSourcePages } from '../../src/projects/guide/projectSourcePages';

const contracts = [
  ['blackjack', 16, ['Blackjack Mechanics & Point Scoring', 'Chronological Flow & Component Architecture', 'Dynamic Aces & Hidden Information']],
  ['hangman', 17, ['Core Rules & Multi-Stage Gallows Mechanics', 'Character Masking & Reveal Pipeline', 'Defensive Input & Game State']],
  ['stone-paper-scissors', 17, ['Move Hierarchy & Win Justifications', 'Chronological Flow & Class Architecture', 'Players, System Opponent & Game State']],
  ['currency-converter', 12, ['Conversion Categories & Physical Boundaries', 'The Base Unit Pivot Pattern', 'Chronological Flow & Component Responsibilities']],
];

describe('authoritative bundled project instructional structure', () => {
  it.each(contracts)('keeps %s task progress separate from its source-derived Guide pages', (projectId, taskCount, educationalTitles) => {
    const project = projectCatalog.getProjectById(projectId);
    const guide = buildProjectSourcePages(project);
    expect(project.checkpoints).toHaveLength(taskCount);
    expect(project.guidePages.filter(({ kind }) => kind === 'task')).toHaveLength(taskCount);
    expect(project.guidePages.filter(({ kind }) => kind === 'information').length).toBeGreaterThanOrEqual(8);
    expect(guide.pages.map(({ title }) => title)).toEqual(expect.arrayContaining(['Meet Your Project', 'What You Have Built', 'Extension Ideas', ...educationalTitles]));
    expect(guide.checkpointFirstPageIndices).toHaveLength(taskCount);
    guide.checkpointFirstPageIndices.forEach((pageIndex, checkpointIndex) => {
      expect(guide.pages[pageIndex]).toMatchObject({ kind: 'task', checkpointIndex, checkpointId: project.checkpoints[checkpointIndex].id });
    });
  });

  it('leaves validation and runtime contracts on the original required checkpoints', () => {
    for (const [projectId, taskCount] of contracts) {
      const project = projectCatalog.getProjectById(projectId);
      expect(project.checkpoints).toHaveLength(taskCount);
      expect(project.checkpoints.every(({ validation }) => validation.type === 'project-checks')).toBe(true);
      expect(project.languageOverrides.python.runCommand).toBeTruthy();
      expect(project.languageOverrides.cpp.runCommand).toBeTruthy();
      expect(project.languageOverrides.java.runCommand).toBeTruthy();
    }
  });
});
