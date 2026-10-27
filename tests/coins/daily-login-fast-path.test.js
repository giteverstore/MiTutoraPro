import { describe, expect, it, vi } from 'vitest';
import { CoinLedgerService } from '../../functions/src/coins/CoinLedgerService.js';
import { DailyLoginRewardService } from '../../functions/src/coins/DailyLoginRewardService.js';
import { CoinRewardPolicy } from '../../functions/src/coins/CoinRewardPolicy.js';

const snapshot = (value) => ({ exists: value !== undefined, data: () => value });

function firestoreDouble() {
  const documents = new Map();
  const doc = (path) => ({ path });
  const getAll = vi.fn(async (...refs) => refs.map((ref) => snapshot(documents.get(ref.path))));
  const transactionGetAll = vi.fn(async (...refs) => refs.map((ref) => snapshot(documents.get(ref.path))));
  const runTransaction = vi.fn(async (action) => action({
    getAll: transactionGetAll,
    create(ref, value) { if (documents.has(ref.path)) throw new Error('already exists'); documents.set(ref.path, value); },
    set(ref, value) { documents.set(ref.path, value); },
    update(ref, value) { documents.set(ref.path, { ...documents.get(ref.path), ...value }); },
  }));
  return { db: { doc, getAll, runTransaction }, documents, getAll, transactionGetAll, runTransaction };
}

describe('daily login replay fast path', () => {
  it('uses one bounded replay read and skips a mutation transaction after the first atomic claim', async () => {
    const store = firestoreDouble();
    const timing = { read: vi.fn((action) => action()), transaction: vi.fn((action) => action()) };
    const policy = new CoinRewardPolicy([{
      activityType: 'DAILY_LOGIN', activityVersion: 'v1', policyVersion: 'login-test-v1', amount: 1,
    }]);
    const service = new DailyLoginRewardService({
      ledger: new CoinLedgerService({ db: store.db, timestamp: () => 'fixed' }),
      policy,
      now: () => new Date('2026-09-10T10:00:00.000Z'),
      timestamp: () => 'fixed',
      claimTiming: timing,
    });
    const input = { principal: { authenticated: true, uid: 'learner-a' }, request: {} };

    await expect(service.claim(input)).resolves.toMatchObject({ status: 'credited', rewardAmount: 1, balance: 1, revision: 1 });
    expect(store.getAll).toHaveBeenCalledTimes(1);
    expect(store.getAll.mock.calls[0]).toHaveLength(2);
    expect(store.runTransaction).toHaveBeenCalledTimes(1);
    expect(store.transactionGetAll).toHaveBeenCalledTimes(1);
    expect(store.transactionGetAll.mock.calls[0]).toHaveLength(5);

    await expect(service.claim(input)).resolves.toMatchObject({ status: 'already_claimed', rewardAmount: 0, balance: 1, revision: 1 });
    expect(store.getAll).toHaveBeenCalledTimes(2);
    expect(store.runTransaction).toHaveBeenCalledTimes(1);
    expect(store.transactionGetAll).toHaveBeenCalledTimes(1);
    expect(timing.transaction).toHaveBeenCalledTimes(1);
  });
});
