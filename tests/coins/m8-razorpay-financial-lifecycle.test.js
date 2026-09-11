import { describe, expect, it, vi } from 'vitest';
import { PaymentFinancialLifecycleCoordinator } from '../../functions/src/payments/PaymentFinancialLifecycleCoordinator.js';
import { RazorpayPaymentCoordinator } from '../../functions/src/payments/RazorpayPaymentCoordinator.js';

const evidence = (overrides = {}) => ({
  provider: 'razorpay', eventId: 'event_financial01', eventType: 'refund.processed',
  providerOrderId: 'order_12345678', providerPaymentId: 'pay_1234567890',
  status: 'PARTIALLY_REFUNDED', refundedAmountMinor: 10_000,
  amountMinor: 49_900, currency: 'INR', occurredAt: 1, ...overrides,
});

describe('M8.6 Razorpay financial lifecycle orchestration', () => {
  it('applies adverse webhook evidence once through the canonical lifecycle coordinator', async () => {
    const lifecycleCoordinator = { apply: vi.fn(async () => ({})) };
    const paymentService = {
      getOrderByProviderOrderId: vi.fn(async () => ({ internalOrderId: 'order_internal01' })),
      recordVerifiedEvent: vi.fn(async () => ({ paymentId: `payment_${'a'.repeat(64)}`, ownerUid: 'buyer', status: 'PARTIALLY_REFUNDED' })),
    };
    const coordinator = new RazorpayPaymentCoordinator({ paymentService, provider: { verifyWebhook: vi.fn(async () => evidence()) }, activationCoordinator: {}, lifecycleCoordinator });
    await coordinator.processWebhook({ rawBody: Buffer.from('{}'), headers: {} });
    expect(paymentService.recordVerifiedEvent).toHaveBeenCalledWith(expect.objectContaining({ trusted: true, source: 'PROVIDER_WEBHOOK', internalOrderId: 'order_internal01', refundedAmountMinor: 10_000 }));
    expect(lifecycleCoordinator.apply).toHaveBeenCalledOnce();
  });

  it('restores favorable dispute resolution through its explicit path', async () => {
    const lifecycleCoordinator = { resolveFavorable: vi.fn(async () => ({})) };
    const paymentService = {
      getOrderByProviderOrderId: vi.fn(async () => ({ internalOrderId: 'order_internal01' })),
      recordVerifiedEvent: vi.fn(async () => ({ paymentId: `payment_${'a'.repeat(64)}`, ownerUid: 'buyer', status: 'CAPTURED' })),
    };
    const provider = { verifyWebhook: vi.fn(async () => evidence({ eventType: 'payment.dispute.won', status: 'CAPTURED', refundedAmountMinor: 0, favorableResolution: true })) };
    const activationCoordinator = { activateFromCapturedPayment: vi.fn(async () => ({})) };
    const coordinator = new RazorpayPaymentCoordinator({ paymentService, provider, activationCoordinator, lifecycleCoordinator });
    await coordinator.processWebhook({ rawBody: Buffer.from('{}'), headers: {} });
    expect(activationCoordinator.activateFromCapturedPayment).toHaveBeenCalledOnce();
    expect(lifecycleCoordinator.resolveFavorable).toHaveBeenCalledOnce();
  });

  it('recomputes entitlement when no referral exists and does not swallow other settlement failures', async () => {
    const entitlementService = { recomputePremiumEntitlement: vi.fn(async () => ({ tier: 'FREE' })) };
    const noReferral = new PaymentFinancialLifecycleCoordinator({
      referralSettlementService: { applyTrustedEvidence: vi.fn(async () => { throw Object.assign(new Error('none'), { code: 'settlement/referral-not-found' }); }) },
      entitlementService,
    });
    await expect(noReferral.apply({ canonical: { paymentId: `payment_${'a'.repeat(64)}`, ownerUid: 'buyer', status: 'REFUNDED' }, evidence: { ...evidence({ status: 'REFUNDED', refundedAmountMinor: 49_900 }), source: 'PROVIDER_RECONCILIATION' } })).resolves.toMatchObject({ referral: { state: 'NOT_APPLICABLE' }, entitlement: { tier: 'FREE' } });
    expect(entitlementService.recomputePremiumEntitlement).toHaveBeenCalledWith('buyer');

    const unsafeEntitlement = { recomputePremiumEntitlement: vi.fn(async () => ({ tier: 'FREE' })) };
    const unsafe = new PaymentFinancialLifecycleCoordinator({ referralSettlementService: { applyTrustedEvidence: vi.fn(async () => { throw Object.assign(new Error('integrity'), { code: 'settlement/wallet-integrity' }); }) }, entitlementService: unsafeEntitlement });
    await expect(unsafe.apply({ canonical: { paymentId: `payment_${'a'.repeat(64)}`, ownerUid: 'buyer', status: 'REVERSED' }, evidence: { ...evidence({ status: 'REVERSED' }), source: 'PROVIDER_WEBHOOK' } })).rejects.toMatchObject({ code: 'settlement/wallet-integrity' });
    expect(unsafeEntitlement.recomputePremiumEntitlement).toHaveBeenCalledWith('buyer');
  });

  it('persists failed-refund notification identity while keeping captured state idempotent', async () => {
    const paymentService = { getOrderByProviderOrderId: vi.fn(async () => ({ internalOrderId: 'order_internal01' })), recordVerifiedEvent: vi.fn(async () => ({ paymentId: `payment_${'a'.repeat(64)}`, ownerUid: 'buyer', status: 'CAPTURED', transitionIdempotent: true })) };
    const activationCoordinator = { activateFromCapturedPayment: vi.fn(async () => ({})) };
    const coordinator = new RazorpayPaymentCoordinator({ paymentService, provider: { verifyWebhook: vi.fn(async () => evidence({ eventType: 'refund.failed', status: 'CAPTURED', refundedAmountMinor: 0 })) }, activationCoordinator });
    await expect(coordinator.processWebhook({ rawBody: Buffer.from('{}'), headers: {} })).resolves.toMatchObject({ status: 'CAPTURED', transitionIdempotent: true });
    expect(paymentService.recordVerifiedEvent).toHaveBeenCalledOnce();
    expect(activationCoordinator.activateFromCapturedPayment).toHaveBeenCalledOnce();
  });
});
