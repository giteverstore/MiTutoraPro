import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Firestore, Timestamp } from '@google-cloud/firestore';
import { PaymentService } from '../../functions/src/payments/PaymentService.js';
import { PaymentActivationCoordinator } from '../../functions/src/payments/PaymentActivationCoordinator.js';
import { ProviderWithdrawalService } from '../../functions/src/payouts/ProviderWithdrawalService.js';
import { reconcileWalletProjection } from '../../functions/src/wallet/WalletService.js';
import { ReferralSettlementService } from '../../functions/src/payments/ReferralSettlementService.js';

const PROJECT_ID = 'demo-local-coin-ledger';
const collections = ['users', 'paymentOrders', 'payments', 'paymentEvents', 'paymentActivations', 'purchaseOrchestrations', 'paymentSettlementEvidence', 'paymentReconciliation', 'referralCodes', 'referrals', 'referralPurchaseQualifications', 'walletSettlementIdempotency', 'withdrawalIdempotency', 'withdrawalLookup', 'payoutOutbox', 'payoutWebhookEvents'];
let db;
async function reset() { for (const name of collections) await db.recursiveDelete(db.collection(name)); }
beforeAll(() => { if (process.env.COIN_LEDGER_EMULATOR_TEST !== 'true' || !process.env.FIRESTORE_EMULATOR_HOST) throw new Error('M8 emulator isolation marker is missing.'); expect(process.env.FIREBASE_PROJECT_ID).toBe(PROJECT_ID); db = new Firestore({ projectId: PROJECT_ID }); });
beforeEach(reset); afterAll(async () => { if (db) { await reset(); await db.terminate(); } });
const payments = () => new PaymentService({ db, timestamp: Timestamp });
const event = (order, overrides = {}) => ({ trusted: true, source: 'PROVIDER_WEBHOOK', provider: 'test-provider', eventId: 'provider-event-0001', eventType: 'payment.captured', internalOrderId: order.internalOrderId, providerOrderId: 'provider-order-0001', providerPaymentId: 'provider-payment-0001', status: 'CAPTURED', amountMinor: order.amountMinor, currency: order.currency, occurredAt: Timestamp.now(), ...overrides });

describe.sequential('M8.2 real Firestore transaction invariants', () => {
  it('converges concurrent order and provider-event replays to one canonical record', async () => {
    const request = { principal: { uid: 'buyer' }, request: { planId: 'monthly', requestId: 'order-request-0001' }, provider: 'test-provider' };
    const orders = await Promise.all(Array.from({ length: 6 }, () => payments().createCanonicalOrder(request)));
    expect(orders.filter(({ duplicate }) => !duplicate)).toHaveLength(1);
    const events = await Promise.all(Array.from({ length: 6 }, () => payments().recordVerifiedEvent(event(orders[0]))));
    expect(events.filter(({ duplicate }) => !duplicate)).toHaveLength(1);
    expect((await db.collection('paymentOrders').get()).size).toBe(1);
    expect((await db.collection('payments').get()).size).toBe(1);
    expect((await db.collection('paymentEvents').get()).size).toBe(1);
  });

  it('activates one subscription for concurrent CAPTURED payment replays', async () => {
    const order = await payments().createCanonicalOrder({ principal: { uid: 'buyer' }, request: { planId: 'annual', requestId: 'order-activation-0001' }, provider: 'test-provider' });
    const captured = await payments().recordVerifiedEvent(event(order));
    const coordinator = () => new PaymentActivationCoordinator({ db, timestamp: Timestamp, now: () => new Date('2026-09-11T00:00:00Z') });
    const results = await Promise.all(Array.from({ length: 6 }, () => coordinator().activateFromCapturedPayment(captured.paymentId)));
    expect(results.filter(({ activation }) => !activation.duplicate)).toHaveLength(1);
    expect((await db.collection('users/buyer/subscriptions').get()).size).toBe(1);
    expect((await db.collection('paymentActivations').get()).size).toBe(1);
    expect((await db.doc('users/buyer/entitlements/premium').get()).data()).toMatchObject({ tier: 'PREMIUM', active: true, planId: 'annual' });
  });

  it('releases one pending referral reward exactly once under concurrent trusted settlement', async () => {
    const paymentId = `payment_${'b'.repeat(64)}`;
    await Promise.all([
      db.doc(`payments/${paymentId}`).create({ paymentId, provider: 'test-provider', ownerUid: 'buyer', status: 'CAPTURED', amountMinor: 49_900, refundedAmountMinor: 0, currency: 'INR', capturedAt: Timestamp.fromDate(new Date('2026-09-10T00:00:00Z')) }),
      db.doc(`referralPurchaseQualifications/${paymentId}`).create({ referralId: 'referral-release', result: { calculatedRewardMinor: 4_990 } }),
      db.doc('referrals/referral-release').create({ referralId: 'referral-release', referrerUid: 'owner', qualifyingPurchaseReference: paymentId, status: 'QUALIFIED', calculatedRewardMinor: 4_990, rewardRateBps: 1_000, currency: 'INR', walletSettlementStatus: 'PENDING' }),
      db.doc('users/owner/wallet/account').create({ currency: 'INR', pendingBalanceMinor: 4_990, availableBalanceMinor: 0, reservedBalanceMinor: 0, lifetimeCreditedMinor: 4_990, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), schemaVersion: '1.0.0' }),
      db.doc('users/owner/walletTransactions/pending-release').create({ type: 'REFERRAL_REWARD_PENDING', amountMinor: 4_990, currency: 'INR', balanceBucket: 'PENDING' }),
    ]);
    const service = () => new ReferralSettlementService({ db, timestamp: Timestamp, now: () => new Date('2026-09-11T00:00:00Z') });
    const evidence = { trusted: true, source: 'PROVIDER_RECONCILIATION', provider: 'test-provider', evidenceId: 'settlement-release-0001', paymentId, state: 'SETTLED', currency: 'INR', occurredAt: Timestamp.fromDate(new Date('2026-09-04T00:00:00Z')) };
    const results = await Promise.all(Array.from({ length: 6 }, () => service().applyTrustedEvidence(evidence)));
    expect(results.filter(({ duplicate }) => !duplicate)).toHaveLength(1);
    expect((await db.doc('users/owner/wallet/account').get()).data()).toMatchObject({ pendingBalanceMinor: 0, availableBalanceMinor: 4_990, lifetimeCreditedMinor: 4_990 });
    const ledger = (await db.collection('users/owner/walletTransactions').get()).docs.map((entry) => entry.data());
    expect(ledger.filter(({ type }) => type === 'REFERRAL_REWARD_AVAILABLE')).toHaveLength(1);
  });

  it('atomically creates one reservation and outbox under concurrent replay', async () => {
    await db.doc('users/owner/wallet/account').create({ currency: 'INR', pendingBalanceMinor: 0, availableBalanceMinor: 50_000, reservedBalanceMinor: 0, lifetimeCreditedMinor: 50_000, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), schemaVersion: '1.0.0' });
    const service = () => new ProviderWithdrawalService({ db, timestamp: Timestamp, destinationFingerprintKey: 'm8-test-only-destination-key-material', allowWithdrawalRequests: true, environment: process.env });
    const request = { principal: { uid: 'owner' }, request: { amountMinor: 50_000, upiId: 'test.user@upi', requestId: 'payout-request-0001' } };
    const results = await Promise.all(Array.from({ length: 6 }, () => service().requestWithdrawal(request)));
    expect(results.filter(({ duplicate }) => !duplicate)).toHaveLength(1);
    expect((await db.collection('users/owner/withdrawals').get()).size).toBe(1);
    expect((await db.collection('payoutOutbox').get()).size).toBe(1);
    expect((await db.doc('users/owner/wallet/account').get()).data()).toMatchObject({ availableBalanceMinor: 0, reservedBalanceMinor: 50_000 });
    const serialized = JSON.stringify((await db.collection('payoutOutbox').get()).docs.map((entry) => entry.data()));
    expect(serialized).not.toContain('test.user@upi');
  });

  it('keeps UNKNOWN reserved and compensates a concurrent PAID reversal exactly once', async () => {
    await db.doc('users/owner/wallet/account').create({ currency: 'INR', pendingBalanceMinor: 0, availableBalanceMinor: 100_000, reservedBalanceMinor: 0, lifetimeCreditedMinor: 100_000, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), schemaVersion: '1.0.0' });
    await db.doc('users/owner/walletTransactions/credit').create({ type: 'REFERRAL_REWARD', amountMinor: 100_000, balanceBucket: 'AVAILABLE' });
    const service = () => new ProviderWithdrawalService({ db, timestamp: Timestamp, destinationFingerprintKey: 'm8-test-only-destination-key-material', allowWithdrawalRequests: true, environment: process.env });
    const created = await service().requestWithdrawal({ principal: { uid: 'owner' }, request: { amountMinor: 50_000, upiId: 'test.user@upi', requestId: 'payout-lifecycle-0001' } });
    await service().applyProviderEvent({ trusted: true, source: 'PROVIDER_RESPONSE', eventId: 'payout-unknown-0001', withdrawalId: created.withdrawalId, status: 'UNKNOWN', providerPayoutId: 'provider-payout-0001', amountMinor: 50_000, currency: 'INR' });
    expect((await db.doc('users/owner/wallet/account').get()).data()).toMatchObject({ availableBalanceMinor: 50_000, reservedBalanceMinor: 50_000 });
    await service().applyProviderEvent({ trusted: true, source: 'PROVIDER_RECONCILIATION', eventId: 'payout-paid-0001', withdrawalId: created.withdrawalId, status: 'PAID', providerPayoutId: 'provider-payout-0001', amountMinor: 50_000, currency: 'INR' });
    const reversed = { trusted: true, source: 'PROVIDER_WEBHOOK', eventId: 'payout-reversed-0001', withdrawalId: created.withdrawalId, status: 'REVERSED', providerPayoutId: 'provider-payout-0001', amountMinor: 50_000, currency: 'INR' };
    const results = await Promise.all(Array.from({ length: 6 }, () => service().applyProviderEvent(reversed)));
    expect(results.filter(({ duplicate }) => !duplicate)).toHaveLength(1);
    const account = (await db.doc('users/owner/wallet/account').get()).data();
    const ledger = (await db.collection('users/owner/walletTransactions').get()).docs.map((entry) => entry.data());
    const withdrawals = (await db.collection('users/owner/withdrawals').get()).docs.map((entry) => entry.data());
    expect(account).toMatchObject({ availableBalanceMinor: 100_000, reservedBalanceMinor: 0 });
    expect(ledger.filter(({ type }) => type === 'WITHDRAWAL_REVERSED')).toHaveLength(1);
    expect(reconcileWalletProjection(account, ledger, withdrawals).reconciled).toBe(true);
  });
});
