import { describe, expect, it, vi } from 'vitest';
import { CoinRewardPolicy, MVP_DAILY_ACTIVITY_COIN_CAP, coinRewardPolicy } from '../../functions/src/coins/CoinRewardPolicy.js';
import { DailyLoginRewardService, dailyLoginCalendarDate } from '../../functions/src/coins/DailyLoginRewardService.js';

const fixedTimestamp = 'fixed-timestamp';
const policy = new CoinRewardPolicy([{
  activityType: 'DAILY_LOGIN',
  activityVersion: 'v1',
  policyVersion: 'login-v1',
  amount: 1,
}]);

function setup({ now = new Date('2026-09-10T10:00:00.000Z'), duplicate = false } = {}) {
  const ledger = {
    claimActivityReward: vi.fn(async (_mutation, _claim, options) => {
      await options.verifyEligibility({});
      return { duplicate, balance: 12, revision: 3 };
    }),
  };
  const service = new DailyLoginRewardService({ ledger, policy, now: () => now, timestamp: () => fixedTimestamp });
  return { ledger, service };
}

describe('server-authoritative daily login reward', () => {
  it('preserves canonical Practice +5 and Daily Challenge +20 while adding Daily Login +1', () => {
    expect(coinRewardPolicy.getActivityRewardPolicy('PRACTICE', 'question-1', 'v2').amount).toBe(5);
    expect(coinRewardPolicy.getActivityRewardPolicy('DAILY_CHALLENGE', 'challenge-1', 'v1').amount).toBe(20);
    expect(coinRewardPolicy.getActivityRewardPolicy('DAILY_LOGIN', '2026-09-10', 'v1').amount).toBe(1);
  });

  it('derives the Asia/Kolkata calendar date across the midnight boundary', () => {
    expect(dailyLoginCalendarDate(new Date('2026-09-10T18:29:59.000Z'))).toBe('2026-09-10');
    expect(dailyLoginCalendarDate(new Date('2026-09-10T18:30:00.000Z'))).toBe('2026-09-11');
  });

  it('uses IST rather than the UTC calendar date', () => {
    expect(dailyLoginCalendarDate(new Date('2026-09-10T20:00:00.000Z'))).toBe('2026-09-11');
  });

  it('derives UID, date, amount, policy, claim, and daily cap server-side', async () => {
    const { ledger, service } = setup();
    await expect(service.claim({ principal: { authenticated: true, uid: 'learner-a' }, request: {} }))
      .resolves.toEqual({ status: 'credited', rewardAmount: 1, balance: 12, revision: 3 });
    const [mutation, claim, options] = ledger.claimActivityReward.mock.calls[0];
    expect(mutation).toMatchObject({
      uid: 'learner-a', amount: 1, sourceType: 'DAILY_LOGIN', sourceId: '2026-09-10', policyVersion: 'login-v1',
    });
    expect(claim.data).toMatchObject({
      ownerUid: 'learner-a', activityType: 'DAILY_LOGIN', activityId: '2026-09-10', occurrence: '2026-09-10', rewardStatus: 'NOT_GRANTED',
    });
    expect(options.dailyCredit).toEqual({
      path: 'users/learner-a/activityUsage/2026-09-10', cap: MVP_DAILY_ACTIVITY_COIN_CAP, createIfMissing: true,
    });
  });

  it('rejects every client-controlled reward authority field', async () => {
    for (const field of ['uid', 'amount', 'date', 'rewardDate', 'policyVersion', 'balance']) {
      const { ledger, service } = setup();
      await expect(service.claim({ principal: { authenticated: true, uid: 'learner-a' }, request: { [field]: 'forged' } }))
        .rejects.toMatchObject({ code: 'coin/client-authority-rejected' });
      expect(ledger.claimActivityReward).not.toHaveBeenCalled();
    }
  });

  it('rejects unauthenticated claims', async () => {
    const { service } = setup();
    await expect(service.claim({ principal: { authenticated: false, uid: 'learner-a' }, request: {} }))
      .rejects.toMatchObject({ code: 'coin/unauthenticated' });
  });

  it('reports ledger replay without increasing the displayed reward amount', async () => {
    const { service } = setup({ duplicate: true });
    await expect(service.claim({ principal: { authenticated: true, uid: 'learner-a' }, request: {} }))
      .resolves.toEqual({ status: 'already_claimed', rewardAmount: 0, balance: 12, revision: 3 });
  });

  it('creates distinct deterministic claims on the next IST day without backfill', async () => {
    const first = setup({ now: new Date('2026-09-10T18:29:59.000Z') });
    const second = setup({ now: new Date('2026-09-10T18:30:00.000Z') });
    await first.service.claim({ principal: { authenticated: true, uid: 'learner-a' }, request: {} });
    await second.service.claim({ principal: { authenticated: true, uid: 'learner-a' }, request: {} });
    expect(first.ledger.claimActivityReward.mock.calls[0][1].path)
      .not.toBe(second.ledger.claimActivityReward.mock.calls[0][1].path);
  });
});
