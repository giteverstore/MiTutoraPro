import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Firestore, Timestamp } from '@google-cloud/firestore';
import { ActivityVerificationService } from '../../functions/src/activity-verification/ActivityVerificationService.js';
import { PracticeVerifier } from '../../functions/src/activity-verification/PracticeVerifier.js';
import { DailyChallengeVerifier } from '../../functions/src/activity-verification/DailyChallengeVerifier.js';
import { CoinLedgerService } from '../../functions/src/coins/CoinLedgerService.js';
import { RewardClaimService } from '../../functions/src/coins/RewardClaimService.js';

const PROJECT_ID = 'demo-local-coin-ledger';
const fixedTime = Timestamp.fromMillis(Date.UTC(2026, 0, 16, 12));
const hash = createHash('sha256').update('synthetic-authoritative-content').digest('hex');
const limits = {
  maxSourceBytes: 4096, maxOutputBytes: 1024, maxTestCount: 4,
  maxTestInputBytes: 1024, executionTimeoutMs: 1000, memoryLimitBytes: 32 * 1024 * 1024,
};
let db;
let ledger;

const activity = (type = 'PRACTICE') => ({
  activityType: type,
  id: type === 'PRACTICE' ? 'synthetic-question' : 'synthetic-challenge',
  version: 'v1', language: 'python', published: true, contentHash: hash,
  verification: { tests: [{ arguments: [1], expected: 2 }, { arguments: [2], expected: 3 }] },
});

function makeService({ passed = true, type = 'PRACTICE' } = {}) {
  const claimService = new RewardClaimService({ db, ledger, timestamp: () => fixedTime });
  const completionRecorder = {
    recordVerifiedCompletion: ({ principal, activity: resolved, evidence }) => claimService.recordCompletion({
      principal: { ...principal, authenticated: true },
      activityType: resolved.activityType,
      activityId: resolved.activityId,
      evidenceReference: evidence.reference,
      evidenceAssurance: evidence.assurance,
      // Synthetic emulator policy identity only; production reward policy remains empty.
      policyVersion: 'test-verification-v1',
    }),
  };
  const executor = {
    securityProfile: {
      isolated: true, hardTimeout: true, networkAccess: false, filesystemAccess: false,
      memoryLimitBytes: limits.memoryLimitBytes, outputLimitBytes: limits.maxOutputBytes,
    },
    execute: vi.fn().mockResolvedValue({ passed, testCount: 2 }),
  };
  return new ActivityVerificationService({
    resolver: { resolve: vi.fn().mockResolvedValue(activity(type)) },
    verifiers: {
      PRACTICE: new PracticeVerifier({ executor }),
      DAILY_CHALLENGE: new DailyChallengeVerifier({ executor }),
    },
    completionRecorder,
    limits,
  });
}

const body = (type = 'PRACTICE') => ({
  activityType: type,
  activityId: type === 'PRACTICE' ? 'synthetic-question' : 'synthetic-challenge',
  contentVersion: 'v1', language: 'python', sourceCode: 'def answer(value): return value + 1',
});
const principal = (uid) => ({ uid, authenticated: true });
const claims = async (uid) => (await db.collection(`users/${uid}/rewardClaims`).get()).docs.map((doc) => doc.data());
const account = async (uid) => (await db.doc(`users/${uid}/coinAccount/summary`).get()).data();

async function reset() {
  await db.recursiveDelete(db.collection('users'));
  await db.recursiveDelete(db.collection('coinIdempotency'));
}

beforeAll(() => {
  if (process.env.COIN_LEDGER_EMULATOR_TEST !== 'true' || !process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Coin emulator isolation marker is missing.');
  expect(process.env.FIREBASE_PROJECT_ID).toBe(PROJECT_ID);
  expect(process.env.FIREBASE_PROJECT_ID).not.toBe('mi-tutora-pro');
  expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toBeUndefined();
  db = new Firestore({ projectId: PROJECT_ID });
  ledger = new CoinLedgerService({ db, timestamp: () => fixedTime });
});
beforeEach(reset);
afterAll(async () => { if (db) { await reset(); await db.terminate(); } });

describe.sequential('authoritative verification persistence boundary', () => {
  it('creates one trusted completion and no coin account after a passing verification', async () => {
    const result = await makeService().verify({ principal: principal('verified-user'), body: body() });
    expect(result).toMatchObject({ verified: true, rewardStatus: 'UNAVAILABLE' });
    expect(await claims('verified-user')).toEqual([expect.objectContaining({
      ownerUid: 'verified-user', completionStatus: 'COMPLETED', rewardStatus: 'NOT_GRANTED',
      evidenceAssurance: 'SERVER_VALIDATED_EXECUTION', rewardTransactionId: null,
    })]);
    expect(await account('verified-user')).toBeUndefined();
  });

  it('creates no claim or balance for a failed verification', async () => {
    await expect(makeService({ passed: false }).verify({ principal: principal('failed-user'), body: body() }))
      .resolves.toMatchObject({ verified: false, status: 'REJECTED' });
    expect(await claims('failed-user')).toHaveLength(0);
    expect(await account('failed-user')).toBeUndefined();
  });

  it('converges concurrent identical successful verification claims', async () => {
    const service = makeService();
    const results = await Promise.all(Array.from({ length: 8 }, () => service.verify({ principal: principal('concurrent-verified'), body: body() })));
    expect(results.filter((result) => !result.duplicate)).toHaveLength(1);
    expect(await claims('concurrent-verified')).toHaveLength(1);
    expect(await account('concurrent-verified')).toBeUndefined();
  });

  it('isolates identical activity verification across users', async () => {
    const service = makeService();
    await Promise.all([
      service.verify({ principal: principal('owner-a'), body: body() }),
      service.verify({ principal: principal('owner-b'), body: body() }),
    ]);
    expect(await claims('owner-a')).toHaveLength(1);
    expect(await claims('owner-b')).toHaveLength(1);
    expect((await claims('owner-a'))[0].ownerUid).toBe('owner-a');
    expect((await claims('owner-b'))[0].ownerUid).toBe('owner-b');
  });

  it('reuses the boundary for Daily Challenge without awarding an unapproved reward', async () => {
    const result = await makeService({ type: 'DAILY_CHALLENGE' }).verify({ principal: principal('daily-user'), body: body('DAILY_CHALLENGE') });
    expect(result).toMatchObject({ verified: true, rewardStatus: 'UNAVAILABLE' });
    expect(await claims('daily-user')).toEqual([expect.objectContaining({ activityType: 'DAILY_CHALLENGE', activityId: 'synthetic-challenge' })]);
    expect(await account('daily-user')).toBeUndefined();
  });
});
