import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { kolkataDate } from '../../src/home/challengeCalendar';

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
  progress: 42,
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
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42');
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByLabelText("6 day streak. Today's Daily Challenge is not completed.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open user menu' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Variables to Library' })).toBeInTheDocument();
    expect(screen.queryByText('Tester')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
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
