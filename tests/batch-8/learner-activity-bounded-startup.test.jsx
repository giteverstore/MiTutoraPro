import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const repository = vi.hoisted(() => ({
  getStreakSummary: vi.fn(),
  getTodayChallengeCompletion: vi.fn(),
  listCompletions: vi.fn(),
  listCompletionsForDateRange: vi.fn(),
  listCompletionsForActivityType: vi.fn(),
  countCompleted: vi.fn(),
}));

vi.mock('../../src/auth/UserContext', () => ({ useUser: () => ({ user: { id: 'learner-1' } }) }));
vi.mock('../../src/repositories/firestore/ActivityStateRepository', () => ({
  ActivityStateRepository: class ActivityStateRepository {
    getStreakSummary(...args) { return repository.getStreakSummary(...args); }
    getTodayChallengeCompletion(...args) { return repository.getTodayChallengeCompletion(...args); }
    listCompletions(...args) { return repository.listCompletions(...args); }
    listCompletionsForDateRange(...args) { return repository.listCompletionsForDateRange(...args); }
    listCompletionsForActivityType(...args) { return repository.listCompletionsForActivityType(...args); }
    countCompleted(...args) { return repository.countCompleted(...args); }
  },
}));

import { LearnerActivityProvider, useLearnerActivity } from '../../src/activity/LearnerActivityContext';
import { kolkataDate, shiftChallengeDate } from '../../src/home/challengeCalendar';

let observed;
function Consumer() { observed = useLearnerActivity(); return <span>{observed.status}</span>; }

describe('bounded learner activity startup', () => {
  beforeEach(() => {
    observed = null; vi.clearAllMocks();
    repository.getStreakSummary.mockResolvedValue({ currentStreak: 3 });
    const today = kolkataDate();
    repository.listCompletionsForDateRange.mockResolvedValue([-2, -1, 0].map((amount) => ({
      id: `challenge-${amount}`, activityType: 'DAILY_CHALLENGE', occurrenceDate: shiftChallengeDate(today, amount), completionStatus: 'COMPLETED',
    })));
    repository.listCompletionsForActivityType.mockResolvedValue([]);
    repository.countCompleted.mockResolvedValue(0);
  });

  it('loads a bounded streak window at authenticated provider mount', async () => {
    render(<LearnerActivityProvider><Consumer /></LearnerActivityProvider>);
    await waitFor(() => expect(observed.status).toBe('ready'));
    expect(repository.getStreakSummary).toHaveBeenCalledTimes(1);
    expect(repository.getTodayChallengeCompletion).not.toHaveBeenCalled();
    expect(repository.listCompletions).not.toHaveBeenCalled();
    expect(repository.listCompletionsForDateRange).toHaveBeenCalledWith(shiftChallengeDate(kolkataDate(), -3), kolkataDate());
    expect(repository.listCompletionsForActivityType).not.toHaveBeenCalled();
    expect(observed.streak.currentStreak).toBe(3);
    await observed.refresh();
    expect(repository.listCompletions).not.toHaveBeenCalled();
  });

  it('restores and locally updates completion state without listing unbounded history', async () => {
    repository.getStreakSummary.mockResolvedValue({ currentStreak: 1 });
    repository.listCompletionsForDateRange.mockResolvedValue([{ id: 'today', activityType: 'DAILY_CHALLENGE', occurrenceDate: kolkataDate(), completionStatus: 'COMPLETED' }]);
    render(<LearnerActivityProvider><Consumer /></LearnerActivityProvider>);
    await waitFor(() => expect(observed.completions).toHaveLength(1));
    observed.recordCompletion({ id: 'practice-1', activityType: 'PRACTICE', activityId: 'p-1', occurrenceDate: kolkataDate(), completionStatus: 'COMPLETED' });
    await waitFor(() => expect(observed.completions).toHaveLength(2));
    await observed.refresh();
    await waitFor(() => expect(observed.completions).toHaveLength(2));
    expect(observed.completions).toContainEqual(expect.objectContaining({ id: 'practice-1' }));
    expect(repository.listCompletions).not.toHaveBeenCalled();
  });

  it('does not expose a stale persisted streak after yesterday was missed', async () => {
    repository.getStreakSummary.mockResolvedValue({ currentStreak: 5, longestStreak: 8 });
    repository.listCompletionsForDateRange.mockResolvedValue([{
      id: 'old-challenge', activityType: 'DAILY_CHALLENGE', occurrenceDate: shiftChallengeDate(kolkataDate(), -2), completionStatus: 'COMPLETED',
    }]);
    render(<LearnerActivityProvider><Consumer /></LearnerActivityProvider>);
    await waitFor(() => expect(observed.status).toBe('ready'));
    expect(observed.streak).toMatchObject({ currentStreak: 0, longestStreak: 8 });
  });

  it('starts again at one when today is completed after a missed day', async () => {
    repository.getStreakSummary.mockResolvedValue({ currentStreak: 5, longestStreak: 8 });
    repository.listCompletionsForDateRange.mockResolvedValue([
      { id: 'old-challenge', activityType: 'DAILY_CHALLENGE', occurrenceDate: shiftChallengeDate(kolkataDate(), -2), completionStatus: 'COMPLETED' },
      { id: 'today', activityType: 'DAILY_CHALLENGE', occurrenceDate: kolkataDate(), completionStatus: 'COMPLETED' },
    ]);
    render(<LearnerActivityProvider><Consumer /></LearnerActivityProvider>);
    await waitFor(() => expect(observed.status).toBe('ready'));
    expect(observed.streak).toMatchObject({ currentStreak: 1, longestStreak: 8 });
  });
});
