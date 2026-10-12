import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectWorkspace } from '../../src/projects/pages/ProjectWorkspace.jsx';
import { buildProjectSourcePages } from '../../src/projects/guide/projectSourcePages.js';
import { adaptPublishedProject } from '../../src/projects/repositories/PublishedContentRepository.js';
import { projectProgressService } from '../../src/projects/services/ProjectProgressService.js';
import { createProjectAIContext } from '../../src/projects/ai/projectAIContext.js';

vi.mock('../../src/compiler/CompilerProvider', () => ({ useCompilerManager: () => ({}) }));
vi.mock('../../src/components/EditorPlaceholder', () => ({ EditorPlaceholder: ({ editor }) => <div aria-label={editor.ariaLabel}>Editor</div> }));

const storage = new Map();
vi.stubGlobal('localStorage', {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
});
beforeEach(() => { storage.clear(); projectProgressService.connect(null); });
afterEach(cleanup);

const groups = [
  { prelude: [1, 2, 3, 4, 5], tasks: [[6], [7, 8, 9, 10, 11]], completion: 12 },
  { prelude: [13, 14, 15, 16], tasks: [[17], [18, 19, 20]], completion: 21 },
  { prelude: [22, 23], tasks: [[24], [25, 26, 27]], completion: 28 },
  { prelude: [29, 30], tasks: [[31], [32, 33, 34]], completion: 35 },
  { prelude: [36, 37], tasks: [[38], [39, 40]], completion: 41 },
  { prelude: [42], tasks: [[43], [44, 45, 46]], completion: 47 },
  { prelude: [48, 49, 50], tasks: [[51], [52, 53]], completion: 54 },
  { prelude: [55], tasks: [[56], [57, 58], [59, 60]], completion: 61 },
];
let taskNumber = 0;
const pageBlocks = (number, task = null) => [
  { blockId: `bingo-p${number}-title`, type: 'heading', level: 2, text: `Page ${number} — ${task ? `Task ${task} — ` : ''}Guide ${number}` },
  { blockId: `bingo-p${number}-body`, type: 'paragraph', text: number === 4 ? { variants: { python: 'Python page four', cpp: 'C++ page four', java: 'Java page four' }, requiredLanguages: ['python', 'cpp', 'java'] } : `Body for source page ${number}` },
];
const checkpoints = groups.map((group, index) => ({
  checkpointId: `bingo-c${index + 1}`, order: index + 1, title: `Checkpoint ${index + 1}`,
  summary: `Checkpoint ${index + 1} objective`, blocks: group.prelude.flatMap((number) => pageBlocks(number)),
  tasks: group.tasks.map((numbers, taskIndex) => {
    taskNumber += 1;
    return {
      taskId: `bingo-task-${taskNumber}`, order: taskIndex + 1, title: `Task ${taskNumber}`,
      objective: `Build task ${taskNumber}`, why: 'Learn this behavior.', expectedBehavior: ['Expected behavior'],
      blocks: numbers.flatMap((number, index) => pageBlocks(number, index === numbers.length - 1 ? taskNumber : null)),
      implementationContractIds: [], validators: [],
      mentor: { hints: [{ hintId: `hint-${taskNumber}`, level: 'hint', text: 'Current hint' }, { hintId: `reference-${taskNumber}`, level: 'reference', text: 'SECRET_FUTURE_SOLUTION', requiresExplicitReveal: true }], revealPolicy: { referenceAllowed: false } },
    };
  }),
  validators: [], completionBlocks: pageBlocks(group.completion),
}));
const content = {
  projectId: 'bingo', title: 'Bingo', description: 'Build a terminal Bingo game.',
  difficulty: 'Intermediate', category: 'Guided coding project', estimatedMinutes: 600,
  learningOutcomes: ['Build a game'], tags: [], prerequisites: [], supportedLanguages: ['python', 'cpp', 'java'],
  starterWorkspaces: Object.fromEntries([['python', 'bingo.py'], ['cpp', 'main.cpp'], ['java', 'Main.java']].map(([id, path]) => [id, { entrypoint: path, runtimeId: id, files: [{ path, content: '' }] }])),
  implementationContracts: [], checkpoints, finalValidators: [],
  completionBlocks: [62, 63, 64, 65, 66].flatMap((number) => pageBlocks(number)),
};
const project = adaptPublishedProject(content, 1);
const guide = () => document.querySelector('.project-guide-content');
const next = () => fireEvent.click(within(document.querySelector('.project-guide-navigation')).getByRole('button', { name: /Next/ }));
const previous = () => fireEvent.click(within(document.querySelector('.project-guide-navigation')).getByRole('button', { name: /Previous/ }));
const renderWorkspace = () => render(<ProjectWorkspace project={project} tier="PREMIUM" onBack={vi.fn()} />);

describe('canonical source-page Project Guide', () => {
  it('derives 66 stable, sequential pages and retains checkpoint/task grouping', () => {
    const index = buildProjectSourcePages(project);
    expect(index.pages).toHaveLength(66);
    expect(index.pages.map(({ number }) => number)).toEqual(Array.from({ length: 66 }, (_, i) => i + 1));
    expect(index.pages.map(({ id }) => id)).toEqual(Array.from({ length: 66 }, (_, i) => `bingo-p${i + 1}-title`));
    expect(index.checkpointFirstPageIndices.map((i) => index.pages[i].number)).toEqual([1, 13, 22, 29, 36, 42, 48, 55]);
    expect(project.checkpoints).toHaveLength(8);
    expect(project.checkpoints.map(({ tasks }) => tasks.length)).toEqual([2, 2, 2, 2, 2, 2, 2, 3]);
    expect(index.pages.filter(({ taskId }) => taskId)).toHaveLength(17);
    expect(index.pages.slice(61).map(({ number }) => number)).toEqual([62, 63, 64, 65, 66]);
  });

  it('renders one page, moves forward and back, without saving reading progress', () => {
    const visitPage = vi.spyOn(projectProgressService, 'visitPage');
    renderWorkspace();
    expect(within(guide()).getByText('Body for source page 1')).toBeVisible();
    expect(within(guide()).queryByText('Body for source page 2')).not.toBeInTheDocument();
    expect(within(document.querySelector('.project-guide-navigation')).getByRole('button', { name: /Previous/ })).toBeDisabled();
    next();
    expect(within(guide()).getByText('Body for source page 2')).toBeVisible();
    expect(within(guide()).queryByText('Body for source page 1')).not.toBeInTheDocument();
    previous();
    expect(within(guide()).getByText('Body for source page 1')).toBeVisible();
    expect(visitPage).not.toHaveBeenCalled();
    expect(storage.has('mi-tutora:projects:v1')).toBe(false);
    visitPage.mockRestore();
  });

  it('crosses checkpoints, opens their first page, and shows verification only on task pages', () => {
    renderWorkspace();
    for (let page = 1; page < 6; page += 1) {
      expect(within(guide()).queryByText('Task verification')).not.toBeInTheDocument();
      next();
    }
    expect(within(guide()).getByText('Page 6 — Task 1 — Guide 6')).toBeVisible();
    expect(within(guide()).getByText('Task verification')).toBeVisible();
    next();
    expect(within(guide()).getByText('Page 7 — Guide 7')).toBeVisible();
    expect(within(guide()).queryByText('Task verification')).not.toBeInTheDocument();
    for (let page = 7; page < 13; page += 1) next();
    expect(within(guide()).getByText('Page 13 — Guide 13')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Checkpoints', exact: true }));
    expect(document.querySelectorAll('.project-checkpoint-list > li')).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: /Checkpoint 1 (Available|Current)/ }));
    expect(within(guide()).getByText('Page 1 — Guide 1')).toBeVisible();
  });

  it('opens the first source page when an unlocked checkpoint is clicked', () => {
    storage.set('mi-tutora:projects:v1', JSON.stringify({ bingo: {
      currentCheckpoint: 1, checkpointProgress: { 'bingo-c1': { status: 'COMPLETED' } },
    } }));
    renderWorkspace();
    expect(within(guide()).getByText('Page 13 — Guide 13')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Checkpoints', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: /Checkpoint 1 Completed/ }));
    expect(within(guide()).getByText('Page 1 — Guide 1')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Checkpoint 2 Available/ }));
    expect(within(guide()).getByText('Page 13 — Guide 13')).toBeVisible();
  });

  it('reaches all 66 pages individually, including final reflection pages', () => {
    renderWorkspace();
    for (let number = 1; number <= 66; number += 1) {
      expect(within(guide()).getByText(`Page ${number} — ${[6, 11, 17, 20, 24, 27, 31, 34, 38, 40, 43, 46, 51, 53, 56, 58, 60].includes(number) ? `Task ${[6, 11, 17, 20, 24, 27, 31, 34, 38, 40, 43, 46, 51, 53, 56, 58, 60].indexOf(number) + 1} — ` : ''}Guide ${number}`)).toBeVisible();
      expect(within(guide()).queryByText(`Body for source page ${number + 1}`)).not.toBeInTheDocument();
      if (number < 66) next();
    }
    expect(within(document.querySelector('.project-guide-navigation')).getByRole('button', { name: /Next/ })).toBeDisabled();
    previous();
    expect(within(guide()).getByText('Page 65 — Guide 65')).toBeVisible();
  });

  it.each([['python', 'Python'], ['cpp', 'C++'], ['java', 'Java']])('keeps %s guidance on the current page', (languageId, label) => {
    storage.set('mi-tutora:projects:v1', JSON.stringify({ bingo: { languageId } }));
    renderWorkspace();
    next(); next(); next();
    expect(within(guide()).getByText(`${label} page four`)).toBeVisible();
    for (const other of ['Python', 'C++', 'Java'].filter((name) => name !== label)) {
      expect(within(guide()).queryByText(`${other} page four`)).not.toBeInTheDocument();
    }
  });

  it('does not include a future task rubric on a theory page', () => {
    const context = createProjectAIContext({ project, checkpoint: project.checkpoints[0], taskId: null, languageId: 'cpp', selectionType: 'guide_text', selectedContent: 'Page four selection' });
    expect(context).not.toHaveProperty('mentor');
    expect(JSON.stringify(context)).not.toContain('SECRET_FUTURE_SOLUTION');
  });
});
