import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Firestore, Timestamp } from '@google-cloud/firestore';
import { CoinLedgerService } from '../../functions/src/coins/CoinLedgerService.js';
import { CoinRewardPolicy } from '../../functions/src/coins/CoinRewardPolicy.js';
import { RewardClaimService } from '../../functions/src/coins/RewardClaimService.js';
import { MvpActivityRewardClaimService } from '../../functions/src/coins/MvpActivityRewardClaimService.js';

const PROJECT_ID = 'demo-local-coin-ledger';
const fixedTime = Timestamp.fromMillis(Date.UTC(2026, 0, 15, 12));
let db;
let ledger;

const credit = (uid, key, amount = 5, overrides = {}) => ledger.grantCoins({
  uid,
  amount,
  type: 'ACTIVITY_REWARD',
  sourceType: 'PRACTICE',
  sourceId: `question-${key}`,
  idempotencyKey: key,
  policyVersion: 'test-v1',
  ...overrides,
});

const debit = (uid, key, amount) => ledger.debitCoins({
  uid,
  amount,
  type: 'COIN_SPEND',
  sourceType: 'SYSTEM',
  sourceId: `synthetic-spend-${key}`,
  idempotencyKey: key,
  policyVersion: 'test-v1',
});

const account = async (uid) => (await db.doc(`users/${uid}/coinAccount/summary`).get()).data();
const transactions = async (uid) => (await db.collection(`users/${uid}/coinTransactions`).get()).docs.map((item) => item.data());
const claims = async (uid) => (await db.collection(`users/${uid}/rewardClaims`).get()).docs.map((item) => item.data());

async function reset() {
  await db.recursiveDelete(db.collection('users'));
  await db.recursiveDelete(db.collection('coinIdempotency'));
}

beforeAll(async () => {
  if (process.env.COIN_LEDGER_EMULATOR_TEST !== 'true' || !process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Coin emulator isolation marker is missing.');
  expect(process.env.FIREBASE_PROJECT_ID).toBe(PROJECT_ID);
  expect(process.env.FIREBASE_PROJECT_ID).not.toBe('mi-tutora-pro');
  expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toBeUndefined();
  db = new Firestore({ projectId: PROJECT_ID });
  ledger = new CoinLedgerService({ db, timestamp: () => fixedTime });
});

beforeEach(reset);
afterAll(async () => { if (db) { await reset(); await db.terminate(); } });

describe.sequential('server-authoritative MI Coin ledger', () => {
  it('creates an empty account without migrating mock or historical balances', async () => {
    const result = await ledger.ensureAccount('account-user');
    expect(result).toMatchObject({ availableBalance: 0, lifetimeEarned: 0, lifetimeSpent: 0, revision: 0, created: true });
    expect(await account('account-user')).toMatchObject({ availableBalance: 0, revision: 0 });
    expect(await transactions('account-user')).toHaveLength(0);
  });

  it('posts a first credit atomically with its account projection and immutable audit fields', async () => {
    const result = await credit('credit-user', 'first', 8);
    expect(result).toMatchObject({ balance: 8, revision: 1, duplicate: false });
    expect(await account('credit-user')).toMatchObject({ availableBalance: 8, lifetimeEarned: 8, lifetimeSpent: 0, revision: 1 });
    expect(await transactions('credit-user')).toEqual([expect.objectContaining({
      amount: 8, direction: 'CREDIT', type: 'ACTIVITY_REWARD', balanceAfter: 8,
      accountRevision: 1, status: 'POSTED', policyVersion: 'test-v1',
    })]);
  });

  it('accumulates multiple credits and increments the projection revision once per post', async () => {
    await credit('multi-user', 'one', 3);
    await credit('multi-user', 'two', 4);
    expect(await account('multi-user')).toMatchObject({ availableBalance: 7, lifetimeEarned: 7, revision: 2 });
    expect(await transactions('multi-user')).toHaveLength(2);
  });

  it('supports a server-only debit foundation and tracks lifetime spending', async () => {
    await credit('debit-user', 'credit', 10);
    const result = await debit('debit-user', 'debit', 4);
    expect(result).toMatchObject({ balance: 6, revision: 2 });
    expect(await account('debit-user')).toMatchObject({ availableBalance: 6, lifetimeEarned: 10, lifetimeSpent: 4, revision: 2 });
  });

  it('fails closed on insufficient balance without writing a debit or incrementing revision', async () => {
    await credit('insufficient-user', 'credit', 3);
    await expect(debit('insufficient-user', 'too-much', 4)).rejects.toMatchObject({ code: 'coin/insufficient-balance' });
    expect(await account('insufficient-user')).toMatchObject({ availableBalance: 3, revision: 1 });
    expect(await transactions('insufficient-user')).toHaveLength(1);
  });

  it('returns identical reward retries without adding balance, ledger entries, or revisions', async () => {
    const first = await credit('duplicate-user', 'same', 6);
    const before = (await transactions('duplicate-user'))[0];
    const duplicate = await credit('duplicate-user', 'same', 6);
    expect(duplicate).toMatchObject({ transactionId: first.transactionId, balance: 6, revision: 1, duplicate: true });
    expect(await account('duplicate-user')).toMatchObject({ availableBalance: 6, revision: 1 });
    expect(await transactions('duplicate-user')).toEqual([before]);
  });

  it('rejects conflicting reuse of an idempotency key for another amount or source', async () => {
    await credit('conflict-user', 'conflict', 5);
    await expect(credit('conflict-user', 'conflict', 6)).rejects.toMatchObject({ code: 'coin/idempotency-conflict' });
    await expect(credit('conflict-user', 'conflict', 5, { sourceId: 'different-question' })).rejects.toMatchObject({ code: 'coin/idempotency-conflict' });
    expect(await account('conflict-user')).toMatchObject({ availableBalance: 5, revision: 1 });
  });

  it('rejects global idempotency-key reuse by a different user', async () => {
    await credit('first-owner', 'global-key', 5);
    await expect(credit('second-owner', 'global-key', 5)).rejects.toMatchObject({ code: 'coin/idempotency-conflict' });
    expect(await account('second-owner')).toBeUndefined();
  });

  it('converges simultaneous identical grants into one ledger post', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => credit('concurrent-user', 'same-concurrent', 9)));
    expect(results.filter(({ duplicate }) => !duplicate)).toHaveLength(1);
    expect(await account('concurrent-user')).toMatchObject({ availableBalance: 9, revision: 1 });
    expect(await transactions('concurrent-user')).toHaveLength(1);
  });

  it('retries concurrent distinct transactions and preserves exact account/ledger consistency', async () => {
    await Promise.all(Array.from({ length: 10 }, (_, index) => credit('retry-user', `distinct-${index}`, 2)));
    const currentAccount = await account('retry-user');
    const currentTransactions = await transactions('retry-user');
    expect(currentAccount).toMatchObject({ availableBalance: 20, lifetimeEarned: 20, revision: 10 });
    expect(currentTransactions).toHaveLength(10);
    expect(currentTransactions.reduce((sum, item) => sum + item.amount, 0)).toBe(currentAccount.availableBalance);
    expect(Math.max(...currentTransactions.map(({ accountRevision }) => accountRevision))).toBe(currentAccount.revision);
  });

  it('uses trusted timestamps for account, ledger, and replay records', async () => {
    await credit('timestamp-user', 'timestamp', 1);
    const currentAccount = await account('timestamp-user');
    const [entry] = await transactions('timestamp-user');
    const [replay] = (await db.collection('coinIdempotency').get()).docs.map((item) => item.data());
    expect(currentAccount.createdAt.toMillis()).toBe(fixedTime.toMillis());
    expect(currentAccount.updatedAt.toMillis()).toBe(fixedTime.toMillis());
    expect(entry.createdAt.toMillis()).toBe(fixedTime.toMillis());
    expect(replay.createdAt.toMillis()).toBe(fixedTime.toMillis());
  });

  it('rejects malformed, zero, negative, fractional, and unsafe amounts before persistence', async () => {
    for (const [index, amount] of [0, -1, 1.5, '5', Number.MAX_SAFE_INTEGER + 1].entries()) {
      await expect(credit('invalid-user', `bad-${index}`, amount)).rejects.toMatchObject({ code: 'coin/invalid-amount' });
    }
    expect(await account('invalid-user')).toBeUndefined();
    expect(await transactions('invalid-user')).toHaveLength(0);
  });

  it('fails atomically instead of overflowing a safe-integer balance projection', async () => {
    await credit('overflow-user', 'maximum', Number.MAX_SAFE_INTEGER);
    await expect(credit('overflow-user', 'overflow', 1)).rejects.toMatchObject({ code: 'coin/data-integrity' });
    expect(await account('overflow-user')).toMatchObject({ availableBalance: Number.MAX_SAFE_INTEGER, revision: 1 });
    expect(await transactions('overflow-user')).toHaveLength(1);
  });

  it('records trusted completion idempotently and rejects changed evidence', async () => {
    const service = new RewardClaimService({ db, ledger, timestamp: () => fixedTime });
    const input = {
      principal: { uid: 'claim-user', authenticated: true }, activityType: 'PRACTICE', activityId: 'synthetic-question',
      evidenceReference: 'trustedEvidence/session-1', evidenceAssurance: 'SERVER_GRADED', policyVersion: 'test-v1',
    };
    expect(await service.recordCompletion(input)).toMatchObject({ duplicate: false, completionStatus: 'COMPLETED', rewardStatus: 'NOT_GRANTED' });
    expect(await service.recordCompletion(input)).toMatchObject({ duplicate: true });
    await expect(service.recordCompletion({ ...input, evidenceReference: 'trustedEvidence/session-2' })).rejects.toMatchObject({ code: 'coin/claim-conflict' });
    expect(await claims('claim-user')).toHaveLength(1);
  });

  it('fails closed on missing reward policy and leaves the completed claim and balance unchanged', async () => {
    const service = new RewardClaimService({ db, ledger, timestamp: () => fixedTime });
    const principal = { uid: 'no-policy-user', authenticated: true };
    await service.recordCompletion({ principal, activityType: 'PRACTICE', activityId: 'synthetic-question', evidenceReference: 'trustedEvidence/session-1', evidenceAssurance: 'SERVER_GRADED', policyVersion: 'test-v1' });
    await expect(service.grantConfiguredReward({ principal, activityType: 'PRACTICE', activityId: 'synthetic-question', policyVersion: 'test-v1' }))
      .rejects.toMatchObject({ code: 'coin/reward-policy-missing' });
    expect((await claims('no-policy-user'))[0]).toMatchObject({ rewardStatus: 'NOT_GRANTED', rewardTransactionId: null });
    expect(await account('no-policy-user')).toBeUndefined();
  });

  it('atomically grants an explicitly configured synthetic reward and binds the claim to one ledger entry', async () => {
    const policy = new CoinRewardPolicy([{ activityType: 'DAILY_CHALLENGE', activityId: 'synthetic-challenge', policyVersion: 'test-v1', amount: 11 }]);
    const service = new RewardClaimService({ db, ledger, policy, timestamp: () => fixedTime });
    const principal = { uid: 'reward-user', authenticated: true };
    await service.recordCompletion({ principal, activityType: 'DAILY_CHALLENGE', activityId: 'synthetic-challenge', evidenceReference: 'trustedEvidence/session-1', evidenceAssurance: 'SERVER_VALIDATED_EXECUTION', policyVersion: 'test-v1' });
    const first = await service.grantConfiguredReward({ principal, activityType: 'DAILY_CHALLENGE', activityId: 'synthetic-challenge', policyVersion: 'test-v1' });
    const duplicate = await service.grantConfiguredReward({ principal, activityType: 'DAILY_CHALLENGE', activityId: 'synthetic-challenge', policyVersion: 'test-v1' });
    expect(first).toMatchObject({ balance: 11, revision: 1, duplicate: false });
    expect(duplicate).toMatchObject({ transactionId: first.transactionId, balance: 11, revision: 1, duplicate: true });
    expect((await claims('reward-user'))[0]).toMatchObject({ rewardStatus: 'GRANTED', rewardTransactionId: first.transactionId });
    expect(await account('reward-user')).toMatchObject({ availableBalance: 11, lifetimeEarned: 11, revision: 1 });
    expect(await transactions('reward-user')).toHaveLength(1);
  });

  it('atomically collapses concurrent MVP claims into one claim, ledger credit, balance, and revision', async () => {
    const policy = new CoinRewardPolicy([{ activityType: 'PRACTICE', activityId: 'synthetic-mvp', activityVersion: 'v2', policyVersion: 'mvp-test-v1', amount: 4 }]);
    const resolver = { resolve: async () => ({ activityType: 'PRACTICE', activityId: 'synthetic-mvp', activityVersion: 'v2', occurrence: '' }) };
    const service = new MvpActivityRewardClaimService({ db, ledger, policy, resolver, timestamp: () => fixedTime, now: () => new Date('2026-08-01T06:00:00Z') });
    const input = { principal: { authenticated: true, uid: 'mvp-user' }, request: { activityType: 'PRACTICE', activityId: 'synthetic-mvp', activityVersion: 'v2' } };
    await db.doc('users/mvp-user/activityUsage/2026-08-01').set({ completionAttempts: 1, successfulCompletions: 1, rewardClaims: 1, rewardCoinsCredited: 0, schemaVersion: '1.0.0' });
    const results = await Promise.all(Array.from({ length: 8 }, () => service.claimActivityReward(input)));
    expect(results.filter(({ status }) => status === 'credited')).toHaveLength(1);
    expect(results.filter(({ status }) => status === 'already_claimed')).toHaveLength(7);
    expect(await account('mvp-user')).toMatchObject({ availableBalance: 4, lifetimeEarned: 4, revision: 1 });
    expect(await transactions('mvp-user')).toEqual([expect.objectContaining({ amount: 4, balanceAfter: 4, accountRevision: 1, policyVersion: 'mvp-test-v1' })]);
    expect(await claims('mvp-user')).toEqual([expect.objectContaining({ evidenceAssurance: 'LOCAL_VERIFIED_ACTIVITY', rewardStatus: 'GRANTED', policyVersion: 'mvp-test-v1' })]);
  });

  it('leaves all economic state unchanged when transactional canonical eligibility changes', async () => {
    const policy = new CoinRewardPolicy([{ activityType: 'PRACTICE', activityId: 'changing-mvp', activityVersion: 'v2', policyVersion: 'mvp-test-v1', amount: 4 }]);
    let resolutions = 0;
    const resolver = { resolve: async () => ({
      activityType: 'PRACTICE', activityId: 'changing-mvp', activityVersion: ++resolutions === 1 ? 'v2' : 'v3', occurrence: '',
    }) };
    const service = new MvpActivityRewardClaimService({ db, ledger, policy, resolver, timestamp: () => fixedTime });
    await expect(service.claimActivityReward({
      principal: { authenticated: true, uid: 'changed-eligibility-user' },
      request: { activityType: 'PRACTICE', activityId: 'changing-mvp', activityVersion: 'v2' },
    })).resolves.toEqual({ status: 'activity_not_rewardable' });
    expect(await account('changed-eligibility-user')).toBeUndefined();
    expect(await transactions('changed-eligibility-user')).toHaveLength(0);
    expect(await claims('changed-eligibility-user')).toHaveLength(0);
  });
});
