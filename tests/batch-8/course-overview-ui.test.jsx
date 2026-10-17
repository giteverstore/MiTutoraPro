import React from 'react';
import { readFileSync } from 'node:fs';
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
    const onEnterCourse = vi.fn();
    render(<CourseOverview course={course} onBack={vi.fn()} onEnterCourse={onEnterCourse} onResetCourse={vi.fn()} onStartExam={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Start this Course/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Start this Course/ }));
    expect(onEnterCourse).toHaveBeenCalledOnce();
    expect(screen.getByRole('heading', { level: 1, name: 'Getting started with Python' })).toBeInTheDocument();
    expect(screen.getByText('Easy')).toHaveClass('difficulty-badge', 'difficulty-badge--easy');
    expect(document.querySelector('.overview-hero')).toHaveClass('overview-hero--full');
    expect(document.querySelector('.overview-hero-artwork-space')).toBeNull();
    expect(document.querySelector('.overview-hero--artwork')).toBeNull();
    expect(document.querySelector('.overview-hero [style*="course-hero-artwork"]')).toBeNull();
    expect(screen.queryByText(/Course overview/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Beginner')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Course details' }).querySelectorAll('.overview-stat-card')).toHaveLength(6);
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

  it('places the full-width hero at the top with Dashboard inside and stats below', () => {
    progressState.value = { ...progress(false), courseProgress: 50 };
    const { container } = render(<CourseOverview course={course} onBack={vi.fn()} onEnterCourse={vi.fn()} />);
    const shell = container.querySelector('.course-overview-shell');
    const hero = shell.firstElementChild;
    const body = shell.querySelector('.course-overview-main');
    expect(hero).toHaveClass('overview-hero', 'overview-hero--full');
    expect(hero).toContainElement(screen.getByRole('button', { name: 'Dashboard' }));
    expect(hero).toContainElement(screen.getByRole('button', { name: /Start this Course/ }));
    expect(hero).toContainElement(screen.getByRole('progressbar', { name: 'Course progress' }));
    expect(hero.nextElementSibling).toBe(body);
    expect(body.firstElementChild).toHaveClass('overview-stat-grid');
    expect(body.querySelectorAll('.overview-stat-card')).toHaveLength(6);
  });

  it.each([
    ['intermediate', 'Medium', 'medium'],
    ['advanced', 'Hard', 'hard'],
  ])('maps %s to the shared %s badge without artwork', (level, label, modifier) => {
    const genericCourse = { ...course, id: `course-${level}`, metadata: { ...course.metadata, level } };
    render(<CourseOverview course={genericCourse} onBack={vi.fn()} onEnterCourse={vi.fn()} />);
    expect(screen.getByText(label)).toHaveClass('difficulty-badge', `difficulty-badge--${modifier}`);
    expect(screen.getByRole('heading', { level: 1, name: 'Python Foundations' })).toBeInTheDocument();
    expect(screen.getByText('Learn Python.')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Course progress' })).toBeInTheDocument();
    expect(document.querySelector('.overview-hero-artwork-space')).toBeNull();
  });

  it('omits difficulty safely when missing and never requires an image', () => {
    const genericCourse = { ...course, id: 'course-no-artwork', metadata: { estimatedMinutes: 60, tags: [] } };
    render(<CourseOverview course={genericCourse} onBack={vi.fn()} onEnterCourse={vi.fn()} anonymous />);
    expect(document.querySelector('.overview-hero .difficulty-badge')).toBeNull();
    expect(document.querySelector('.overview-hero img')).toBeNull();
    expect(screen.getByRole('button', { name: /Start Course/ })).toBeInTheDocument();
  });

  it('uses the full content width without old artwork split or empty image region', () => {
    const css = readFileSync('src/styles/pages/dashboard.css', 'utf8');
    const component = readFileSync('src/course-overview/CourseOverview.jsx', 'utf8');
    expect(component).toContain("import '../styles/pages/dashboard.css';");
    expect(css).toMatch(/\.overview-hero\s*\{[^}]*width:\s*100%;[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
    expect(css).toMatch(/\.course-overview-main\s*\{[^}]*width:\s*min\(100%, 86rem\)/);
    expect(css).toMatch(/\.overview-hero\s*\{[^}]*border-bottom:\s*1px solid var\(--color-border\)/);
    expect(css).not.toContain('.course-overview-main>.overview-back');
    expect(css).not.toContain('.overview-hero--artwork');
    expect(css).not.toContain('--course-hero-artwork');
  });
});
