import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Firestore, Timestamp } from '@google-cloud/firestore';
import { CoinRedemptionService } from '../../functions/src/coins/CoinRedemptionService.js';

const PROJECT_ID = 'demo-local-coin-ledger'; let db; let service; const suffix = randomUUID().replaceAll('-', '');
const uid = `redeemer-${suffix}`; const principal = { authenticated: true, uid };
const account = (balance) => ({ availableBalance: balance, lifetimeEarned: balance, lifetimeSpent: 0, revision: 1, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), schemaVersion: '1.0.0' });

beforeAll(() => { if (process.env.COIN_LEDGER_EMULATOR_TEST !== 'true' || !process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Emulator boundary required.'); db = new Firestore({ projectId: PROJECT_ID }); service = new CoinRedemptionService({ db, timestamp: Timestamp, now: () => new Date('2026-09-20T06:30:00Z') }); });
afterAll(async () => { await db.recursiveDelete(db.doc(`users/${uid}`)); for (let day = 1; day <= 4; day += 1) await db.doc(`dailyChallenges/2026-09-0${day}`).delete(); await db.terminate(); });

describe('coin redemption emulator atomicity', () => {
  it('allows three pass uses and atomically rejects a concurrent fourth without overspend', async () => {
    await db.doc(`users/${uid}/coinAccount/summary`).create(account(1000));
    for (let day = 1; day <= 4; day += 1) await db.doc(`dailyChallenges/2026-09-0${day}`).set({ id: `2026-09-0${day}`, date: `2026-09-0${day}`, version: 'v1', published: true });
    await Promise.all([1, 2].map((day) => service.redeemChallengePass({ principal, request: { requestId: `pass-request-${day}-0001`, occurrenceDate: `2026-09-0${day}` } })));
    const settled = await Promise.allSettled([3, 4].map((day) => service.redeemChallengePass({ principal, request: { requestId: `pass-request-${day}-0001`, occurrenceDate: `2026-09-0${day}` } })));
    expect(settled.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(settled.find(({ status }) => status === 'rejected').reason).toMatchObject({ code: 'coin/redemption-limit-reached' });
    expect((await db.doc(`users/${uid}/coinAccount/summary`).get()).data()).toMatchObject({ availableBalance: 550, lifetimeSpent: 450 });
    expect((await db.collection(`users/${uid}/coinTransactions`).get()).size).toBe(3);
    expect((await db.collection(`users/${uid}/challengeUnlocks`).get()).size).toBe(3);
  });
  it('prevents concurrent Premium overspend and creates no payment, referral, or wallet state', async () => {
    await db.doc(`users/${uid}/coinAccount/summary`).set(account(3000));
    const settled = await Promise.allSettled(['premium-request-a001', 'premium-request-b001'].map((requestId) => service.redeemPremiumMonth({ principal, request: { requestId } })));
    expect(settled.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect((await db.collection(`users/${uid}/subscriptions`).get()).size).toBe(1);
    expect((await db.doc(`users/${uid}/entitlements/premium`).get()).data()).toMatchObject({ tier: 'PREMIUM', active: true });
    expect((await db.collection(`users/${uid}/walletTransactions`).get()).size).toBe(0);
  });
});
