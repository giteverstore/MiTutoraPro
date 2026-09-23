import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { kolkataDate } from '../../src/home/challengeCalendar';
import { findLessonProgressScope } from '../../src/course/courseStructure';

const activity = vi.hoisted(() => ({
  status: 'ready',
  streak: { currentStreak: 6 },
  completions: [],
}));

vi.mock('../../src/activity/LearnerActivityContext', () => ({ useLearnerActivity: () => activity }));
vi.mock('../../src/bookmarks/BookmarkToggle', () => ({
  BookmarkToggle: ({ bookmark, onChange, className }) => (
    <button className={className} type="button" aria-label={`Save ${bookmark.title} to Library`} onClick={() => onChange(true)}>Bookmark</button>
  ),
}));

import { TopNavigation } from '../../src/components/TopNavigation';

afterEach(cleanup);

const props = () => ({
  course: {
    navigation: { progressLabel: 'Course progress', openMenuLabel: 'Open lessons' },
    ui: { shortcuts: { menu: 'M' } },
  },
  lessonProgress: { current: 4, total: 6 },
  bookmark: { id: 'lesson-1', title: 'Variables', type: 'course' },
  user: { name: 'Tester', email: 'tester@example.test', avatar: null },
  theme: 'light',
  onMenuClick: vi.fn(),
  onThemeToggle: vi.fn(),
  onBookmarkChange: vi.fn(),
  onExitCourse: vi.fn(),
  onSignOut: vi.fn(),
  isSidebarOverlay: false,
});

describe('Learning Engine navigation alignment', () => {
  it('keeps course context and uses the canonical compact global controls', () => {
    const values = props();
    render(<TopNavigation {...values} />);

    expect(screen.getByLabelText('ycoders')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to course overview' })).toBeInTheDocument();
    expect(screen.getByText('Lesson progress')).toBeInTheDocument();
    expect(screen.getByText('4 of 6')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Lesson progress: 4 of 6' })).toHaveAttribute('aria-valuenow', '4');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemin', '1');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '6');
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width: '66.66666666666666%' });
    expect(screen.queryByText('42%')).not.toBeInTheDocument();
    expect(screen.getByLabelText("6 day streak. Today's Daily Challenge is not completed.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open user menu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Variables to Library' })).toBeInTheDocument();
    expect(screen.queryByText('Tester')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
  });

  it.each([
    [1, 6, '1 of 6', '16.666666666666664%'],
    [3, 6, '3 of 6', '50%'],
    [6, 6, '6 of 6', '100%'],
  ])('shows current subsection position %i of %i', (current, total, text, width) => {
    render(<TopNavigation {...props()} lessonProgress={{ current, total }} />);
    expect(screen.getByText(text)).toBeVisible();
    expect(screen.getByRole('progressbar').firstElementChild).toHaveStyle({ width });
  });

  it('shows a safe unavailable value instead of course progress when scope cannot be resolved', () => {
    render(<TopNavigation {...props()} lessonProgress={null} />);
    expect(screen.getByText('— of —')).toBeVisible();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('derives position from canonical subsection order, including quiz and exercise items', () => {
    const course = {
      modules: [{
        id: 'module-1',
        title: 'Foundations',
        sections: [
          { id: '1.1', title: 'Get Started', lessons: [{ id: 'intro' }, { id: 'quiz' }, { id: 'exercise' }] },
          { id: '1.2', title: 'Numbers', lessons: [{ id: 'numbers-intro' }, { id: 'strings' }] },
        ],
      }],
    };
    expect(findLessonProgressScope(course, 'exercise')).toMatchObject({ id: '1.1', index: 2, lessons: expect.any(Array) });
    expect(findLessonProgressScope(course, 'numbers-intro')).toMatchObject({ id: '1.2', index: 0, lessons: expect.any(Array) });
    expect(findLessonProgressScope(course, 'strings')).toMatchObject({ id: '1.2', index: 1, lessons: expect.any(Array) });
  });

  it('preserves actions and keeps identity/sign-out inside the avatar menu', () => {
    const values = props();
    render(<TopNavigation {...values} />);

    fireEvent.click(screen.getByRole('button', { name: 'Back to course overview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Variables to Library' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open user menu' }));

    expect(values.onExitCourse).toHaveBeenCalledOnce();
    expect(values.onBookmarkChange).toHaveBeenCalledWith(true);
    expect(screen.getByText('Tester')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(values.onSignOut).toHaveBeenCalledOnce();
  });

  it('uses canonical completion evidence for the active flame state', () => {
    activity.completions = [{ activityType: 'DAILY_CHALLENGE', occurrenceDate: kolkataDate(), completionStatus: 'COMPLETED' }];
    render(<TopNavigation {...props()} />);
    const badge = screen.getByLabelText("6 day streak. Today's Daily Challenge completed.");
    expect(badge).toHaveClass('is-today-completed');
    expect(badge.querySelector('svg')).toHaveAttribute('fill', 'currentColor');
    activity.completions = [];
  });

  it('keeps the immersive header compact at mobile widths', () => {
    const css = [
      readFileSync('src/styles/pages/learning-engine.css', 'utf8'),
      readFileSync('src/styles/pages/dashboard.css', 'utf8'),
    ].join('\n');
    expect(css).toMatch(/@media \(max-width: 560px\)[\s\S]*?\.topbar \{[^}]*padding-inline: var\(--space-2\)/);
    expect(css).toMatch(/\.lesson-topbar-brand \{[^}]*width: 1\.75rem;[^}]*font-size: 0/);
    expect(css).toMatch(/\.lesson-navigation \.application-icon-button,[\s\S]*?width: 2rem;[\s\S]*?height: 2rem/);
  });

  it('uses the expanded Learning Path typography hierarchy without the old eyebrow', () => {
    const sidebar = readFileSync('src/components/Sidebar.jsx', 'utf8');
    const css = readFileSync('src/styles/pages/learning-engine.css', 'utf8');
    expect(sidebar).not.toContain('{sidebar.eyebrow}');
    expect(css).toMatch(/\.sidebar-header h2 \{[^}]*margin: 0;[^}]*font-size: 1rem;/);
    expect(css).toMatch(/\.sidebar-summary \{[^}]*font-size: \.875rem;/);
    expect(css).toMatch(/\.module-trigger strong \{[^}]*font-size: 1rem;/);
    expect(css).toMatch(/\.module-trigger small \{[^}]*font-size: \.875rem;/);
    expect(css).toMatch(/\.course-section-trigger strong \{[^}]*font-size: 1rem;/);
    expect(css).toMatch(/\.course-section-trigger small \{[^}]*font-size: \.875rem;/);
    expect(css).toMatch(/\.lesson-label \{[^}]*font-size: \.875rem;[^}]*line-height: 1\.45;/);
  });

  it('owns one learner activity authority at the authenticated application boundary', () => {
    const app = readFileSync('src/App.jsx', 'utf8');
    const shell = readFileSync('src/app-shell/AppShell.jsx', 'utf8');
    const layout = readFileSync('src/components/Layout.jsx', 'utf8');
    expect(app).toContain('<LearnerActivityProvider>');
    expect((app.match(/<LearnerActivityProvider>/g) ?? [])).toHaveLength(1);
    expect(shell).not.toContain('<LearnerActivityProvider>');
    expect(layout).not.toContain('<LearnerActivityProvider>');
  });
});
