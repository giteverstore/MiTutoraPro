import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Firestore, Timestamp } from '@google-cloud/firestore';
import { WithdrawalService } from '../../functions/src/withdrawals/WithdrawalService.js';
import { reconcileWalletProjection } from '../../functions/src/wallet/WalletService.js';
import { WalletService } from '../../functions/src/wallet/WalletService.js';
import { ReferralService } from '../../functions/src/referrals/ReferralService.js';

const PROJECT_ID = 'demo-local-coin-ledger';
let db;
const service = () => new WithdrawalService({ db, timestamp: Timestamp, allowWithdrawalRequests: true, allowSyntheticTransitions: true });
const request = (requestId = 'request-concurrent-001', amountMinor = 50_000) => ({ principal: { uid: 'owner' }, request: { requestId, amountMinor } });
async function reset() { for (const name of ['users', 'referralCodes', 'referrals', 'referralPurchaseQualifications', 'walletSettlementIdempotency', 'withdrawalIdempotency', 'withdrawalTransitionIdempotency', 'withdrawalLookup']) await db.recursiveDelete(db.collection(name)); }
beforeAll(() => { if (process.env.COIN_LEDGER_EMULATOR_TEST !== 'true' || !process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Withdrawal emulator isolation marker is missing.'); expect(process.env.FIREBASE_PROJECT_ID).toBe(PROJECT_ID); db = new Firestore({ projectId: PROJECT_ID }); });
beforeEach(reset); afterAll(async () => { if (db) { await reset(); await db.terminate(); } });

describe.sequential('M7 withdrawal transactional behavior', () => {
  it('carries authoritative M5 qualifications through M6 settlements into one durable M7 reservation', async () => {
    const referrals = new ReferralService({ db, timestamp: Timestamp, now: () => new Date('2026-09-10T00:00:00Z') });
    const walletService = new WalletService({ db, timestamp: Timestamp, allowSyntheticSettlement: true });
    await db.doc('referralCodes/MITM7E2E1').create({ code: 'MITM7E2E1', ownerUid: 'owner', active: true });
    for (let index = 1; index <= 4; index += 1) {
      const purchaserUid = `buyer-${index}`;
      const attributed = await referrals.attributeReferral({ principal: { uid: purchaserUid }, request: { referralCode: 'MITM7E2E1' } });
      const qualified = await referrals.qualifyReferralFromVerifiedPurchase({ trusted: true, evidenceType: 'VERIFIED_PREMIUM_PURCHASE', source: 'PAYMENT', purchaserUid, purchaseId: `purchase-m7-e2e-${index}`, planId: 'annual', amountMinor: 149_900, currency: 'INR' });
      expect(qualified).toMatchObject({ qualified: true, calculatedRewardMinor: 14_990 });
      if (index === 1) expect((await db.doc('users/owner/wallet/account').get()).exists).toBe(false);
      await walletService.settleSyntheticReferralReward({ trusted: true, evidenceType: 'SYNTHETIC_REFERRAL_SETTLEMENT', settlementId: `settlement-m7-e2e-${index}`, referralId: attributed.referralId });
    }
    expect((await db.doc('users/owner/wallet/account').get()).data()).toMatchObject({ availableBalanceMinor: 59_960, reservedBalanceMinor: 0 });
    const created = await service().requestWithdrawal(request('request-m7-e2e-001'));
    expect(created).toMatchObject({ status: 'PENDING', amountMinor: 50_000, availableBalanceMinor: 9_960, reservedBalanceMinor: 50_000 });
    const reread = (await db.doc(`users/owner/withdrawals/${created.withdrawalId}`).get()).data();
    expect(reread).toMatchObject({ status: 'PENDING', policyVersion: 'm7-v1', currency: 'INR' });
    const ledger = (await db.collection('users/owner/walletTransactions').get()).docs.map((entry) => entry.data());
    expect(reconcileWalletProjection((await db.doc('users/owner/wallet/account').get()).data(), ledger, [reread]).reconciled).toBe(true);
  });

  it('rejects below-minimum and above-available requests without any financial side effect', async () => {
    await db.doc('users/owner/wallet/account').create({ currency: 'INR', pendingBalanceMinor: 0, availableBalanceMinor: 60_000, reservedBalanceMinor: 0, lifetimeCreditedMinor: 60_000, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), schemaVersion: '1.0.0' });
    await expect(service().requestWithdrawal(request('request-below-001', 49_999))).rejects.toMatchObject({ code: 'withdrawal/below-minimum' });
    await expect(service().requestWithdrawal(request('request-above-001', 70_000))).rejects.toMatchObject({ code: 'withdrawal/insufficient-balance' });
    expect((await db.collection('users/owner/withdrawals').get()).empty).toBe(true);
    expect((await db.collection('users/owner/walletTransactions').get()).empty).toBe(true);
    expect((await db.collection('withdrawalIdempotency').get()).empty).toBe(true);
    expect((await db.doc('users/owner/wallet/account').get()).data()).toMatchObject({ availableBalanceMinor: 60_000, reservedBalanceMinor: 0 });
  });

  it('allows exactly one of eight concurrent exact-balance requests', async () => {
    await db.doc('users/owner/wallet/account').create({ currency: 'INR', pendingBalanceMinor: 0, availableBalanceMinor: 50_000, reservedBalanceMinor: 0, lifetimeCreditedMinor: 50_000, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), schemaVersion: '1.0.0' });
    const results = await Promise.all(Array.from({ length: 8 }, () => service().requestWithdrawal(request())));
    expect(results.filter(({ duplicate }) => !duplicate)).toHaveLength(1);
    expect((await db.collection('users/owner/withdrawals').get()).size).toBe(1);
    expect((await db.collection('users/owner/walletTransactions').where('type', '==', 'WITHDRAWAL_RESERVED').get()).size).toBe(1);
    expect((await db.doc('users/owner/wallet/account').get()).data()).toMatchObject({ availableBalanceMinor: 0, reservedBalanceMinor: 50_000 });
  });

  it('prevents concurrent distinct requests from overspending one available balance', async () => {
    await db.doc('users/owner/wallet/account').create({ currency: 'INR', pendingBalanceMinor: 0, availableBalanceMinor: 50_000, reservedBalanceMinor: 0, lifetimeCreditedMinor: 50_000, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), schemaVersion: '1.0.0' });
    const settled = await Promise.allSettled([service().requestWithdrawal(request('request-distinct-001')), service().requestWithdrawal(request('request-distinct-002'))]);
    expect(settled.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(settled.filter(({ status }) => status === 'rejected')[0].reason).toMatchObject({ code: 'withdrawal/insufficient-balance' });
    expect((await db.collection('users/owner/withdrawals').get()).size).toBe(1);
  });

  it('atomically releases FAILED and consumes PAID reservations with reconciliation', async () => {
    await db.doc('users/owner/wallet/account').create({ currency: 'INR', pendingBalanceMinor: 0, availableBalanceMinor: 100_000, reservedBalanceMinor: 0, lifetimeCreditedMinor: 100_000, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), schemaVersion: '1.0.0' });
    await db.doc('users/owner/walletTransactions/credit').create({ transactionId: 'credit', type: 'REFERRAL_REWARD', amountMinor: 100_000, currency: 'INR', balanceBucket: 'AVAILABLE', sourceType: 'REFERRAL', sourceId: 'referral-source', createdAt: Timestamp.now() });
    const failed = await service().requestWithdrawal(request('request-failed-001'));
    await service().transitionSynthetic({ trusted: true, evidenceType: 'SYNTHETIC_WITHDRAWAL_FAILED', transitionId: 'transition-failed-001', withdrawalId: failed.withdrawalId });
    const paid = await service().requestWithdrawal(request('request-paid-001'));
    await service().transitionSynthetic({ trusted: true, evidenceType: 'SYNTHETIC_WITHDRAWAL_PAID', transitionId: 'transition-paid-001', withdrawalId: paid.withdrawalId });
    const wallet = (await db.doc('users/owner/wallet/account').get()).data();
    const ledger = (await db.collection('users/owner/walletTransactions').get()).docs.map((entry) => entry.data());
    const withdrawals = (await db.collection('users/owner/withdrawals').get()).docs.map((entry) => entry.data());
    expect(wallet).toMatchObject({ availableBalanceMinor: 50_000, reservedBalanceMinor: 0, lifetimeCreditedMinor: 100_000 });
    expect(reconcileWalletProjection(wallet, ledger, withdrawals).reconciled).toBe(true);
  });
});
