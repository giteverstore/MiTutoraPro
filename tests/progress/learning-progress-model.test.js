import { describe, expect, it } from 'vitest';
import { createInitialProgress, deriveProgress } from '../../src/progress/learningProgressModel.js';

const course = {
  id: 'python', defaultLessonId: 'one',
  modules: [
    { id: 'm1', lessons: [{ id: 'one', estimatedMinutes: 5 }, { id: 'two', details: ['10 min'] }] },
    { id: 'm2', lessons: [{ id: 'three' }] },
  ],
};

describe('learning progress model', () => {
  it('derives sequential completion, modules, counts, and remaining time', () => {
    const progress = deriveProgress(course, { completedLessons: ['one', 'two'], visitedLessons: [], bookmarks: ['two'], quizScores: {}, exerciseCompletion: {} });
    expect(progress).toMatchObject({ completedLessons: ['one', 'two'], visitedLessons: ['one', 'two'], completedModules: ['m1'], sequentialCompletedLessons: 2, visitedLessonCount: 2, completedLessonCount: 2, courseProgress: 67, estimatedTimeRemaining: 10 });
  });

  it('creates the existing initial progress contract', () => {
    expect(createInitialProgress(course, undefined, ['one'], ['two'], ['three'])).toMatchObject({ currentLesson: 'one', currentModule: 'm1', completedLessons: ['one'], visitedLessons: ['three', 'one'], bookmarks: ['two'], contentVersion: null });
  });
});
