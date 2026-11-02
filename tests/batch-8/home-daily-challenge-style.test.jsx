import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
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

  it('uses the fixed Redeem color and a one-pixel green hover border', () => {
    expect(homeCss).toMatch(/\.challenge-calendar-redeem button\s*\{[^}]*border:\s*1px solid transparent;[^}]*background:\s*transparent;[^}]*color:\s*#2cbb5d;/s);
    expect(homeCss).toMatch(/\.challenge-calendar-redeem button:hover\s*\{[^}]*border-color:\s*#2cbb5d;/s);
    expect(homeCss).toMatch(/\.challenge-calendar-redeem button:focus-visible\s*\{[^}]*outline:\s*3px solid/s);
  });
});
