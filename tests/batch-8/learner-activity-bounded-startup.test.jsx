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

let observed;
function Consumer() { observed = useLearnerActivity(); return <span>{observed.status}</span>; }

describe('bounded learner activity startup', () => {
  beforeEach(() => {
    observed = null; vi.clearAllMocks();
    repository.getStreakSummary.mockResolvedValue({ currentStreak: 3 });
    repository.getTodayChallengeCompletion.mockResolvedValue(null);
    repository.listCompletionsForDateRange.mockResolvedValue([]);
    repository.listCompletionsForActivityType.mockResolvedValue([]);
    repository.countCompleted.mockResolvedValue(0);
  });

  it('loads only streak and today completion at authenticated provider mount', async () => {
    render(<LearnerActivityProvider><Consumer /></LearnerActivityProvider>);
    await waitFor(() => expect(observed.status).toBe('ready'));
    expect(repository.getStreakSummary).toHaveBeenCalledTimes(1);
    expect(repository.getTodayChallengeCompletion).toHaveBeenCalledTimes(1);
    expect(repository.listCompletions).not.toHaveBeenCalled();
    expect(repository.listCompletionsForDateRange).not.toHaveBeenCalled();
    expect(repository.listCompletionsForActivityType).not.toHaveBeenCalled();
    await observed.refresh();
    expect(repository.listCompletions).not.toHaveBeenCalled();
  });

  it('restores and locally updates today completion without listing history', async () => {
    repository.getTodayChallengeCompletion.mockResolvedValue({ id: 'today', activityType: 'DAILY_CHALLENGE', occurrenceDate: '2026-10-26', completionStatus: 'COMPLETED' });
    render(<LearnerActivityProvider><Consumer /></LearnerActivityProvider>);
    await waitFor(() => expect(observed.completions).toHaveLength(1));
    observed.recordCompletion({ id: 'practice-1', activityType: 'PRACTICE', activityId: 'p-1', completionStatus: 'COMPLETED' });
    await waitFor(() => expect(observed.completions).toHaveLength(2));
    expect(repository.listCompletions).not.toHaveBeenCalled();
  });
});
