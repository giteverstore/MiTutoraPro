import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Firestore, Timestamp } from '@google-cloud/firestore';
import { CoinLedgerService } from '../../functions/src/coins/CoinLedgerService.js';
import { CoinRewardPolicy } from '../../functions/src/coins/CoinRewardPolicy.js';
import { MvpActivityRewardClaimService } from '../../functions/src/coins/MvpActivityRewardClaimService.js';
import { MvpActivityCompletionService } from '../../functions/src/coins/MvpActivityCompletionService.js';

const PROJECT_ID = 'demo-local-coin-ledger';
let db;
const fixedTimestamp = Timestamp.fromMillis(Date.UTC(2026, 7, 1, 6));
const principal = { authenticated: true, uid: 'activity-user' };
const practiceRequest = { activityType: 'PRACTICE', activityId: 'practice-1', activityVersion: 'v2' };

function resolverFor({ occurrence = '', version = 'v2' } = {}) {
  return { resolve: async ({ activityType, activityId }) => ({ activityType, activityId, activityVersion: version, occurrence }) };
}

function serviceFor({ now = new Date('2026-08-01T06:00:00Z'), resolver = resolverFor(), entries, limits } = {}) {
  const ledger = new CoinLedgerService({ db, timestamp: () => fixedTimestamp });
  const policy = new CoinRewardPolicy(entries ?? [{ activityType: 'PRACTICE', activityId: 'practice-1', activityVersion: 'v2', policyVersion: 'mvp-test-v1', amount: 5 }]);
  const rewardService = new MvpActivityRewardClaimService({ ledger, resolver, policy, timestamp: () => fixedTimestamp, now: () => now });
  return new MvpActivityCompletionService({ db, resolver, rewardService, now: () => now, timestamp: () => fixedTimestamp, limits });
}

beforeAll(() => {
  if (process.env.COIN_LEDGER_EMULATOR_TEST !== 'true' || !process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Coin emulator isolation marker is missing.');
  db = new Firestore({ projectId: PROJECT_ID });
});
beforeEach(async () => { await db.recursiveDelete(db.collection('users')); await db.recursiveDelete(db.collection('coinIdempotency')); });
afterAll(async () => { if (db) await db.terminate(); });

describe.sequential('durable MVP activity completion, streak, and abuse controls', () => {
  it('persists a canonical Practice completion and atomically credits the configured synthetic policy', async () => {
    const result = await serviceFor().complete({ principal, request: practiceRequest });
    expect(result).toMatchObject({ completionStatus: 'completed', rewardStatus: 'credited', streakStatus: 'applied', streak: { currentStreak: 1, longestStreak: 1 } });
    const [completion] = (await db.collection('users/activity-user/activityCompletions').get()).docs.map((doc) => doc.data());
    expect(completion).toMatchObject({ ownerUid: 'activity-user', verificationAssurance: 'LOCAL_VERIFIED_ACTIVITY', completionCount: 1, rewardStatus: 'CREDITED', streakStatus: 'APPLIED' });
    expect(completion).not.toHaveProperty('sourceCode');
    expect(completion).not.toHaveProperty('compilerOutput');
  });

  it('collapses concurrent duplicate completion, reward, and streak mutations', async () => {
    const service = serviceFor();
    const results = await Promise.all(Array.from({ length: 6 }, () => service.complete({ principal, request: practiceRequest })));
    expect(results.filter(({ completionStatus }) => completionStatus === 'completed')).toHaveLength(1);
    expect((await db.collection('users/activity-user/activityCompletions').get()).size).toBe(1);
    expect((await db.collection('users/activity-user/coinTransactions').get()).size).toBe(1);
    expect((await db.collection('users/activity-user/streakEvents').get()).size).toBe(1);
    expect((await db.doc('users/activity-user/streak/summary').get()).data()).toMatchObject({ currentStreak: 1, longestStreak: 1, revision: 1 });
  });

  it('persists completion when the production-style reward policy is disabled', async () => {
    const service = serviceFor({ entries: [] });
    const result = await service.complete({ principal, request: practiceRequest });
    expect(result).toMatchObject({ completionStatus: 'completed', rewardStatus: 'activity_not_rewardable' });
    expect((await db.collection('users/activity-user/activityCompletions').get()).size).toBe(1);
    expect((await db.collection('users/activity-user/coinTransactions').get()).size).toBe(0);
  });

  it('uses canonical Daily Challenge occurrence and rejects a client-supplied date', async () => {
    const request = { activityType: 'DAILY_CHALLENGE', activityId: 'challenge-1', activityVersion: 'v1' };
    const resolver = resolverFor({ occurrence: '2026-08-01', version: 'v1' });
    const service = serviceFor({ resolver, entries: [{ activityType: 'DAILY_CHALLENGE', activityId: 'challenge-1', activityVersion: 'v1', policyVersion: 'mvp-test-v1', amount: 3 }] });
    await expect(service.complete({ principal, request: { ...request, occurrenceDate: '2099-01-01' } })).rejects.toMatchObject({ code: 'coin/client-authority-rejected' });
    await expect(service.complete({ principal, request })).resolves.toMatchObject({ completionStatus: 'completed' });
    const [completion] = (await db.collection('users/activity-user/activityCompletions').get()).docs.map((doc) => doc.data());
    expect(completion).toMatchObject({ occurrenceDate: '2026-08-01', eventDate: '2026-08-01' });
  });

  it('applies deterministic Asia/Kolkata consecutive, same-day, missed-day, and longest-streak semantics', async () => {
    const dates = ['2026-08-01T18:00:00Z', '2026-08-01T18:20:00Z', '2026-08-02T18:20:00Z', '2026-08-04T18:20:00Z'];
    for (let index = 0; index < dates.length; index += 1) {
      const request = { activityType: 'PRACTICE', activityId: `p-${index}`, activityVersion: 'v2' };
      const service = serviceFor({ now: new Date(dates[index]), resolver: resolverFor(), entries: [{ activityType: 'PRACTICE', activityId: `p-${index}`, activityVersion: 'v2', policyVersion: 'mvp-test-v1', amount: 1 }] });
      await service.complete({ principal, request });
    }
    expect((await db.doc('users/activity-user/streak/summary').get()).data()).toMatchObject({ currentStreak: 1, longestStreak: 2, lastQualifiedDate: '2026-08-04' });
  });

  it('enforces bounded activity attempts without writing another economic mutation', async () => {
    const service = serviceFor({ limits: { attemptsPerDay: 1, completionsPerDay: 1, rewardClaimsPerDay: 1 } });
    await service.complete({ principal, request: practiceRequest });
    await expect(service.complete({ principal, request: practiceRequest })).rejects.toMatchObject({ code: 'coin/activity-rate-limited' });
    expect((await db.collection('users/activity-user/coinTransactions').get()).size).toBe(1);
  });

  it('credits 5-coin Practice and 20-coin Challenge policies and never duplicates either logical reward', async () => {
    const policy = [
      { activityType: 'PRACTICE', activityVersion: 'v2', policyVersion: 'mvp-v1', amount: 5 },
      { activityType: 'DAILY_CHALLENGE', activityVersion: 'v1', policyVersion: 'mvp-v1', amount: 20 },
    ];
    const practiceService = serviceFor({ entries: policy });
    await expect(practiceService.complete({ principal, request: practiceRequest })).resolves.toMatchObject({ rewardStatus: 'credited', rewardAmount: 5, balance: 5 });
    await expect(practiceService.complete({ principal, request: practiceRequest })).resolves.toMatchObject({ rewardStatus: 'already_claimed', rewardAmount: 0, balance: null });
    const challengeRequest = { activityType: 'DAILY_CHALLENGE', activityId: 'challenge-1', activityVersion: 'v1' };
    const challengeService = serviceFor({ resolver: resolverFor({ occurrence: '2026-08-01', version: 'v1' }), entries: policy });
    await expect(challengeService.complete({ principal, request: challengeRequest })).resolves.toMatchObject({ rewardStatus: 'credited', rewardAmount: 20, balance: 25 });
    await expect(challengeService.complete({ principal, request: challengeRequest })).resolves.toMatchObject({ rewardStatus: 'already_claimed', rewardAmount: 0, balance: null });
    expect((await db.collection('users/activity-user/coinTransactions').get()).size).toBe(2);
  });

  it('allows exactly 95 + Practice and keeps the usage projection equal to ledger credits', async () => {
    const entries = [{ activityType: 'PRACTICE', activityVersion: 'v2', policyVersion: 'mvp-v1', amount: 5 }];
    for (let index = 0; index < 20; index += 1) {
      const request = { activityType: 'PRACTICE', activityId: `cap-${index}`, activityVersion: 'v2' };
      await serviceFor({ entries }).complete({ principal, request });
    }
    const usage = (await db.doc('users/activity-user/activityUsage/2026-08-01').get()).data();
    const accountData = (await db.doc('users/activity-user/coinAccount/summary').get()).data();
    const ledger = await db.collection('users/activity-user/coinTransactions').get();
    expect(usage.rewardCoinsCredited).toBe(100);
    expect(accountData).toMatchObject({ availableBalance: 100, lifetimeEarned: 100, revision: 20 });
    expect(ledger.docs.reduce((total, document) => total + document.data().amount, 0)).toBe(usage.rewardCoinsCredited);

    const practiceAtCap = await serviceFor({ entries }).complete({ principal, request: { activityType: 'PRACTICE', activityId: 'over-cap-practice', activityVersion: 'v2' } });
    expect(practiceAtCap).toMatchObject({ completionStatus: 'completed', rewardStatus: 'daily_reward_cap_reached', rewardAmount: 0 });
    const challengeAtCap = await serviceFor({
      resolver: resolverFor({ occurrence: '2026-08-01', version: 'v1' }),
      entries: [{ activityType: 'DAILY_CHALLENGE', activityVersion: 'v1', policyVersion: 'mvp-v1', amount: 20 }],
    }).complete({ principal, request: { activityType: 'DAILY_CHALLENGE', activityId: 'over-cap-challenge', activityVersion: 'v1' } });
    expect(challengeAtCap).toMatchObject({ completionStatus: 'completed', rewardStatus: 'daily_reward_cap_reached', rewardAmount: 0 });
    expect((await db.collection('users/activity-user/coinTransactions').get()).size).toBe(20);
  });

  it('rejects 95 + Challenge without partial credit while preserving completion and streak', async () => {
    const practiceEntries = [{ activityType: 'PRACTICE', activityVersion: 'v2', policyVersion: 'mvp-v1', amount: 5 }];
    for (let index = 0; index < 19; index += 1) {
      await serviceFor({ entries: practiceEntries }).complete({ principal, request: { activityType: 'PRACTICE', activityId: `near-${index}`, activityVersion: 'v2' } });
    }
    const challenge = serviceFor({
      resolver: resolverFor({ occurrence: '2026-08-01', version: 'v1' }),
      entries: [{ activityType: 'DAILY_CHALLENGE', activityVersion: 'v1', policyVersion: 'mvp-v1', amount: 20 }],
    });
    const result = await challenge.complete({ principal, request: { activityType: 'DAILY_CHALLENGE', activityId: 'near-cap-challenge', activityVersion: 'v1' } });
    expect(result).toMatchObject({ completionStatus: 'completed', rewardStatus: 'daily_reward_cap_reached', rewardAmount: 0, streakStatus: 'applied' });
    expect((await db.doc('users/activity-user/activityUsage/2026-08-01').get()).data().rewardCoinsCredited).toBe(95);
    expect((await db.doc('users/activity-user/coinAccount/summary').get()).data().availableBalance).toBe(95);
    expect((await db.collection('users/activity-user/coinTransactions').get()).size).toBe(19);
    expect((await db.collection('users/activity-user/activityCompletions').get()).size).toBe(20);
  });

  it('serializes concurrent distinct claims near the cap and never exceeds 100', async () => {
    const entries = [{ activityType: 'PRACTICE', activityVersion: 'v2', policyVersion: 'mvp-v1', amount: 5 }];
    for (let index = 0; index < 19; index += 1) {
      await serviceFor({ entries }).complete({ principal, request: { activityType: 'PRACTICE', activityId: `race-seed-${index}`, activityVersion: 'v2' } });
    }
    const requests = ['race-a', 'race-b', 'race-c'].map((activityId) => serviceFor({ entries }).complete({ principal, request: { activityType: 'PRACTICE', activityId, activityVersion: 'v2' } }));
    const results = await Promise.all(requests);
    expect(results.filter(({ rewardStatus }) => rewardStatus === 'credited')).toHaveLength(1);
    expect(results.filter(({ rewardStatus }) => rewardStatus === 'daily_reward_cap_reached')).toHaveLength(2);
    expect((await db.doc('users/activity-user/activityUsage/2026-08-01').get()).data().rewardCoinsCredited).toBe(100);
    expect((await db.doc('users/activity-user/coinAccount/summary').get()).data().availableBalance).toBe(100);
  });

  it('resets the reward allowance on the next Asia/Kolkata platform day', async () => {
    const entries = [{ activityType: 'DAILY_CHALLENGE', activityVersion: 'v1', policyVersion: 'mvp-v1', amount: 20 }];
    for (let index = 0; index < 5; index += 1) {
      const occurrence = `2026-08-0${index + 1}`;
      await serviceFor({ resolver: resolverFor({ occurrence, version: 'v1' }), entries }).complete({ principal, request: { activityType: 'DAILY_CHALLENGE', activityId: `day-one-${index}`, activityVersion: 'v1' } });
    }
    const nextDay = new Date('2026-08-01T19:00:00Z');
    const result = await serviceFor({ now: nextDay, resolver: resolverFor({ occurrence: '2026-08-02', version: 'v1' }), entries }).complete({ principal, request: { activityType: 'DAILY_CHALLENGE', activityId: 'next-day', activityVersion: 'v1' } });
    expect(result).toMatchObject({ rewardStatus: 'credited', rewardAmount: 20, balance: 120 });
    expect((await db.doc('users/activity-user/activityUsage/2026-08-02').get()).data().rewardCoinsCredited).toBe(20);
  });
});
