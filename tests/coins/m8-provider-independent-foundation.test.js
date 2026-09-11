import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { PaymentService } from '../../functions/src/payments/PaymentService.js';
import { assertPaymentTransition, PAYMENT_STATUS } from '../../functions/src/payments/PaymentModels.js';
import { PaymentProvider, createPaymentProvider } from '../../functions/src/payments/PaymentProvider.js';
import { PaymentWebhookProcessor } from '../../functions/src/payments/PaymentWebhookProcessor.js';
import { PaymentActivationCoordinator } from '../../functions/src/payments/PaymentActivationCoordinator.js';
import { RazorpayPaymentCoordinator } from '../../functions/src/payments/RazorpayPaymentCoordinator.js';
import { PayoutProvider, createPayoutProvider } from '../../functions/src/payouts/PayoutProvider.js';
import { assertPayoutTransition } from '../../functions/src/payouts/PayoutModels.js';
import { maskUpiId, normalizeUpiId } from '../../functions/src/payouts/UpiDestination.js';
import { ProviderWithdrawalService } from '../../functions/src/payouts/ProviderWithdrawalService.js';
import { WalletService, reconcileWalletProjection } from '../../functions/src/wallet/WalletService.js';

const instant = new Date('2026-09-11T00:00:00.000Z');
const stamp = () => ({ toDate: () => instant, seconds: 1 });
const timestamp = { now: stamp, fromDate: (value) => ({ toDate: () => new Date(value), seconds: Math.floor(new Date(value).getTime() / 1000) }) };
function database(seed = {}) {
  const values = new Map(Object.entries(seed));
  const snapshot = (path) => ({ exists: values.has(path), data: () => values.get(path) });
  const doc = (path) => ({ path, get: async () => snapshot(path) });
  return {
    values, doc,
    runTransaction: async (callback) => callback({
      get: async ({ path }) => snapshot(path),
      getAll: async (...refs) => refs.map(({ path }) => snapshot(path)),
      create: ({ path }, value) => { if (values.has(path)) throw Object.assign(new Error('exists'), { code: 'already-exists' }); values.set(path, value); },
      set: ({ path }, value) => values.set(path, value),
      update: ({ path }, patch) => values.set(path, { ...values.get(path), ...patch }),
    }),
  };
}
const paymentService = (db) => new PaymentService({ db, timestamp });
const orderRequest = (overrides = {}) => ({ principal: { uid: 'buyer' }, request: { planId: 'monthly', requestId: 'payment-request-0001', ...overrides }, provider: 'test-provider' });
async function capturedPayment(db, overrides = {}) {
  const payments = paymentService(db);
  const order = await payments.createCanonicalOrder(orderRequest());
  const result = await payments.recordVerifiedEvent({
    trusted: true, source: 'PROVIDER_WEBHOOK', provider: 'test-provider',
    eventId: 'event-captured-0001', eventType: 'payment.captured', internalOrderId: order.internalOrderId,
    providerOrderId: 'provider-order-0001', providerPaymentId: 'provider-payment-0001',
    status: 'CAPTURED', amountMinor: 49_900, currency: 'INR', occurredAt: stamp(), ...overrides,
  });
  return { payments, order, result };
}
function wallet(available = 100_000, reserved = 0) {
  return { currency: 'INR', pendingBalanceMinor: 0, availableBalanceMinor: available, reservedBalanceMinor: reserved, lifetimeCreditedMinor: available + reserved, createdAt: stamp(), updatedAt: stamp(), schemaVersion: '1.0.0' };
}
const providerWithdrawal = (db) => new ProviderWithdrawalService({ db, timestamp, destinationFingerprintKey: 'm8-test-only-destination-key-material', allowWithdrawalRequests: true, environment: { NODE_ENV: 'test', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_PROJECT_ID: 'demo-m8' } });
const payoutRequest = (overrides = {}) => ({ principal: { uid: 'owner' }, request: { amountMinor: 50_000, upiId: 'avinash@upi', requestId: 'payout-request-0001', ...overrides } });
const payoutEvent = (withdrawalId, status, overrides = {}) => ({ trusted: true, source: 'PROVIDER_WEBHOOK', eventId: `event-${status.toLowerCase()}-0001`, withdrawalId, status, providerPayoutId: 'provider-payout-0001', amountMinor: 50_000, currency: 'INR', ...overrides });
const ledger = (db) => [...db.values.values()].filter((entry) => /^WITHDRAWAL_|REFERRAL_REWARD/.test(entry.type ?? ''));

describe('M8.2 canonical payment foundation', () => {
  it('derives plan price and currency server-side and rejects client monetary authority', async () => {
    const db = database();
    const order = await paymentService(db).createCanonicalOrder(orderRequest());
    expect(order).toMatchObject({ planId: 'monthly', planVersion: 'm3-v1', amountMinor: 49_900, currency: 'INR', status: 'ORDER_CREATED' });
    await expect(paymentService(database()).createCanonicalOrder(orderRequest({ amountMinor: 1, currency: 'USD' }))).rejects.toMatchObject({ code: 'payment/client-authority-rejected' });
  });

  it('makes order requests idempotent and rejects conflicting request reuse', async () => {
    const db = database(); const service = paymentService(db);
    const first = await service.createCanonicalOrder(orderRequest());
    expect(await service.createCanonicalOrder(orderRequest())).toMatchObject({ internalOrderId: first.internalOrderId, duplicate: true });
    await expect(service.createCanonicalOrder(orderRequest({ planId: 'annual' }))).rejects.toMatchObject({ code: 'payment/order-conflict' });
  });

  it('enforces explicit payment transitions, idempotent same state, and stale-regression rejection', () => {
    expect(assertPaymentTransition('ORDER_CREATED', 'AUTHORIZED')).toEqual({ idempotent: false });
    expect(assertPaymentTransition('CAPTURED', 'CAPTURED')).toEqual({ idempotent: true });
    expect(() => assertPaymentTransition('CAPTURED', 'AUTHORIZED')).toThrowError(expect.objectContaining({ code: 'payment/invalid-transition' }));
    expect(() => assertPaymentTransition('REFUNDED', 'CAPTURED')).toThrowError(expect.objectContaining({ code: 'payment/invalid-transition' }));
  });

  it('records immutable trusted events, replays safely, and rejects conflicting/untrusted events', async () => {
    const db = database(); const { payments, order, result } = await capturedPayment(db);
    expect(result).toMatchObject({ status: 'CAPTURED', duplicate: false });
    const same = { trusted: true, source: 'PROVIDER_WEBHOOK', provider: 'test-provider', eventId: 'event-captured-0001', eventType: 'payment.captured', internalOrderId: order.internalOrderId, providerOrderId: 'provider-order-0001', providerPaymentId: 'provider-payment-0001', status: 'CAPTURED', amountMinor: 49_900, currency: 'INR', occurredAt: stamp() };
    expect(await payments.recordVerifiedEvent(same)).toMatchObject({ duplicate: true, paymentId: result.paymentId });
    await expect(payments.recordVerifiedEvent({ ...same, status: 'FAILED' })).rejects.toMatchObject({ code: 'payment/event-conflict' });
    await expect(payments.recordVerifiedEvent({ ...same, amountMinor: 1 })).rejects.toMatchObject({ code: 'payment/event-conflict' });
    await expect(payments.recordVerifiedEvent({ ...same, eventId: 'event-browser-0002', source: 'BROWSER_CALLBACK', trusted: true })).rejects.toMatchObject({ code: 'payment/untrusted-evidence' });
    const storedEvent = [...db.values.values()].find((entry) => entry.eventType === 'payment.captured');
    expect(storedEvent).not.toHaveProperty('rawBody'); expect(storedEvent).not.toHaveProperty('signature'); expect(storedEvent).not.toHaveProperty('secret');
  });

  it('preserves the first canonical capture timestamp across distinct verified capture evidence', async () => {
    const db = database();
    const first = { toDate: () => new Date('2026-09-10T00:00:00Z') };
    const second = { toDate: () => new Date('2026-09-10T00:01:00Z') };
    let current = first;
    const service = new PaymentService({ db, timestamp: { now: () => current } });
    const order = await service.createCanonicalOrder(orderRequest());
    const evidence = { trusted: true, source: 'PROVIDER_FETCH', provider: 'test-provider', eventId: 'capture-time-0001', eventType: 'payment.captured', internalOrderId: order.internalOrderId, providerOrderId: 'provider-order-0001', providerPaymentId: 'provider-payment-time', status: 'CAPTURED', amountMinor: 49_900, currency: 'INR', occurredAt: first };
    const captured = await service.recordVerifiedEvent(evidence);
    current = second;
    await service.recordVerifiedEvent({ ...evidence, eventId: 'capture-time-0002', source: 'PROVIDER_RECONCILIATION', occurredAt: second });
    expect(db.values.get(`payments/${captured.paymentId}`).capturedAt).toBe(first);
  });

  it('requires raw-body provider verification before processing a webhook', async () => {
    const db = database(); const service = paymentService(db); const order = await service.createCanonicalOrder(orderRequest());
    class FakeProvider extends PaymentProvider {
      async verifyWebhook({ rawBody }) {
        expect(Buffer.from(rawBody).toString()).toBe('{}');
        return { trusted: true, source: 'PROVIDER_WEBHOOK', provider: 'test-provider', eventId: 'event-webhook-0001', eventType: 'payment.captured', internalOrderId: order.internalOrderId, providerOrderId: 'provider-order-0001', providerPaymentId: 'provider-payment-0001', status: 'CAPTURED', amountMinor: 49_900, currency: 'INR', occurredAt: stamp() };
      }
    }
    const activated = [];
    const processor = new PaymentWebhookProcessor({ provider: new FakeProvider(), paymentService: service, activationCoordinator: { activateFromCapturedPayment: async (id) => activated.push(id) } });
    expect(await processor.process({ rawBody: Buffer.from('{}'), headers: {} })).toMatchObject({ status: 'CAPTURED' });
    expect(activated).toHaveLength(1);
    await expect(processor.process({ rawBody: {}, headers: {} })).rejects.toMatchObject({ code: 'payment/raw-body-required' });
  });

  it('fails closed when real payment and payout providers are not configured', async () => {
    await expect(createPaymentProvider().createOrder()).rejects.toMatchObject({ code: 'payment/provider-unavailable' });
    await expect(createPayoutProvider().createPayout()).rejects.toMatchObject({ code: 'payout/provider-unavailable' });
    expect(new PayoutProvider()).toBeInstanceOf(PayoutProvider);
  });
});

describe('M8.3 provider order and callback coordination', () => {
  it('creates one provider order and returns it on an idempotent retry', async () => {
    const db = database(); const payments = paymentService(db);
    const provider = { createOrder: vi.fn(async () => ({ providerOrderId: 'order_12345678' })), getCheckoutKeyId: () => 'rzp_test_public' };
    const coordinator = new RazorpayPaymentCoordinator({ paymentService: payments, provider, activationCoordinator: {} });
    const input = { principal: { uid: 'buyer' }, request: { planId: 'monthly', requestId: 'payment-request-0001' } };
    const first = await coordinator.createOrder(input); const replay = await coordinator.createOrder(input);
    expect(first).toMatchObject({ providerOrderId: 'order_12345678', amountMinor: 49_900, currency: 'INR' });
    expect(replay).toMatchObject({ providerOrderId: first.providerOrderId, duplicate: true });
    expect(provider.createOrder).toHaveBeenCalledTimes(1);
  });

  it('marks an ambiguous provider-order failure UNKNOWN and never creates another charge opportunity', async () => {
    const db = database(); const payments = paymentService(db);
    const provider = { createOrder: vi.fn(async () => { throw Object.assign(new Error('network'), { code: 'payment/provider-unavailable' }); }), getCheckoutKeyId: () => 'rzp_test_public' };
    const coordinator = new RazorpayPaymentCoordinator({ paymentService: payments, provider, activationCoordinator: {} });
    const input = { principal: { uid: 'buyer' }, request: { planId: 'monthly', requestId: 'payment-request-0001' } };
    await expect(coordinator.createOrder(input)).rejects.toMatchObject({ code: 'payment/provider-unavailable' });
    await expect(coordinator.createOrder(input)).rejects.toMatchObject({ code: 'payment/order-pending-reconciliation' });
    expect(provider.createOrder).toHaveBeenCalledTimes(1);
  });

  it('requires owner binding and authoritative captured payment plus paid order', async () => {
    const db = database(); const payments = paymentService(db);
    const order = await payments.createCanonicalOrder({ principal: { uid: 'buyer' }, request: { planId: 'monthly', requestId: 'payment-request-0001' }, provider: 'razorpay' });
    await payments.claimProviderOrderCreation(order.internalOrderId, 'buyer');
    await payments.attachProviderOrder({ internalOrderId: order.internalOrderId, ownerUid: 'buyer', providerOrderId: 'order_12345678' });
    const activationCoordinator = { activateFromCapturedPayment: vi.fn(async () => ({})) };
    const provider = {
      verifyCheckoutSignature: vi.fn(async () => ({ providerOrderId: 'order_12345678', providerPaymentId: 'pay_1234567890' })),
      fetchPayment: vi.fn(async () => ({ entity: 'payment', id: 'pay_1234567890', order_id: 'order_12345678', amount: 49_900, currency: 'INR', status: 'captured', captured: true, created_at: 1 })),
      fetchOrder: vi.fn(async () => ({ entity: 'order', id: 'order_12345678', amount: 49_900, amount_paid: 49_900, amount_due: 0, currency: 'INR', status: 'paid' })),
    };
    const coordinator = new RazorpayPaymentCoordinator({ paymentService: payments, provider, activationCoordinator });
    const request = { internalOrderId: order.internalOrderId, razorpay_order_id: 'order_12345678', razorpay_payment_id: 'pay_1234567890', razorpay_signature: 'synthetic' };
    await expect(coordinator.verifyCheckout({ principal: { uid: 'attacker' }, request })).rejects.toMatchObject({ code: 'payment/order-not-found' });
    await expect(coordinator.verifyCheckout({ principal: { uid: 'buyer' }, request })).resolves.toMatchObject({ status: 'CAPTURED' });
    expect(activationCoordinator.activateFromCapturedPayment).toHaveBeenCalledTimes(1);
  });

  it('allows a later captured attempt after a different payment on the order failed', async () => {
    const db = database(); const payments = paymentService(db);
    const order = await payments.createCanonicalOrder(orderRequest());
    const base = { trusted: true, source: 'PROVIDER_WEBHOOK', provider: 'test-provider', eventType: 'payment.failed', internalOrderId: order.internalOrderId, providerOrderId: 'provider-order-0001', amountMinor: 49_900, currency: 'INR', occurredAt: stamp() };
    await payments.recordVerifiedEvent({ ...base, eventId: 'failed-attempt-0001', providerPaymentId: 'provider-payment-failed', status: 'FAILED' });
    await expect(payments.recordVerifiedEvent({ ...base, eventId: 'captured-attempt-0001', eventType: 'payment.captured', providerPaymentId: 'provider-payment-success', status: 'CAPTURED' })).resolves.toMatchObject({ status: 'CAPTURED' });
  });
});

describe('M8.2 captured-payment activation and referral pending state', () => {
  it('activates exactly one PAYMENT subscription and does not double-extend on replay', async () => {
    const db = database(); const { result } = await capturedPayment(db);
    const coordinator = new PaymentActivationCoordinator({ db, timestamp, now: () => instant });
    const first = await coordinator.activateFromCapturedPayment(result.paymentId);
    const replay = await coordinator.activateFromCapturedPayment(result.paymentId);
    expect(first.activation).toMatchObject({ duplicate: false, planId: 'monthly' });
    expect(replay.activation).toMatchObject({ duplicate: true, subscriptionId: first.activation.subscriptionId });
    const subscriptions = [...db.values.values()].filter((entry) => entry.source === 'PAYMENT');
    expect(subscriptions).toHaveLength(1);
    expect(db.values.get(`payments/${result.paymentId}`)).toMatchObject({ subscriptionId: first.activation.subscriptionId, resultingExpiresAt: first.activation.expiresAt });
    expect(db.values.get(`purchaseOrchestrations/${result.paymentId}`)).toMatchObject({ status: 'COMPLETE', subscriptionId: first.activation.subscriptionId });
    expect([...db.values.values()].some((entry) => entry.source === 'DEVELOPMENT_GRANT')).toBe(false);
  });

  it('refuses activation for AUTHORIZED and FAILED payments', async () => {
    for (const status of ['AUTHORIZED', 'FAILED']) {
      const db = database(); const payments = paymentService(db); const order = await payments.createCanonicalOrder(orderRequest());
      const result = await payments.recordVerifiedEvent({ trusted: true, source: 'PROVIDER_FETCH', provider: 'test-provider', eventId: `event-${status.toLowerCase()}-0001`, eventType: `payment.${status.toLowerCase()}`, internalOrderId: order.internalOrderId, providerOrderId: 'provider-order-0001', providerPaymentId: 'provider-payment-0001', status, amountMinor: 49_900, currency: 'INR', occurredAt: stamp() });
      await expect(new PaymentActivationCoordinator({ db, timestamp, now: () => instant }).activateFromCapturedPayment(result.paymentId)).rejects.toMatchObject({ code: 'payment/not-captured' });
    }
  });

  it('records a qualified referral reward as PENDING without making money AVAILABLE', async () => {
    const db = database({
      'referrals/referral-one': { referralId: 'referral-one', referrerUid: 'owner', status: 'QUALIFIED', calculatedRewardMinor: 4_990, currency: 'INR', walletSettlementStatus: 'UNSETTLED' },
    });
    const service = new WalletService({ db, timestamp });
    const evidence = { trusted: true, evidenceType: 'CAPTURED_PAYMENT_REFERRAL_PENDING', pendingId: 'pending-payment-0001', referralId: 'referral-one' };
    expect(await service.recordPendingReferralReward(evidence)).toMatchObject({ balanceBucket: 'PENDING', pendingBalanceMinor: 4_990, duplicate: false });
    expect(await service.recordPendingReferralReward(evidence)).toMatchObject({ duplicate: true });
    expect(db.values.get('users/owner/wallet/account')).toMatchObject({ pendingBalanceMinor: 4_990, availableBalanceMinor: 0 });
    expect(reconcileWalletProjection(db.values.get('users/owner/wallet/account'), ledger(db), []).reconciled).toBe(true);
  });

  it('moves a pending referral reward to AVAILABLE without double-crediting value', async () => {
    const db = database({
      'referrals/referral-one': { referralId: 'referral-one', referrerUid: 'owner', status: 'QUALIFIED', calculatedRewardMinor: 4_990, currency: 'INR', walletSettlementStatus: 'UNSETTLED' },
    });
    const service = new WalletService({
      db,
      timestamp,
      allowSyntheticSettlement: true,
      environment: { NODE_ENV: 'test', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_PROJECT_ID: 'demo-m8' },
    });
    await service.recordPendingReferralReward({ trusted: true, evidenceType: 'CAPTURED_PAYMENT_REFERRAL_PENDING', pendingId: 'pending-payment-0001', referralId: 'referral-one' });
    await service.settleSyntheticReferralReward({ trusted: true, evidenceType: 'SYNTHETIC_REFERRAL_SETTLEMENT', settlementId: 'settlement-payment-0001', referralId: 'referral-one' });
    const projection = db.values.get('users/owner/wallet/account');
    expect(projection).toMatchObject({ pendingBalanceMinor: 0, availableBalanceMinor: 4_990, lifetimeCreditedMinor: 4_990 });
    expect(reconcileWalletProjection(projection, ledger(db), []).reconciled).toBe(true);
  });
});

describe('M8.2 provider payout and UPI privacy foundation', () => {
  it('masks VPAs deterministically and fails closed for malformed, Unicode, control, and short values', () => {
    expect(normalizeUpiId('Avinash@UPI')).toBe('avinash@upi');
    expect(maskUpiId('avinash@upi')).toBe('a******@upi');
    expect(maskUpiId('a@upi')).toBe('*@upi');
    for (const value of ['', '@upi', 'a@x', 'a b@upi', 'a\n@upi', 'अ@upi', 'a@उपि', 'a@@upi']) {
      expect(() => maskUpiId(value)).toThrowError(expect.objectContaining({ code: 'payout/invalid-destination' }));
    }
  });

  it('atomically reserves funds with one outbox and persists only a masked destination', async () => {
    const db = database({ 'users/owner/wallet/account': wallet() }); const service = providerWithdrawal(db);
    const result = await service.requestWithdrawal(payoutRequest());
    expect(result).toMatchObject({ status: 'INITIATION_PENDING', maskedDestination: 'a******@upi', availableBalanceMinor: 50_000, reservedBalanceMinor: 50_000 });
    expect(await service.requestWithdrawal(payoutRequest())).toMatchObject({ duplicate: true, withdrawalId: result.withdrawalId });
    expect([...db.values.keys()].filter((path) => path.startsWith('payoutOutbox/'))).toHaveLength(1);
    expect(JSON.stringify([...db.values.values()])).not.toContain('avinash@upi');
  });

  it('fails closed without a private destination fingerprint key and distinguishes identically masked VPAs', async () => {
    const db = database({ 'users/owner/wallet/account': wallet() });
    expect(() => new ProviderWithdrawalService({ db, timestamp })).toThrowError(/fingerprint key/);
    const service = providerWithdrawal(db);
    await service.requestWithdrawal(payoutRequest());
    await expect(service.requestWithdrawal(payoutRequest({ upiId: 'another@upi' }))).rejects.toMatchObject({ code: 'withdrawal/request-conflict' });
  });

  it('keeps provider-backed withdrawal creation disabled outside the explicit emulator boundary', async () => {
    const db = database({ 'users/owner/wallet/account': wallet() });
    const service = new ProviderWithdrawalService({ db, timestamp, destinationFingerprintKey: 'm8-test-only-destination-key-material', allowWithdrawalRequests: true, environment: { NODE_ENV: 'production', FIRESTORE_EMULATOR_HOST: '', FIREBASE_PROJECT_ID: 'mi-tutora-pro' } });
    await expect(service.requestWithdrawal(payoutRequest())).rejects.toMatchObject({ code: 'withdrawal/requests-disabled' });
    expect([...db.values.keys()].some((path) => /withdrawal|payoutOutbox|walletTransactions/.test(path))).toBe(false);
    expect(db.values.get('users/owner/wallet/account')).toMatchObject({ availableBalanceMinor: 100_000, reservedBalanceMinor: 0 });
  });

  it('reserves only value remaining after outstanding referral clawbacks', async () => {
    const db = database({ 'users/owner/wallet/account': { ...wallet(), outstandingReferralClawbackMinor: 60_000 } });
    await expect(providerWithdrawal(db).requestWithdrawal(payoutRequest())).rejects.toMatchObject({ code: 'withdrawal/insufficient-balance' });
    expect([...db.values.keys()].some((path) => /withdrawal|payoutOutbox|walletTransactions/.test(path))).toBe(false);
  });

  it('keeps UNKNOWN and PROCESSING funds RESERVED', async () => {
    for (const status of ['PROCESSING', 'UNKNOWN']) {
      const db = database({ 'users/owner/wallet/account': wallet() }); const service = providerWithdrawal(db);
      const created = await service.requestWithdrawal(payoutRequest());
      if (status === 'UNKNOWN') await service.applyProviderEvent(payoutEvent(created.withdrawalId, 'UNKNOWN'));
      else await service.applyProviderEvent(payoutEvent(created.withdrawalId, 'PROCESSING'));
      expect(db.values.get('users/owner/wallet/account')).toMatchObject({ availableBalanceMinor: 50_000, reservedBalanceMinor: 50_000 });
    }
  });

  it.each(['FAILED', 'CANCELLED'])('%s releases RESERVED exactly once', async (status) => {
    const db = database({ 'users/owner/wallet/account': wallet() }); const service = providerWithdrawal(db);
    const created = await service.requestWithdrawal(payoutRequest()); const event = payoutEvent(created.withdrawalId, status);
    expect(await service.applyProviderEvent(event)).toMatchObject({ status, availableBalanceMinor: 100_000, reservedBalanceMinor: 0, duplicate: false });
    expect(await service.applyProviderEvent(event)).toMatchObject({ duplicate: true });
    expect(ledger(db).filter((entry) => entry.type === 'WITHDRAWAL_RELEASED')).toHaveLength(1);
  });

  it('consumes RESERVED on PAID and compensates PAID to REVERSED exactly once', async () => {
    const db = database({
      'users/owner/wallet/account': wallet(),
      'users/owner/walletTransactions/credit': { type: 'REFERRAL_REWARD', amountMinor: 100_000, balanceBucket: 'AVAILABLE' },
    }); const service = providerWithdrawal(db);
    const created = await service.requestWithdrawal(payoutRequest());
    await service.applyProviderEvent(payoutEvent(created.withdrawalId, 'PROCESSING'));
    expect(await service.applyProviderEvent(payoutEvent(created.withdrawalId, 'PAID'))).toMatchObject({ availableBalanceMinor: 50_000, reservedBalanceMinor: 0 });
    const reversed = payoutEvent(created.withdrawalId, 'REVERSED');
    expect(await service.applyProviderEvent(reversed)).toMatchObject({ availableBalanceMinor: 100_000, reservedBalanceMinor: 0, duplicate: false });
    expect(await service.applyProviderEvent(reversed)).toMatchObject({ duplicate: true });
    expect(ledger(db).filter((entry) => entry.type === 'WITHDRAWAL_PAID')).toHaveLength(1);
    expect(ledger(db).filter((entry) => entry.type === 'WITHDRAWAL_REVERSED')).toHaveLength(1);
    const withdrawals = [...db.values.entries()].filter(([path]) => path.includes('/withdrawals/')).map(([, entry]) => entry);
    expect(reconcileWalletProjection(db.values.get('users/owner/wallet/account'), ledger(db), withdrawals)).toMatchObject({ reconciled: true, availableBalanceMinor: 100_000 });
  });

  it('rejects stale payout regressions, untrusted evidence, and conflicting replay', async () => {
    expect(() => assertPayoutTransition('PAID', 'PROCESSING')).toThrowError(expect.objectContaining({ code: 'payout/invalid-transition' }));
    const db = database({ 'users/owner/wallet/account': wallet() }); const service = providerWithdrawal(db); const created = await service.requestWithdrawal(payoutRequest());
    await expect(service.applyProviderEvent({ ...payoutEvent(created.withdrawalId, 'PAID'), trusted: false })).rejects.toMatchObject({ code: 'payout/untrusted-evidence' });
    await service.applyProviderEvent(payoutEvent(created.withdrawalId, 'FAILED'));
    await expect(service.applyProviderEvent(payoutEvent(created.withdrawalId, 'PAID', { eventId: 'event-failed-0001' }))).rejects.toMatchObject({ code: 'payout/event-conflict' });
  });

  it('does not repeat wallet movement for duplicate same-state evidence and validates canonical amounts', async () => {
    const db = database({ 'users/owner/wallet/account': wallet() }); const service = providerWithdrawal(db);
    const created = await service.requestWithdrawal(payoutRequest());
    await service.applyProviderEvent(payoutEvent(created.withdrawalId, 'FAILED'));
    await service.applyProviderEvent(payoutEvent(created.withdrawalId, 'FAILED', { eventId: 'event-failed-0002' }));
    expect(db.values.get('users/owner/wallet/account')).toMatchObject({ availableBalanceMinor: 100_000, reservedBalanceMinor: 0 });
    expect(ledger(db).filter((entry) => entry.type === 'WITHDRAWAL_RELEASED')).toHaveLength(1);

    const another = database({ 'users/owner/wallet/account': wallet() }); const anotherService = providerWithdrawal(another);
    const anotherCreated = await anotherService.requestWithdrawal(payoutRequest());
    await expect(anotherService.applyProviderEvent(payoutEvent(anotherCreated.withdrawalId, 'PROCESSING', { amountMinor: 49_999 }))).rejects.toMatchObject({ code: 'payout/provider-binding-mismatch' });
    await expect(anotherService.applyProviderEvent(payoutEvent(anotherCreated.withdrawalId, 'PROCESSING', { currency: 'USD' }))).rejects.toMatchObject({ code: 'payout/provider-binding-mismatch' });
  });

  it('releases RESERVED on a provider reversal before PAID without fabricating external compensation', async () => {
    const db = database({ 'users/owner/wallet/account': wallet() }); const service = providerWithdrawal(db);
    const created = await service.requestWithdrawal(payoutRequest());
    await service.applyProviderEvent(payoutEvent(created.withdrawalId, 'PROCESSING'));
    await expect(service.applyProviderEvent(payoutEvent(created.withdrawalId, 'REVERSED'))).resolves.toMatchObject({ availableBalanceMinor: 100_000, reservedBalanceMinor: 0 });
    expect(ledger(db).find((entry) => entry.type === 'WITHDRAWAL_REVERSED')).toMatchObject({ fromBucket: 'RESERVED', balanceBucket: 'AVAILABLE' });
  });

  it('has explicit client-write denial for every M8 server collection', () => {
    const rules = readFileSync('firestore.rules', 'utf8');
    for (const collection of ['paymentOrders', 'payments', 'paymentEvents', 'paymentWebhookEvents', 'paymentActivations', 'payoutWebhookEvents', 'payoutOutbox', 'financialReconciliation']) {
      expect(rules).toContain(`match /${collection}/{`);
    }
  });
});
