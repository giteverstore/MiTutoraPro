import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DailyChallengeCalendar } from '../../src/home/DailyChallengeCalendar';
import { buildChallengeMonth, dailyChallengeCompletionDates, hasCompletedDailyChallenge, kolkataDate } from '../../src/home/challengeCalendar';
import { createHomeLearningModel } from '../../src/home/homeLearningModel';
import { ContinueLearningSection, LearningStatisticsSection, RecentlyViewedSection } from '../../src/home/HomeSections';

const activity = vi.hoisted(() => ({ status: 'ready', streak: { currentStreak: 8 }, completions: [] }));
vi.mock('../../src/activity/LearnerActivityContext', () => ({ useLearnerActivity: () => activity }));
import { AppTopNavigation } from '../../src/app-shell/AppTopNavigation';
import { AppSidebar } from '../../src/app-shell/AppSidebar';

afterEach(cleanup);

const navigationProps = () => ({
  pageLabel: 'Home', user: { name: 'Avinash Abbigeri', email: 'learner@example.test', avatar: null }, theme: 'light',
  notificationsOpen: false, userMenuOpen: false, onMenuOpen: vi.fn(), onThemeToggle: vi.fn(),
  onNotificationsToggle: vi.fn(), onUserMenuToggle: vi.fn(), onSignOut: vi.fn(),
});

describe('canonical streak navbar', () => {
  it('removes coins and permanent profile text while retaining the avatar and canonical streak', () => {
    activity.status = 'ready'; activity.streak = { currentStreak: 8 }; activity.completions = [];
    render(<AppTopNavigation {...navigationProps()} />);
    expect(screen.getByLabelText("8 day streak. Today's Daily Challenge is not completed.")).toHaveTextContent('8');
    expect(screen.queryByText('coins')).not.toBeInTheDocument();
    expect(screen.queryByText('Learner')).not.toBeInTheDocument();
    expect(screen.queryByText('Avinash Abbigeri')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open user menu' }).querySelector('span')).toBeTruthy();
  });

  it('handles zero, loading and error without fabricating a streak', () => {
    activity.status = 'ready'; activity.streak = null; activity.completions = [];
    const { rerender } = render(<AppTopNavigation {...navigationProps()} />);
    expect(screen.getByLabelText("0 day streak. Today's Daily Challenge is not completed.")).toHaveTextContent('0');
    activity.status = 'loading'; rerender(<AppTopNavigation {...navigationProps()} />);
    expect(screen.getByLabelText('Streak unavailable')).toHaveTextContent('—');
    activity.status = 'error'; rerender(<AppTopNavigation {...navigationProps()} />);
    expect(screen.getByLabelText('Streak unavailable')).not.toHaveTextContent('8');
  });

  it('preserves theme and notification controls', () => {
    activity.status = 'ready'; activity.completions = [];
    render(<AppTopNavigation {...navigationProps()} />);
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('uses canonical today completion only for the flame state while preserving the streak number', () => {
    activity.status = 'ready'; activity.streak = { currentStreak: 5 }; activity.completions = [];
    const { rerender } = render(<AppTopNavigation {...navigationProps()} />);
    const inactive = screen.getByLabelText("5 day streak. Today's Daily Challenge is not completed.");
    expect(inactive).not.toHaveClass('is-today-completed');
    expect(inactive.querySelector('svg')).toHaveAttribute('fill', 'none');
    activity.completions = [{ activityType: 'DAILY_CHALLENGE', occurrenceDate: kolkataDate(), completionStatus: 'COMPLETED' }];
    rerender(<AppTopNavigation {...navigationProps()} />);
    const active = screen.getByLabelText("5 day streak. Today's Daily Challenge completed.");
    expect(active).toHaveClass('is-today-completed');
    expect(active).toHaveTextContent('5');
    expect(active.querySelector('svg')).toHaveAttribute('fill', 'currentColor');
  });

  it('shows the same canonical completion badge in expanded and collapsed Challenges navigation', () => {
    const props = { activePage: 'home', mobileOpen: false, onNavigate: vi.fn(), onToggleCollapsed: vi.fn(), onCloseMobile: vi.fn(), todayChallengeCompleted: true };
    const { container, rerender } = render(<AppSidebar {...props} collapsed={false} />);
    expect(screen.getByRole('button', { name: "Challenges — today's challenge completed" })).toBeInTheDocument();
    expect(container.querySelector('.application-navigation-complete')).toBeInTheDocument();
    rerender(<AppSidebar {...props} collapsed />);
    expect(screen.getByRole('button', { name: "Challenges — today's challenge completed" })).toBeInTheDocument();
    expect(container.querySelector('.application-navigation-complete')).toBeInTheDocument();
  });
});

describe('Daily Challenge calendar model', () => {
  it('uses Asia/Kolkata for the canonical date across a UTC boundary', () => {
    expect(kolkataDate(new Date('2026-09-11T20:00:00Z'))).toBe('2026-09-12');
  });

  it('derives completed, missed, today, future, and unsupported states only from evidence', () => {
    const days = buildChallengeMonth({ month: '2026-09', today: '2026-09-12', challengeDates: ['2026-09-09', '2026-09-10', '2026-09-12', '2026-09-20'], completedDates: ['2026-09-10'], supportedDate: '2026-09-12' });
    const state = (date) => days.find((day) => day.id === date);
    expect(state('2026-09-09')).toMatchObject({ state: 'PAST_MISSED', clickable: false });
    expect(state('2026-09-10').state).toBe('PAST_COMPLETED');
    expect(state('2026-09-11').state).toBe('UNAVAILABLE');
    expect(state('2026-09-12')).toMatchObject({ state: 'TODAY_INCOMPLETE', current: true, clickable: true });
    expect(state('2026-09-20')).toMatchObject({ state: 'FUTURE', clickable: false });
  });

  it('marks today completed from durable Daily Challenge occurrences only', () => {
    const completedDates = dailyChallengeCompletionDates([
      { activityType: 'DAILY_CHALLENGE', completionStatus: 'COMPLETED', occurrenceDate: '2026-09-12' },
      { activityType: 'PRACTICE', completionStatus: 'COMPLETED', occurrenceDate: '2026-09-11' },
    ]);
    expect(completedDates).toEqual(['2026-09-12']);
    expect(buildChallengeMonth({ month: '2026-09', today: '2026-09-12', challengeDates: ['2026-09-12'], completedDates, supportedDate: '2026-09-12' }).find((day) => day.id === '2026-09-12').state).toBe('TODAY_COMPLETED');
  });

  it('resets the visual completion signal on the next canonical Asia/Kolkata day', () => {
    const completions = [{ activityType: 'DAILY_CHALLENGE', completionStatus: 'COMPLETED', occurrenceDate: '2026-09-13' }];
    expect(hasCompletedDailyChallenge(completions, '2026-09-13')).toBe(true);
    expect(hasCompletedDailyChallenge(completions, '2026-09-14')).toBe(false);
  });
});

describe('Daily Challenge calendar UI', () => {
  const props = { today: '2026-09-12', challengeDates: ['2026-09-11', '2026-09-12'], completedDates: ['2026-09-11'], supportedDate: '2026-09-12', historyStatus: 'ready', catalogStatus: 'ready', onOpenChallenge: vi.fn() };

  const visibleCellContent = (name) => screen.getByRole('gridcell', { name }).querySelector('[aria-hidden="true"]')?.textContent;

  it('renders the current month, accessible day states, shared streak and supported navigation', () => {
    render(<DailyChallengeCalendar {...props} />);
    expect(screen.getByRole('heading', { name: 'September 2026' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('gridcell', { name: 'September 11, Daily Challenge completed' }));
    expect(props.onOpenChallenge).toHaveBeenCalledWith('2026-09-11');
    fireEvent.click(screen.getByRole('gridcell', { name: 'September 12, Daily Challenge available' }));
    expect(props.onOpenChallenge).toHaveBeenCalledWith('2026-09-12');
    expect(screen.getByRole('gridcell', { name: 'September 13, future day' })).toBeDisabled();
  });

  it('shows numbers for incomplete, missed, future and unavailable dates', () => {
    render(<DailyChallengeCalendar {...props} challengeDates={['2026-09-10', '2026-09-12']} completedDates={[]} />);
    expect(visibleCellContent('September 12, Daily Challenge available')).toBe('12');
    expect(visibleCellContent('September 10, Daily Challenge missed')).toBe('10');
    expect(visibleCellContent('September 13, future day')).toBe('13');
    expect(visibleCellContent('September 11, no challenge available')).toBe('11');
  });

  it('replaces completed date numbers with a checkmark while retaining accessible date identity', () => {
    render(<DailyChallengeCalendar {...props} completedDates={['2026-09-11', '2026-09-12']} />);
    const historical = screen.getByRole('gridcell', { name: 'September 11, Daily Challenge completed' });
    const today = screen.getByRole('gridcell', { name: 'September 12, Daily Challenge completed' });
    expect(visibleCellContent('September 11, Daily Challenge completed')).toBe('✓');
    expect(visibleCellContent('September 12, Daily Challenge completed')).toBe('✓');
    expect(historical).not.toHaveTextContent('11');
    expect(today).not.toHaveTextContent('12');
    fireEvent.click(historical);
    expect(props.onOpenChallenge).toHaveBeenCalledWith('2026-09-11');
  });

  it('updates today from its number to a checkmark after canonical activity refresh without remounting', () => {
    const { rerender } = render(<DailyChallengeCalendar {...props} completedDates={[]} />);
    expect(visibleCellContent('September 12, Daily Challenge available')).toBe('12');
    rerender(<DailyChallengeCalendar {...props} completedDates={['2026-09-12']} />);
    expect(visibleCellContent('September 12, Daily Challenge completed')).toBe('✓');
  });

  it('does not mark a failed or non-canonical completion and treats duplicates as one completed state', () => {
    const failedDates = dailyChallengeCompletionDates([
      { activityType: 'DAILY_CHALLENGE', completionStatus: 'FAILED', occurrenceDate: '2026-09-12' },
      { activityType: 'PRACTICE', completionStatus: 'COMPLETED', occurrenceDate: '2026-09-12' },
    ]);
    const { rerender } = render(<DailyChallengeCalendar {...props} completedDates={failedDates} />);
    expect(visibleCellContent('September 12, Daily Challenge available')).toBe('12');
    const duplicateDates = dailyChallengeCompletionDates([
      { activityType: 'DAILY_CHALLENGE', completionStatus: 'COMPLETED', occurrenceDate: '2026-09-12' },
      { activityType: 'DAILY_CHALLENGE', completionStatus: 'COMPLETED', occurrenceDate: '2026-09-12' },
    ]);
    rerender(<DailyChallengeCalendar {...props} completedDates={duplicateDates} />);
    expect(visibleCellContent('September 12, Daily Challenge completed')).toBe('✓');
  });

  it('preserves canonical completion marks across month navigation', () => {
    render(<DailyChallengeCalendar {...props} challengeDates={['2026-08-20', '2026-09-12']} completedDates={['2026-08-20']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(visibleCellContent('August 20, Daily Challenge completed')).toBe('✓');
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(visibleCellContent('August 20, Daily Challenge completed')).toBe('✓');
  });

  it('supports month navigation and honest loading/error states', () => {
    const { rerender } = render(<DailyChallengeCalendar {...props} historyStatus="loading" />);
    expect(screen.getByText('Loading challenge calendar…')).toBeInTheDocument();
    rerender(<DailyChallengeCalendar {...props} catalogStatus="error" />);
    expect(screen.getByText('Challenge calendar unavailable.')).toBeInTheDocument();
    rerender(<DailyChallengeCalendar {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('heading', { name: 'August 2026' })).toBeInTheDocument();
  });

  it('initializes from canonical today even when all published challenge data is historical, then preserves user navigation', () => {
    const { rerender } = render(<DailyChallengeCalendar {...props} challengeDates={['2026-08-01']} supportedDate="2026-08-01" />);
    expect(screen.getByRole('heading', { name: 'September 2026' })).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: 'September 12, no challenge available' })).toHaveAttribute('aria-current', 'date');
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByRole('heading', { name: 'August 2026' })).toBeInTheDocument();
    rerender(<DailyChallengeCalendar {...props} challengeDates={['2026-08-01', '2026-09-12']} supportedDate="2026-09-12" />);
    expect(screen.getByRole('heading', { name: 'August 2026' })).toBeInTheDocument();
  });

  it('keeps streak presentation out of the calendar and statistics and has no Weekly Premium UI', () => {
    const model = createHomeLearningModel({ challengesCompleted: 2 });
    render(<DailyChallengeCalendar {...props} />);
    expect(model.statistics.some((item) => item.id === 'streak')).toBe(false);
    expect(model.statistics.find((item) => item.id === 'challenges').value).toBe('2');
    expect(screen.queryByLabelText(/day streak/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Weekly Premium/i)).not.toBeInTheDocument();
  });

  it('deduplicates canonical challenge occurrences and excludes Practice completions', () => {
    expect(dailyChallengeCompletionDates([
      { activityType: 'DAILY_CHALLENGE', completionStatus: 'COMPLETED', occurrenceDate: '2026-09-12' },
      { activityType: 'DAILY_CHALLENGE', completionStatus: 'COMPLETED', occurrenceDate: '2026-09-12' },
      { activityType: 'PRACTICE', completionStatus: 'COMPLETED', occurrenceDate: '2026-09-13' },
    ])).toEqual(['2026-09-12']);
  });

  it('retains a full-width mobile layout without horizontal overflow rules', () => {
    const css = readFileSync('src/styles.css', 'utf8');
    expect(css).toMatch(/@media \(max-width: 1000px\)[\s\S]*"statistics" auto "calendar" auto "continue" auto "recent"/);
    expect(css).toMatch(/@media \(max-width: 700px\)[\s\S]*\.challenge-calendar-card \{ width: 100%/);
    expect(css).toContain('.challenge-calendar-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr))');
  });
});

describe('compact Home presentation', () => {
  it('removes redundant Home eyebrows while preserving section headings, statistics, and empty states', () => {
    render(<>
      <LearningStatisticsSection status="ready" statistics={createHomeLearningModel().statistics} />
      <ContinueLearningSection status="ready" course={null} onBrowseLibrary={vi.fn()} />
      <RecentlyViewedSection courses={[]} onOpenCourse={vi.fn()} />
    </>);
    expect(screen.queryByText(/Your momentum/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Your learning/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pick up where you left off/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Learning Statistics' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Continue Learning' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recently Viewed' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getByRole('heading', { name: 'Start a new course' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No recently viewed courses' })).toBeInTheDocument();
  });

  it('keeps desktop columns independent and uses compact token-based spacing', () => {
    const css = readFileSync('src/styles.css', 'utf8');
    expect(css).toContain('padding: clamp(var(--space-6), 3vw, var(--space-10)) 0 var(--space-20);');
    expect(css).toContain('margin-bottom: clamp(var(--space-5), 2vw, var(--space-7));');
    expect(css).toContain('.home-dashboard-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(18rem, 21rem)');
    expect(css).toContain('.home-dashboard-primary { display: grid; min-width: 0; gap: clamp(var(--space-7), 3vw, var(--space-10)); }');
    expect(css).toContain('.home-dashboard-primary { display: contents; }');
    expect(css).toMatch(/\.home-course-empty \{[\s\S]*?min-height: 0;/);
  });
});
