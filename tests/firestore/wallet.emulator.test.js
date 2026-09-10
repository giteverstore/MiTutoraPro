import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Firestore, Timestamp } from '@google-cloud/firestore';
import { WalletService, reconcileWalletProjection } from '../../functions/src/wallet/WalletService.js';
import { ReferralService } from '../../functions/src/referrals/ReferralService.js';

const PROJECT_ID = 'demo-local-coin-ledger';
let db;
const service = () => new WalletService({ db, timestamp: Timestamp, allowSyntheticSettlement: true });
const evidence = { trusted: true, evidenceType: 'SYNTHETIC_REFERRAL_SETTLEMENT', settlementId: 'settlement-concurrent-001', referralId: 'referral-concurrent-001' };

async function reset() {
  for (const name of ['users', 'referrals', 'walletSettlementIdempotency']) await db.recursiveDelete(db.collection(name));
}
beforeAll(() => {
  if (process.env.COIN_LEDGER_EMULATOR_TEST !== 'true' || !process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Wallet emulator isolation marker is missing.');
  expect(process.env.FIREBASE_PROJECT_ID).toBe(PROJECT_ID);
  db = new Firestore({ projectId: PROJECT_ID });
});
beforeEach(reset);
afterAll(async () => { if (db) { await reset(); await db.terminate(); } });

describe.sequential('M6 wallet transactional settlement', () => {
  it('atomically credits exactly once under concurrent settlement attempts', async () => {
    await db.doc('referrals/referral-concurrent-001').create({ referralId: evidence.referralId, referrerUid: 'owner', referredUid: 'buyer', status: 'QUALIFIED', calculatedRewardMinor: 4990, currency: 'INR' });
    const results = await Promise.all(Array.from({ length: 8 }, () => service().settleSyntheticReferralReward(evidence)));
    expect(results.filter(({ duplicate }) => !duplicate)).toHaveLength(1);
    expect((await db.collection('users/owner/walletTransactions').get()).size).toBe(1);
    const account = (await db.doc('users/owner/wallet/account').get()).data();
    expect(account).toMatchObject({ pendingBalanceMinor: 0, availableBalanceMinor: 4990, lifetimeCreditedMinor: 4990 });
    const ledger = (await db.collection('users/owner/walletTransactions').get()).docs.map((entry) => entry.data());
    expect(reconcileWalletProjection(account, ledger).reconciled).toBe(true);
    expect((await db.doc('referrals/referral-concurrent-001').get()).data()).toMatchObject({ status: 'QUALIFIED', walletSettlementStatus: 'SETTLED' });
  });

  it('accumulates three unique referral credits and reconciles to 29,970 paise', async () => {
    for (const [suffix, amount] of [['one', 4990], ['two', 9990], ['three', 14990]]) {
      const referralId = `referral-multiple-${suffix}`;
      await db.doc(`referrals/${referralId}`).create({ referralId, referrerUid: 'owner', referredUid: `buyer-${suffix}`, status: 'QUALIFIED', calculatedRewardMinor: amount, currency: 'INR', walletSettlementStatus: 'UNSETTLED' });
      await service().settleSyntheticReferralReward({ trusted: true, evidenceType: 'SYNTHETIC_REFERRAL_SETTLEMENT', settlementId: `settlement-multiple-${suffix}`, referralId });
    }
    const account = (await db.doc('users/owner/wallet/account').get()).data();
    const ledger = (await db.collection('users/owner/walletTransactions').get()).docs.map((entry) => entry.data());
    expect(account).toMatchObject({ pendingBalanceMinor: 0, availableBalanceMinor: 29970, lifetimeCreditedMinor: 29970 });
    expect(ledger).toHaveLength(3);
    expect(new Set(ledger.map(({ sourceId }) => sourceId)).size).toBe(3);
    expect(reconcileWalletProjection(account, ledger).reconciled).toBe(true);
  });

  it('consumes the M5 authoritative PREMIUM calculation without recalculating its rate', async () => {
    await db.doc('referralCodes/MITPREM24').create({ code: 'MITPREM24', ownerUid: 'premium-owner', active: true });
    await db.doc('users/premium-owner/entitlements/premium').create({ ownerUid: 'premium-owner', tier: 'PREMIUM', active: true, subscriptionId: 'premium-sub', planId: 'monthly', expiresAt: Timestamp.fromDate(new Date('2027-01-01T00:00:00Z')) });
    await db.doc('users/premium-owner/subscriptions/premium-sub').create({ ownerUid: 'premium-owner', status: 'ACTIVE', planId: 'monthly', expiresAt: Timestamp.fromDate(new Date('2027-01-01T00:00:00Z')) });
    const referrals = new ReferralService({ db, timestamp: Timestamp, now: () => new Date('2026-09-10T00:00:00Z') });
    const attributed = await referrals.attributeReferral({ principal: { uid: 'premium-buyer' }, request: { referralCode: 'MITPREM24' } });
    const qualified = await referrals.qualifyReferralFromVerifiedPurchase({ trusted: true, evidenceType: 'VERIFIED_PREMIUM_PURCHASE', source: 'PAYMENT', purchaserUid: 'premium-buyer', purchaseId: 'purchase-premium-001', planId: 'monthly', amountMinor: 49900, currency: 'INR' });
    expect(qualified).toMatchObject({ calculatedRewardMinor: 7485, rewardRateBps: 1500 });
    expect((await db.doc('users/premium-owner/wallet/account').get()).exists).toBe(false);
    await service().settleSyntheticReferralReward({ trusted: true, evidenceType: 'SYNTHETIC_REFERRAL_SETTLEMENT', settlementId: 'settlement-premium-001', referralId: attributed.referralId });
    expect((await db.doc('users/premium-owner/wallet/account').get()).data()).toMatchObject({ pendingBalanceMinor: 0, availableBalanceMinor: 7485, lifetimeCreditedMinor: 7485 });
  });
});
