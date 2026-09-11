import { describe, expect, it, vi } from 'vitest';
import { ReferralSettlementService } from '../../functions/src/payments/ReferralSettlementService.js';
import { PaymentReconciliationService } from '../../functions/src/payments/PaymentReconciliationService.js';
import { FirestorePaymentReconciliationRepository } from '../../functions/src/payments/FirestorePaymentReconciliationRepository.js';
import { PaymentService } from '../../functions/src/payments/PaymentService.js';
import { reconcileWalletProjection } from '../../functions/src/wallet/WalletService.js';

const instant = new Date('2026-09-20T00:00:00Z');
const stamp = (date = instant) => ({ toDate: () => date, seconds: Math.floor(date.getTime() / 1000) });
const timestamp = { now: () => stamp(), fromDate: stamp };
function database(seed = {}) {
  const values = new Map(Object.entries(seed));
  const snapshot = (path) => ({ exists: values.has(path), data: () => values.get(path) });
  const doc = (path) => ({ path, get: async () => snapshot(path) });
  return { values, doc, runTransaction: async (callback) => callback({
    get: async ({ path }) => snapshot(path), getAll: async (...refs) => refs.map(({ path }) => snapshot(path)),
    create: ({ path }, value) => { if (values.has(path)) throw Object.assign(new Error('exists'), { code: 'already-exists' }); values.set(path, value); },
    set: ({ path }, value) => values.set(path, value), update: ({ path }, patch) => values.set(path, { ...values.get(path), ...patch }),
  }) };
}
const paymentId = `payment_${'a'.repeat(64)}`;
const base = (walletStatus = 'PENDING') => ({
  [`payments/${paymentId}`]: { paymentId, provider: 'test-provider', ownerUid: 'buyer', status: 'CAPTURED', amountMinor: 49_900, refundedAmountMinor: 0, currency: 'INR', capturedAt: stamp(new Date('2026-09-11T00:00:00Z')) },
  [`referralPurchaseQualifications/${paymentId}`]: { referralId: 'referral-one', result: { calculatedRewardMinor: 4_990 } },
  'referrals/referral-one': { referralId: 'referral-one', referrerUid: 'owner', qualifyingPurchaseReference: paymentId, status: 'QUALIFIED', calculatedRewardMinor: 4_990, rewardRateBps: 1_000, currency: 'INR', walletSettlementStatus: walletStatus },
  'users/owner/wallet/account': { currency: 'INR', pendingBalanceMinor: walletStatus === 'PENDING' ? 4_990 : 0, availableBalanceMinor: walletStatus === 'SETTLED' ? 4_990 : 0, reservedBalanceMinor: 0, lifetimeCreditedMinor: 4_990, createdAt: stamp(), updatedAt: stamp(), schemaVersion: '1.0.0' },
  'users/owner/walletTransactions/pending': { type: 'REFERRAL_REWARD_PENDING', amountMinor: 4_990, balanceBucket: 'PENDING' },
});
const evidence = (state, overrides = {}) => ({ trusted: true, source: 'PROVIDER_RECONCILIATION', provider: 'test-provider', evidenceId: `evidence-${state.toLowerCase()}-0001`, paymentId, state, currency: 'INR', occurredAt: stamp(new Date('2026-09-11T00:00:00Z')), ...overrides });
const ledger = (db) => [...db.values.entries()].filter(([path]) => path.startsWith('users/owner/walletTransactions/')).map(([, value]) => value);

describe('M8.4 trusted referral settlement policy', () => {
  it('fails closed when the approved versioned cooling policy is unavailable', async () => {
    const service = new ReferralSettlementService({ db: database(base()), timestamp, now: () => instant, policy: { policyVersion: 'unknown', referralReleaseDelayDays: 7 } });
    await expect(service.applyTrustedEvidence(evidence('SETTLED'))).rejects.toMatchObject({ code: 'settlement/release-policy-unavailable' });
  });

  it('moves PENDING to AVAILABLE once and conserves total value', async () => {
    const db = database(base()); const service = new ReferralSettlementService({ db, timestamp, now: () => instant });
    const first = await service.applyTrustedEvidence(evidence('SETTLED'));
    expect(first).toMatchObject({ state: 'AVAILABLE', amountMinor: 4_990, duplicate: false });
    expect(await service.applyTrustedEvidence(evidence('SETTLED'))).toMatchObject({ duplicate: true });
    const wallet = db.values.get('users/owner/wallet/account');
    expect(wallet).toMatchObject({ pendingBalanceMinor: 0, availableBalanceMinor: 4_990, lifetimeCreditedMinor: 4_990 });
    expect(reconcileWalletProjection(wallet, ledger(db))).toMatchObject({ reconciled: true });
  });

  it('reverses a full-refund pending reward without erasing pending history', async () => {
    const db = database(base()); const service = new ReferralSettlementService({ db, timestamp });
    const result = await service.applyTrustedEvidence(evidence('REFUNDED', { refundedAmountMinor: 49_900 }));
    expect(result).toMatchObject({ state: 'CANCELLED', amountMinor: 4_990 });
    const wallet = db.values.get('users/owner/wallet/account');
    expect(wallet).toMatchObject({ pendingBalanceMinor: 0, availableBalanceMinor: 0, lifetimeCreditedMinor: 0 });
    expect(ledger(db).map(({ type }) => type)).toEqual(expect.arrayContaining(['REFERRAL_REWARD_PENDING', 'REFERRAL_REWARD_REVERSED']));
    expect(reconcileWalletProjection(wallet, ledger(db))).toMatchObject({ reconciled: true });
  });

  it('records partial-refund support but blocks release until product policy exists', async () => {
    const db = database(base()); const service = new ReferralSettlementService({ db, timestamp });
    expect(await service.applyTrustedEvidence(evidence('PARTIALLY_REFUNDED', { refundedAmountMinor: 24_950 }))).toMatchObject({ state: 'PENDING_ADJUSTED', eligibleRewardMinor: 2_495, adjustmentMinor: 2_495 });
    expect(db.values.get('users/owner/wallet/account')).toMatchObject({ pendingBalanceMinor: 2_495, availableBalanceMinor: 0, lifetimeCreditedMinor: 2_495 });
    await expect(service.applyTrustedEvidence(evidence('PARTIALLY_REFUNDED', { evidenceId: 'evidence-partial-bad', refundedAmountMinor: 50_000 }))).rejects.toMatchObject({ code: 'payment/invalid-refund' });
  });

  it('blocks active disputes and flags an already-released reward for review without debt', async () => {
    const db = database(base('SETTLED')); const service = new ReferralSettlementService({ db, timestamp });
    expect(await service.applyTrustedEvidence(evidence('DISPUTED'))).toMatchObject({ state: 'CLAWBACK_REVIEW_REQUIRED' });
    expect(db.values.get('users/owner/wallet/account')).toMatchObject({ availableBalanceMinor: 4_990 });
    expect(db.values.get('users/owner/wallet/account').outstandingReferralClawbackMinor ?? 0).toBe(0);
    expect(db.values.get('referrals/referral-one')).toMatchObject({ walletSettlementStatus: 'CLAWBACK_REVIEW_REQUIRED', releaseBlockedReason: 'PAYMENT_DISPUTED' });
  });

  it('rejects browser-manufactured evidence and conflicting replay', async () => {
    const db = database(base()); const service = new ReferralSettlementService({ db, timestamp });
    await expect(service.applyTrustedEvidence({ ...evidence('SETTLED'), source: 'BROWSER' })).rejects.toMatchObject({ code: 'settlement/untrusted-evidence' });
    await service.applyTrustedEvidence(evidence('REFUNDED', { refundedAmountMinor: 49_900 }));
    await expect(service.applyTrustedEvidence(evidence('REVERSED', { evidenceId: 'evidence-refunded-0001' }))).rejects.toMatchObject({ code: 'settlement/evidence-conflict' });
  });
});

describe('M8.4 payment refund and reconciliation', () => {
  it('loads only bounded server-owned unresolved provider orders for reconciliation', async () => {
    const records = {
      ORDER_CREATED: [
        { internalOrderId: 'order_unresolved01', providerOrderId: 'provider-order-0001', provider: 'razorpay', providerOrderState: 'CREATED', status: 'ORDER_CREATED', amountMinor: 49_900, currency: 'INR', createdAt: { toMillis: () => 1 } },
        { internalOrderId: 'order_unlinked000', providerOrderId: null, provider: 'razorpay', providerOrderState: 'NOT_STARTED', status: 'ORDER_CREATED', amountMinor: 49_900, currency: 'INR', createdAt: { toMillis: () => 2 } },
      ],
      AUTHORIZED: [
        { internalOrderId: 'order_authorized1', providerOrderId: 'provider-order-0002', provider: 'razorpay', providerOrderState: 'CREATED', status: 'AUTHORIZED', amountMinor: 49_900, currency: 'INR', createdAt: { toMillis: () => 3 } },
      ],
      CAPTURED: [],
      PARTIALLY_REFUNDED: [],
    };
    const db = { collection: () => ({ where: (_field, _operator, status) => ({ limit: () => ({ get: async () => ({ docs: records[status].map((value) => ({ data: () => value })) }) }) }) }) };
    const repository = new FirestorePaymentReconciliationRepository({ db });
    await expect(repository.listUnresolved({ limit: 2 })).resolves.toEqual([
      expect.objectContaining({ internalOrderId: 'order_unresolved01', status: 'ORDER_CREATED' }),
      expect.objectContaining({ internalOrderId: 'order_authorized1', status: 'AUTHORIZED' }),
    ]);
  });

  it('validates cumulative refund bounds in canonical payment events', async () => {
    const db = database(); const service = new PaymentService({ db, timestamp });
    const order = await service.createCanonicalOrder({ principal: { uid: 'buyer' }, request: { planId: 'monthly', requestId: 'request-refund-0001' }, provider: 'test-provider' });
    const common = { trusted: true, source: 'PROVIDER_FETCH', provider: 'test-provider', internalOrderId: order.internalOrderId, providerOrderId: 'provider-order-0001', providerPaymentId: 'provider-payment-0001', amountMinor: 49_900, currency: 'INR', occurredAt: stamp() };
    await service.recordVerifiedEvent({ ...common, eventId: 'capture-event-0001', eventType: 'payment.captured', status: 'CAPTURED' });
    await expect(service.recordVerifiedEvent({ ...common, eventId: 'partial-event-0001', eventType: 'payment.refunded', status: 'PARTIALLY_REFUNDED', refundedAmountMinor: 10_000 })).resolves.toMatchObject({ status: 'PARTIALLY_REFUNDED' });
    await expect(service.recordVerifiedEvent({ ...common, eventId: 'bad-refund-event', eventType: 'payment.refunded', status: 'REFUNDED', refundedAmountMinor: 60_000 })).rejects.toMatchObject({ code: 'payment/invalid-refund' });
  });

  it('reconciliation resumes captured orchestration and detects identity mismatch', async () => {
    const paymentService = { recordVerifiedEvent: vi.fn(async () => ({ paymentId, status: 'CAPTURED' })) };
    const purchaseCoordinator = { activateFromCapturedPayment: vi.fn(async () => ({ orchestrationStatus: 'COMPLETE' })) };
    const providerAdapter = { fetchCanonicalEvidence: vi.fn(async () => ({ provider: 'test-provider' })) };
    const service = new PaymentReconciliationService({ paymentRepository: { listUnresolved: async () => [{ paymentId }] }, providerAdapter, paymentService, purchaseCoordinator });
    expect(await service.reconcile()).toEqual([{ paymentId, status: 'CAPTURED', orchestrationStatus: 'COMPLETE' }]);
    expect(purchaseCoordinator.activateFromCapturedPayment).toHaveBeenCalledOnce();
  });

  it('routes API-reconciled refund evidence through canonical state before financial effects', async () => {
    const paymentService = { recordVerifiedEvent: vi.fn(async () => ({ paymentId, ownerUid: 'buyer', status: 'PARTIALLY_REFUNDED' })) };
    const purchaseCoordinator = { activateFromCapturedPayment: vi.fn() };
    const lifecycleCoordinator = { apply: vi.fn(async () => ({})) };
    const providerAdapter = { fetchCanonicalEvidence: vi.fn(async () => ({ provider: 'razorpay', eventId: 'reconciliation-event-0001', status: 'PARTIALLY_REFUNDED', refundedAmountMinor: 10_000, currency: 'INR' })) };
    const service = new PaymentReconciliationService({ paymentRepository: { listUnresolved: async () => [{ paymentId }] }, providerAdapter, paymentService, purchaseCoordinator, lifecycleCoordinator });
    await expect(service.reconcile()).resolves.toEqual([{ paymentId, status: 'PARTIALLY_REFUNDED', orchestrationStatus: null }]);
    expect(paymentService.recordVerifiedEvent).toHaveBeenCalledWith(expect.objectContaining({ trusted: true, source: 'PROVIDER_RECONCILIATION', refundedAmountMinor: 10_000 }));
    expect(lifecycleCoordinator.apply).toHaveBeenCalledOnce();
    expect(purchaseCoordinator.activateFromCapturedPayment).not.toHaveBeenCalled();
  });
});
