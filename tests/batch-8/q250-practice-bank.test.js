import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { practiceQuestions } from '../../src/practice/practiceData.js';
import { createPracticeSourceAdapter } from '../../src/practice/practiceContentSourceCore.js';
import { parseAppRoute, routePath } from '../../src/routing/appRoutes.js';

const expectedCategories = {
  'Arrays & Hashing': 22, 'Two Pointers': 13, 'Sliding Window': 9, Stack: 14,
  'Binary Search': 14, 'Linked List': 14, Trees: 23, 'Heap / Priority Queue': 12,
  Backtracking: 17, Tries: 4, Graphs: 21, 'Advanced Graphs': 10,
  '1-D Dynamic Programming': 17, '2-D Dynamic Programming': 16, Greedy: 14,
  Intervals: 7, 'Math & Geometry': 13, 'Bit Manipulation': 10,
};
const languageIds = ['python', 'java', 'javascript', 'typescript', 'c', 'cpp', 'csharp', 'php', 'r'];

describe('final Q250 learner bank', () => {
  it('matches the authoritative inventory and stable ID ranges', () => {
    expect(practiceQuestions).toHaveLength(250);
    expect(new Set(practiceQuestions.map(({ id }) => id)).size).toBe(250);
    expect(practiceQuestions.slice(0, 150).map(({ id }) => id)).toEqual(
      Array.from({ length: 150 }, (_, index) => `BLIND150-${String(index + 1).padStart(3, '0')}`),
    );
    expect(practiceQuestions.slice(150).map(({ id }) => id)).toEqual(
      Array.from({ length: 100 }, (_, index) => `NC250-${String(index + 151).padStart(3, '0')}`),
    );
    expect(Object.fromEntries(Object.keys(expectedCategories).map((category) => [category, practiceQuestions.filter(({ topic }) => topic === category).length]))).toEqual(expectedCategories);
    expect({
      easy: practiceQuestions.filter(({ difficulty }) => difficulty === 'easy').length,
      medium: practiceQuestions.filter(({ difficulty }) => difficulty === 'medium').length,
      hard: practiceQuestions.filter(({ difficulty }) => difficulty === 'hard').length,
    }).toEqual({ easy: 60, medium: 155, hard: 35 });
  });

  it('preserves three examples, fixtures and hints plus nine starters per question', () => {
    expect(practiceQuestions.reduce((sum, question) => sum + question.examples.length, 0)).toBe(750);
    expect(practiceQuestions.reduce((sum, question) => sum + question.publicTests.length, 0)).toBe(750);
    expect(practiceQuestions.reduce((sum, question) => sum + question.hints.length, 0)).toBe(750);
    expect(practiceQuestions.reduce((sum, question) => sum + Object.keys(question.starterTemplates).length, 0)).toBe(2250);
    for (const question of practiceQuestions) {
      expect(Object.keys(question.starterTemplates)).toEqual(languageIds);
      expect(question.constraints.length).toBeGreaterThan(0);
      expect(question.expectedComplexity.time).toBeTruthy();
      expect(question.expectedComplexity.space).toBeTruthy();
      expect(question.blocks.filter(({ type }) => type === 'compiler')).toHaveLength(9);
    }
  });

  it('supports catalog search, filters and direct lookup for every stable ID', async () => {
    const runtimeSource = await readFile('src/practice/practiceContentSource.js', 'utf8');
    expect(runtimeSource).toContain('PRACTICE_CONTENT_SOURCES.LOCAL');
    const source = createPracticeSourceAdapter({ source: 'local', localQuestions: practiceQuestions, firebaseService: {} });
    const filtered = await source.listPage({ filters: { topic: 'Tries', difficulty: 'all', language: 'all' }, pageSize: 250 });
    expect(filtered.items).toHaveLength(4);
    const searched = await source.listPage({ filters: { search: 'Contains Duplicate', topic: 'all', difficulty: 'all', language: 'all' }, pageSize: 250 });
    expect(searched.items.map(({ id }) => id)).toContain('BLIND150-001');
    for (const question of practiceQuestions) {
      await expect(source.loadQuestionById(question.id)).resolves.toMatchObject({ id: question.id });
      const path = routePath({ kind: 'practice-question', questionId: question.id });
      expect(parseAppRoute(path)).toMatchObject({ kind: 'practice-question', questionId: question.id });
    }
  });

  it('contains learner-safe fields only', () => {
    const serialized = JSON.stringify(practiceQuestions);
    for (const forbidden of ['referenceImplementation', 'reference_solution', 'hiddenFixtures', 'internalFixtures', 'semanticOracle', 'preservationHash', 'validationLog', 'checkpointReport']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('retains special serialization contracts without implementing execution', () => {
    expect(practiceQuestions.find(({ title }) => title === 'Baseball Game').executionMetadata).toMatchObject({ serialized_result_type: 'str' });
    expect(practiceQuestions.find(({ title }) => title === 'Course Schedule IV').executionMetadata).toMatchObject({ serialized_result_type: 'ints' });
    expect(practiceQuestions.find(({ title }) => title === 'Evaluate Division').executionMetadata).toMatchObject({ validator: 'finite_ratios' });
  });
});
