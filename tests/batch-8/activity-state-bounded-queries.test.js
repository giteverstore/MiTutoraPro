import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({ getDocs: vi.fn(), getCountFromServer: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: (_db, path) => ({ kind: 'collection', path }),
  doc: (_db, path) => ({ kind: 'doc', path }),
  getDoc: vi.fn(),
  getDocs: firestore.getDocs,
  getCountFromServer: firestore.getCountFromServer,
  limit: (value) => ({ kind: 'limit', value }),
  query: (source, ...constraints) => ({ source, constraints }),
  where: (field, operator, value) => ({ kind: 'where', field, operator, value }),
}));
vi.mock('../../src/firebase/firestore', () => ({ db: {} }));

import { ActivityStateRepository } from '../../src/repositories/firestore/ActivityStateRepository';

const snapshot = (items = []) => ({ docs: items.map((data, index) => ({ id: `item-${index}`, data: () => data })) });

describe('ActivityStateRepository bounded query boundaries', () => {
  beforeEach(() => { vi.clearAllMocks(); firestore.getDocs.mockResolvedValue(snapshot()); firestore.getCountFromServer.mockResolvedValue({ data: () => ({ count: 12 }) }); });

  it('uses an exact, limited query for today instead of reading the collection', async () => {
    await new ActivityStateRepository('learner-1').getTodayChallengeCompletion('2026-10-26');
    const request = firestore.getDocs.mock.calls[0][0];
    expect(request.source.path).toBe('users/learner-1/activityCompletions');
    expect(request.constraints).toEqual([
      { kind: 'where', field: 'activityType', operator: '==', value: 'DAILY_CHALLENGE' },
      { kind: 'where', field: 'occurrenceDate', operator: '==', value: '2026-10-26' },
      { kind: 'limit', value: 1 },
    ]);
  });

  it('uses server-side date bounds for a visible challenge period', async () => {
    await new ActivityStateRepository('learner-1').listCompletionsForDateRange('2026-10-01', '2026-10-31');
    expect(firestore.getDocs.mock.calls[0][0].constraints).toEqual([
      { kind: 'where', field: 'occurrenceDate', operator: '>=', value: '2026-10-01' },
      { kind: 'where', field: 'occurrenceDate', operator: '<=', value: '2026-10-31' },
    ]);
  });

  it('uses a server aggregation for totals and a scoped query for Practice', async () => {
    const repository = new ActivityStateRepository('learner-1');
    await expect(repository.countCompleted('DAILY_CHALLENGE')).resolves.toBe(12);
    await repository.listCompletionsForActivityType('PRACTICE');
    expect(firestore.getCountFromServer.mock.calls[0][0].constraints).toHaveLength(2);
    expect(firestore.getDocs.mock.calls[0][0].constraints).toEqual([{ kind: 'where', field: 'activityType', operator: '==', value: 'PRACTICE' }]);
  });
});
