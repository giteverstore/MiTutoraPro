import { describe, expect, it } from 'vitest';
import { projectCatalog } from '../../src/projects/repositories/ProjectCatalog';
import { buildProjectSourcePages } from '../../src/projects/guide/projectSourcePages';
import { PROJECT_GUIDE_SOURCE_CONTRACTS } from '../../src/projects/catalog/projectGuideSourcePages';
import { validateProjectGuideFidelity } from '../../src/projects/guide/projectGuideFidelity';

const contracts = [
  ['blackjack', 16, 48, 'Blackjack Game'],
  ['hangman', 17, 31, 'Hangman Word Guessing Game'],
  ['stone-paper-scissors', 17, 51, 'Stone Paper Scissors Game'],
  ['currency-converter', 12, 37, 'Multi-Unit & Currency Converter CLI'],
];

describe('authoritative bundled project instructional structure', () => {
  it.each(contracts)('keeps %s task progress separate from every physical DOCX Guide page', (projectId, taskCount, physicalPageCount, firstTitle) => {
    const project = projectCatalog.getProjectById(projectId);
    const guide = buildProjectSourcePages(project);
    expect(project.checkpoints).toHaveLength(taskCount);
    expect(project.guidePages.filter(({ kind }) => kind === 'task')).toHaveLength(taskCount);
    expect(project.guidePages).toHaveLength(physicalPageCount);
    expect(project.guidePages[0].title).toBe(firstTitle);
    expect(project.guidePages.map(({ sourcePageStart }) => sourcePageStart)).toEqual(Array.from({ length: physicalPageCount }, (_, index) => index + 1));
    expect(validateProjectGuideFidelity(project, PROJECT_GUIDE_SOURCE_CONTRACTS[projectId])).toEqual([]);
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
