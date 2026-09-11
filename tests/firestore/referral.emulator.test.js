import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Firestore, Timestamp } from '@google-cloud/firestore';
import { ReferralService } from '../../functions/src/referrals/ReferralService.js';
import { createCanonicalCapturedPayment } from './financialFixtures.js';

const PROJECT_ID = 'demo-local-coin-ledger';
let db;
let serial = 0;
const service = () => new ReferralService({
  db,
  timestamp: Timestamp,
  now: () => new Date('2026-09-10T00:00:00Z'),
  codeFactory: () => `MITA${String(++serial).padStart(5, '0')}`,
});

async function reset() {
  for (const name of ['users', 'referralCodes', 'referrals', 'referralPurchaseQualifications', 'paymentOrders', 'payments']) {
    await db.recursiveDelete(db.collection(name));
  }
  serial = 0;
}

beforeAll(() => {
  if (process.env.COIN_LEDGER_EMULATOR_TEST !== 'true' || !process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Referral emulator isolation marker is missing.');
  expect(process.env.FIREBASE_PROJECT_ID).toBe(PROJECT_ID);
  expect(process.env.FIREBASE_PROJECT_ID).not.toBe('mi-tutora-pro');
  db = new Firestore({ projectId: PROJECT_ID });
});
beforeEach(reset);
afterAll(async () => { if (db) { await reset(); await db.terminate(); } });

describe.sequential('M5 referral transaction behavior', () => {
  it('preserves ownership during deterministic referral-code collision retry', async () => {
    await db.doc('referralCodes/MITA00001').create({ code: 'MITA00001', ownerUid: 'existing', active: true });
    const identity = await service().ensureReferralIdentity({ uid: 'new-owner' });
    expect(identity.code).toBe('MITA00002');
    expect((await db.doc('referralCodes/MITA00001').get()).data().ownerUid).toBe('existing');
  });

  it('allows exactly one effective qualification under concurrency', async () => {
    await db.doc('referralCodes/MITABC234').create({ code: 'MITABC234', ownerUid: 'referrer', active: true });
    const referrals = service();
    await referrals.attributeReferral({ principal: { uid: 'buyer' }, request: { referralCode: 'MITABC234' } });
    await createCanonicalCapturedPayment(db, Timestamp, { paymentId: 'purchase_concurrent_001', ownerUid: 'buyer', planId: 'monthly' });
    const evidence = { trusted: true, evidenceType: 'VERIFIED_PREMIUM_PURCHASE', source: 'PAYMENT', purchaserUid: 'buyer', purchaseId: 'purchase_concurrent_001', planId: 'monthly', amountMinor: 49_900, currency: 'INR' };
    const results = await Promise.all(Array.from({ length: 8 }, () => referrals.qualifyReferralFromVerifiedPurchase(evidence)));
    expect(results.filter(({ duplicate }) => duplicate !== true)).toHaveLength(1);
    expect((await db.collection('referrals').get()).size).toBe(1);
    expect((await db.collection('referralPurchaseQualifications').get()).size).toBe(1);
    const projection = (await db.collection('users/referrer/referralReadModel').get()).docs[0].data();
    expect(projection).toMatchObject({ status: 'QUALIFIED', calculatedRewardMinor: 4990, rewardRateBps: 1000 });
  });
});
