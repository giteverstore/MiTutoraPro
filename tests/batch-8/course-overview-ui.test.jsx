import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const progressState = vi.hoisted(() => ({ value: null }));
vi.mock('../../src/progress/LearningProgressContext', () => ({
  useOptionalLearningProgress: () => progressState.value,
}));
vi.mock('../../src/progress/TrustedCompletionDevelopmentService', () => ({
  trustedCompletionDevelopmentService: { completeCourse: vi.fn() },
}));

import { CourseOverview } from '../../src/course-overview/CourseOverview';

const lesson = { id: 'lesson-1', number: 1, title: 'First lesson', blocks: [] };
const course = {
  id: 'python',
  title: 'Python Foundations',
  description: 'Learn Python.',
  status: 'published',
  metadata: { level: 'beginner', estimatedMinutes: 60, tags: ['python'] },
  modules: [{ id: 'module-1', title: 'Getting started', description: 'The first module.', lessons: [lesson] }],
};

function progress(completed = false) {
  return {
    completedLessons: completed ? [lesson.id] : [],
    sequentialCompletedLessons: completed ? 1 : 0,
    completedLessonCount: completed ? 1 : 0,
    visitedLessonCount: completed ? 1 : 0,
    courseProgress: completed ? 100 : 0,
    markAllLessonsComplete: vi.fn(), resetCourse: vi.fn(), resetLearningProgress: vi.fn(),
    resetQuizAttempts: vi.fn(), resetExerciseAttempts: vi.fn(),
  };
}

describe('course overview shell and completed actions', () => {
  beforeEach(() => { progressState.value = progress(false); });
  afterEach(cleanup);

  it('keeps the normal incomplete action and omits exam and redundant bottom CTA', () => {
    render(<CourseOverview course={course} onBack={vi.fn()} onEnterCourse={vi.fn()} onResetCourse={vi.fn()} onStartExam={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Start this Course/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Take Online Exam/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Ready when you are/i)).not.toBeInTheDocument();
    expect(document.querySelector('.overview-bottom-cta')).toBeNull();
  });

  it('shows Review Course and delegates Take Online Exam to the canonical callback at completion', () => {
    const onStartExam = vi.fn();
    progressState.value = progress(true);
    render(<CourseOverview course={course} onBack={vi.fn()} onEnterCourse={vi.fn()} onResetCourse={vi.fn()} onStartExam={onStartExam} />);
    expect(screen.getByRole('button', { name: /Review Course/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Take Online Exam/ }));
    expect(onStartExam).toHaveBeenCalledOnce();
    expect(screen.getByText('1/1')).toBeInTheDocument();
  });

  it('preserves Dashboard navigation and curriculum expansion', () => {
    const onBack = vi.fn();
    render(<CourseOverview course={course} onBack={onBack} onEnterCourse={vi.fn()} onResetCourse={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }));
    expect(onBack).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByText('Getting started'));
    expect(screen.getByText('First lesson')).toBeVisible();
  });
});
