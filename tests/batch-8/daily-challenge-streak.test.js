import { describe, expect, it } from 'vitest';
import { deriveCurrentChallengeStreak } from '../../src/home/challengeCalendar';

const completed = (occurrenceDate, overrides = {}) => ({
  activityType: 'DAILY_CHALLENGE', completionStatus: 'COMPLETED', occurrenceDate, ...overrides,
});

describe('Daily Challenge current streak', () => {
  it.each([
    ['today complete', [completed('2026-11-01')], '2026-11-01', 1],
    ['yesterday and today complete', [completed('2026-10-31'), completed('2026-11-01')], '2026-11-01', 2],
    ['three consecutive days complete', [completed('2026-10-30'), completed('2026-10-31'), completed('2026-11-01')], '2026-11-01', 3],
    ['yesterday-ending streak retained while today is pending', [completed('2026-10-29'), completed('2026-10-30'), completed('2026-10-31')], '2026-11-01', 3],
    ['missed yesterday resets stale streak', [completed('2026-10-30')], '2026-11-01', 0],
    ['today starts a new streak after a missed day', [completed('2026-10-30'), completed('2026-11-01')], '2026-11-01', 1],
    ['year boundary remains consecutive', [completed('2026-12-31'), completed('2027-01-01')], '2027-01-01', 2],
    ['missed year-boundary date resets', [completed('2026-12-30')], '2027-01-01', 0],
  ])('%s', (_label, completions, today, expected) => {
    expect(deriveCurrentChallengeStreak(completions, today)).toBe(expected);
  });

  it('deduplicates and ignores order, malformed dates, future records, and unrelated completions', () => {
    expect(deriveCurrentChallengeStreak([
      completed('2026-11-01'),
      completed('2026-10-31'),
      completed('2026-11-01'),
      completed('2026-10-30'),
      completed('2026-11-02'),
      completed('2026-02-30'),
      completed('not-a-date'),
      completed('2026-10-29', { completionStatus: 'FAILED' }),
      completed('2026-10-29', { activityType: 'PRACTICE' }),
    ], '2026-11-01')).toBe(3);
  });
});
