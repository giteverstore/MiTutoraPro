import { readFileSync } from 'node:fs';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DailyChallengeCalendar } from '../../src/home/DailyChallengeCalendar';

const homeCss = readFileSync('src/styles/pages/home.css', 'utf8');

describe('Home Daily Challenge presentation', () => {
  it('renders the supplied completed-day image without the old check treatment', () => {
    render(<DailyChallengeCalendar
      today="2026-09-12"
      challengeDates={['2026-09-11', '2026-09-12']}
      completedDates={['2026-09-11']}
      supportedDate="2026-09-12"
      historyStatus="ready"
      catalogStatus="ready"
      onOpenChallenge={vi.fn()}
    />);

    const completed = screen.getByRole('gridcell', { name: 'September 11, challenge completed' });
    expect(completed.querySelector('.challenge-calendar-complete-icon')).toHaveAttribute('src', expect.stringContaining('calendar_checked.png'));
    expect(completed.querySelector('.challenge-calendar-complete')).not.toBeInTheDocument();
    expect(completed.querySelector('svg')).not.toBeInTheDocument();
  });

  it('keeps the completed icon contained and preserves its aspect ratio', () => {
    expect(homeCss).toMatch(/\.challenge-calendar-complete-icon\s*\{[^}]*width:\s*1\.55rem;[^}]*height:\s*1\.55rem;[^}]*object-fit:\s*contain;/s);
    expect(homeCss).not.toMatch(/\.challenge-calendar-complete(?:\s|\{)/);
  });

  it('uses a borderless green Redeem action with accessible focus', () => {
    const onRedeem = vi.fn();
    render(<DailyChallengeCalendar
      today="2026-09-12"
      challengeDates={['2026-09-12']}
      completedDates={[]}
      supportedDate="2026-09-12"
      historyStatus="ready"
      catalogStatus="ready"
      onOpenChallenge={vi.fn()}
      onRedeem={onRedeem}
    />);
    fireEvent.click(screen.getByRole('button', { name: /Redeem/ }));
    expect(onRedeem).toHaveBeenCalledTimes(1);
    expect(homeCss).toMatch(/\.challenge-calendar-redeem button\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;[^}]*color:\s*#2cbb5d;/s);
    expect(homeCss).toMatch(/\.challenge-calendar-redeem button:hover\s*\{[^}]*background:\s*color-mix\(/s);
    expect(homeCss).not.toMatch(/\.challenge-calendar-redeem button:hover\s*\{[^}]*border/s);
    expect(homeCss).toMatch(/\.challenge-calendar-redeem button:focus-visible\s*\{[^}]*outline:\s*3px solid/s);
  });

  it('gives completed today the same transparent completed treatment as historical days', () => {
    const { container } = render(<DailyChallengeCalendar
      today="2026-09-12"
      challengeDates={['2026-09-11', '2026-09-12']}
      completedDates={['2026-09-11', '2026-09-12']}
      supportedDate="2026-09-12"
      historyStatus="ready"
      catalogStatus="ready"
      onOpenChallenge={vi.fn()}
    />);
    const historicalCompleted = container.querySelector('[aria-label="September 11, challenge completed"]');
    const todayCompleted = container.querySelector('[aria-label="September 12, challenge completed"]');
    expect(historicalCompleted).toHaveClass('is-past-completed');
    expect(todayCompleted).toHaveClass('is-today-completed');
    expect(todayCompleted).toHaveAttribute('aria-current', 'date');
    expect(homeCss).toMatch(/\.challenge-calendar-day\.is-past-completed,\s*\.challenge-calendar-day\.is-today-completed\s*\{[^}]*background:\s*transparent/s);
    expect(homeCss).not.toMatch(/\.challenge-calendar-day\.is-today-completed\s*\{[^}]*background:\s*var\(--color-success-soft\)/s);
    expect(homeCss).not.toMatch(/\.challenge-calendar-day\.is-today-completed\s*\{[^}]*border-color:/s);
  });
});
