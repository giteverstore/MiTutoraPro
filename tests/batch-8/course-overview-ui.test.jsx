import React from 'react';
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
    expect(screen.getByRole('heading', { level: 1, name: 'Python Foundations' })).toBeInTheDocument();
    expect(screen.getByText('Easy')).toHaveClass('difficulty-badge', 'difficulty-badge--easy');
    expect(document.querySelector('.overview-hero')).toHaveClass('overview-hero--full-bleed');
    expect(document.querySelector('.overview-hero-artwork-space')).toBeNull();
    expect(document.querySelector('.overview-hero--artwork')).toBeNull();
    expect(document.querySelector('.overview-hero [style*="course-hero-artwork"]')).toBeNull();
    expect(screen.getByText('Python Course')).toBeInTheDocument();
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
    expect(document.querySelector('.overview-hero-summary-bottom')).toHaveClass('has-exam-action');
    expect(screen.getByRole('button', { name: /Review Course/ }).closest('.overview-hero-actions')).toContainElement(screen.getByRole('button', { name: /Take Online Exam/ }));
    fireEvent.click(screen.getByRole('button', { name: /Take Online Exam/ }));
    expect(onStartExam).toHaveBeenCalledOnce();
    expect(screen.getByText('1/1')).toBeInTheDocument();
  });

  it('removes the Dashboard control while preserving curriculum expansion', () => {
    const onBack = vi.fn();
    render(<CourseOverview course={course} onBack={onBack} onEnterCourse={vi.fn()} onResetCourse={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(onBack).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Getting started'));
    expect(screen.getByText('First lesson')).toBeVisible();
  });

  it('places the full-bleed hero at the top with constrained content and stats below', () => {
    progressState.value = { ...progress(false), courseProgress: 50 };
    const { container } = render(<CourseOverview course={course} onBack={vi.fn()} onEnterCourse={vi.fn()} />);
    const shell = container.querySelector('.course-overview-shell');
    const hero = shell.firstElementChild;
    const body = shell.querySelector('.course-overview-main');
    expect(hero).toHaveClass('overview-hero', 'overview-hero--full-bleed');
    expect(hero.querySelector('.overview-hero-layout')).toBeInTheDocument();
    expect(hero.querySelector('.overview-back')).toBeNull();
    expect(hero).toContainElement(screen.getByRole('button', { name: /Start this Course/ }));
    expect(hero).toContainElement(screen.getByRole('progressbar', { name: 'Course progress' }));
    expect(hero.nextElementSibling).toBe(body);
    expect(body.firstElementChild).toHaveClass('overview-stat-grid');
    expect(body.querySelectorAll('.overview-stat-card')).toHaveLength(6);
  });

  it('shares the landing pointer grid without changing course actions or progress', () => {
    progressState.value = { ...progress(false), courseProgress: 50 };
    const onEnterCourse = vi.fn();
    const { container } = render(<CourseOverview course={course} onBack={vi.fn()} onEnterCourse={onEnterCourse} />);
    const hero = container.querySelector('.overview-hero');
    expect(hero).toHaveClass('hero-pointer-grid-host');
    expect(hero.querySelector('.overview-hero-grid.hero-pointer-grid')).toHaveAttribute('aria-hidden', 'true');
    expect(hero.querySelector('.overview-hero-grid-highlight.hero-pointer-grid-highlight')).toHaveAttribute('aria-hidden', 'true');
    fireEvent.pointerEnter(hero, { pointerType: 'mouse' });
    expect(hero).toHaveClass('is-pointer-active');
    fireEvent.pointerLeave(hero, { pointerType: 'mouse' });
    expect(hero).not.toHaveClass('is-pointer-active');
    expect(screen.getByRole('progressbar', { name: 'Course progress' })).toHaveAttribute('aria-valuenow', '50');
    fireEvent.click(screen.getByRole('button', { name: /Start this Course/ }));
    expect(onEnterCourse).toHaveBeenCalledOnce();
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
    expect(screen.getByRole('complementary', { name: 'Course summary' })).toBeInTheDocument();
    expect(document.querySelector('.overview-hero-artwork-space')).toBeNull();
  });

  it('omits difficulty safely when missing and never requires an image', () => {
    const genericCourse = { ...course, id: 'course-no-artwork', metadata: { estimatedMinutes: 60, tags: [] } };
    render(<CourseOverview course={genericCourse} onBack={vi.fn()} onEnterCourse={vi.fn()} anonymous />);
    expect(document.querySelector('.overview-hero .difficulty-badge')).toBeNull();
    expect(document.querySelector('.overview-hero img')).toBeNull();
    expect(screen.getByRole('button', { name: /Start Course/ })).toBeInTheDocument();
  });

  it('uses a 230px full-bleed gradient hero with aligned inner content and stacked responsive layout', () => {
    const css = readFileSync('src/styles/pages/dashboard.css', 'utf8');
    const gridCss = readFileSync('src/styles/hero-pointer-grid.css', 'utf8');
    const component = readFileSync('src/course-overview/CourseOverview.jsx', 'utf8');
    expect(component).toContain("import '../styles/pages/dashboard.css';");
    expect(css).toMatch(/\.overview-hero\s*\{[^}]*width:\s*100%;[^}]*height:\s*230px/);
    expect(css).toMatch(/\.overview-hero-layout\s*\{[^}]*width:\s*min\(100%, 86rem\);[^}]*margin-inline:\s*auto;[^}]*padding:\s*var\(--space-4\)/);
    expect(css).toMatch(/\.overview-hero-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1\.6fr\) minmax\(0, 1fr\)/);
    expect(css).toMatch(/@media \(max-width: 1000px\)[\s\S]*?\.overview-hero\s*\{\s*height:\s*auto;/);
    expect(css).toMatch(/@media \(max-width: 1000px\)[\s\S]*?\.overview-hero-layout\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/);
    expect(css).toMatch(/\.course-overview-main\s*\{[^}]*width:\s*min\(100%, 86rem\)/);
    expect(css).toMatch(/\.overview-hero\s*\{[^}]*background:\s*linear-gradient\(to bottom, var\(--color-accent\) 0%,[^;]*#05070b 100%\)/);
    expect(css).toMatch(/\.overview-hero h1\s*\{[^}]*color:\s*#fff/);
    expect(css).toMatch(/\.overview-hero-copy>p\s*\{[^}]*color:\s*#fff/);
    expect(css).toMatch(/\.overview-certification-badge\s*\{[^}]*color:\s*#fff/);
    expect(css).toMatch(/\.course-overview-main\s*\{[^}]*padding:\s*var\(--space-10\)/);
    expect(css).toMatch(/\.overview-stat-grid\s*\{[^}]*margin-top:\s*0/);
    expect(css).toMatch(/\.overview-hero-grid\s*\{[^}]*rgb\(229 231 235 \/ 68%\)/);
    expect(css).toMatch(/\.overview-hero-grid-highlight\s*\{[^}]*linear-gradient\(#fff 1\.5px/);
    expect(css).toMatch(/\.overview-hero \.overview-primary-action\.button--primary\s*\{[^}]*background:\s*var\(--color-accent\)/);
    expect(css).toMatch(/\.overview-hero-summary\s*\{[^}]*background:\s*var\(--color-surface-raised\)/);
    expect(gridCss).toContain('background-size: var(--hero-grid-size) var(--hero-grid-size)');
    expect(gridCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(gridCss).toMatch(/\.hero-pointer-grid-highlight\s*\{\s*display: none;/);
    expect(css).not.toContain('.course-overview-main>.overview-back');
    expect(css).not.toContain('.overview-hero--artwork');
    expect(css).not.toContain('--course-hero-artwork');
  });

  it('shows only certification in the left hero and three derived summary metrics on the right', () => {
    const content = { ...course, modules: [{ ...course.modules[0], lessons: [{ ...lesson, blocks: [{ type: 'quiz' }, { type: 'exercise' }, { type: 'quiz' }] }] }] };
    render(<CourseOverview course={content} onBack={vi.fn()} onEnterCourse={vi.fn()} />);
    const hero = document.querySelector('.overview-hero');
    const summary = within(screen.getByRole('complementary', { name: 'Course summary' }));
    expect(hero.querySelector('.overview-certification-badge')).toHaveTextContent('Certification Available');
    expect(summary.getByText('Modules').previousElementSibling).toHaveTextContent('1');
    expect(summary.getByText('Problems').previousElementSibling).toHaveTextContent('3');
    expect(summary.getByText('Duration').previousElementSibling).toHaveTextContent('1 hr');
    expect(hero).not.toHaveTextContent(/review|rating|stars/i);
    expect(summary.getByRole('progressbar', { name: 'Course progress' })).toHaveAttribute('aria-valuenow', '0');
    expect(summary.getByText('0% done')).toBeInTheDocument();
  });

  it.each([
    ['java', 'Java Basics', 'java', 'Java Course'],
    ['ai-prompt-tutorial', 'AI Prompt Tutorial', 'none', 'AI Course'],
  ])('renders %s from its own Course data without hardcoded Python content', (id, title, language, label) => {
    render(<CourseOverview course={{ ...course, id, title, language, description: `Learn ${title}.`, metadata: { ...course.metadata, tags: ['ai'] }, modules: [{ ...course.modules[0], lessons: [{ ...lesson, blocks: [] }] }] }} onBack={vi.fn()} onEnterCourse={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(`Learn ${title}.`)).toBeInTheDocument();
    expect(within(screen.getByRole('complementary', { name: 'Course summary' })).getByText('Problems').previousElementSibling).toHaveTextContent('0');
  });

  it('does not fabricate zero-percent progress while saved progress is loading', () => {
    progressState.value = { ...progress(false), status: 'loading' };
    render(<CourseOverview course={course} onBack={vi.fn()} onEnterCourse={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading progress');
    expect(screen.queryByText('0% done')).not.toBeInTheDocument();
  });
});
