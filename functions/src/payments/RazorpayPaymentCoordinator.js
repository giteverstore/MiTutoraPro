import { PaymentActivationCoordinator } from './PaymentActivationCoordinator.js';

function fail(code, message, status = 400) { throw Object.assign(new Error(message), { code, status }); }
function capturedEvidence({ order, payment, source, eventId, eventType }) {
  if (payment.order_id !== order.providerOrderId || payment.amount !== order.amountMinor || payment.currency !== order.currency) fail('payment/provider-payment-mismatch', 'Provider payment does not match the canonical order.');
  const status = payment.status === 'captured' ? 'CAPTURED' : payment.status === 'authorized' ? 'AUTHORIZED' : payment.status === 'failed' ? 'FAILED' : null;
  if (!status) fail('payment/provider-status-unsupported', 'Provider payment is not ready for verification.', 409);
  return { trusted: true, source, provider: 'razorpay', eventId, eventType, internalOrderId: order.internalOrderId, providerOrderId: order.providerOrderId, providerPaymentId: payment.id, status, amountMinor: payment.amount, currency: payment.currency, occurredAt: Number(payment.created_at) || null };
}

export class RazorpayPaymentCoordinator {
  constructor({ paymentService, provider, activationCoordinator, lifecycleCoordinator = null }) {
    if (!paymentService || !provider) throw new TypeError('RazorpayPaymentCoordinator dependencies are required.');
    this.paymentService = paymentService; this.provider = provider; this.activationCoordinator = activationCoordinator; this.lifecycleCoordinator = lifecycleCoordinator;
  }

  async createOrder({ principal, request }) {
    const canonical = await this.paymentService.createCanonicalOrder({ principal, request, provider: 'razorpay' });
    const claim = await this.paymentService.claimProviderOrderCreation(canonical.internalOrderId, principal.uid);
    if (!claim.claimed) return this.#checkout(claim.order, true);
    try {
      const providerOrder = await this.provider.createOrder({ amountMinor: claim.order.amountMinor, currency: claim.order.currency, receipt: claim.order.internalOrderId.slice(0, 40), notes: { internalOrderId: claim.order.internalOrderId } });
      const linked = await this.paymentService.attachProviderOrder({ internalOrderId: claim.order.internalOrderId, ownerUid: principal.uid, providerOrderId: providerOrder.providerOrderId });
      return this.#checkout(linked, canonical.duplicate);
    } catch (error) {
      await this.paymentService.markProviderOrderUnknown(claim.order.internalOrderId, principal.uid);
      throw error;
    }
  }

  #checkout(order, duplicate) {
    return { internalOrderId: order.internalOrderId, providerOrderId: order.providerOrderId, keyId: this.provider.getCheckoutKeyId(), amountMinor: order.amountMinor, currency: order.currency, planId: order.planId, duplicate };
  }

  async verifyCheckout({ principal, request }) {
    const allowed = new Set(['internalOrderId', 'razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature']);
    if (!request || Object.keys(request).some((key) => !allowed.has(key))) fail('payment/invalid-callback', 'Payment verification data is invalid.');
    const orderSnapshot = await this.paymentService.db.doc(`paymentOrders/${request.internalOrderId}`).get();
    const order = orderSnapshot.exists ? orderSnapshot.data() : null;
    if (!order || order.ownerUid !== principal.uid || order.provider !== 'razorpay' || !order.providerOrderId) fail('payment/order-not-found', 'Payment order was not found.', 404);
    const verified = await this.provider.verifyCheckoutSignature({ serverOrderId: order.providerOrderId, razorpayOrderId: request.razorpay_order_id, razorpayPaymentId: request.razorpay_payment_id, razorpaySignature: request.razorpay_signature });
    const [payment, providerOrder] = await Promise.all([this.provider.fetchPayment(verified.providerPaymentId), this.provider.fetchOrder(verified.providerOrderId)]);
    if (providerOrder.id !== order.providerOrderId || providerOrder.amount !== order.amountMinor || providerOrder.currency !== order.currency) fail('payment/provider-order-mismatch', 'Provider order does not match canonical state.');
    if (payment.status === 'captured' && (payment.captured !== true || providerOrder.status !== 'paid' || providerOrder.amount_paid !== order.amountMinor || providerOrder.amount_due !== 0)) fail('payment/provider-status-mismatch', 'Provider capture is not confirmed by the order.', 409);
    const result = await this.paymentService.recordVerifiedEvent(capturedEvidence({ order, payment, source: 'VERIFIED_CHECKOUT_SIGNATURE', eventId: `checkout:${payment.id}:${payment.status}`, eventType: `checkout.${payment.status}` }));
    if (result.status === 'CAPTURED') await this.activationCoordinator.activateFromCapturedPayment(result.paymentId);
    return result;
  }

  async processWebhook({ rawBody, headers }) {
    const normalized = await this.provider.verifyWebhook({ rawBody, headers });
    return this.processVerifiedWebhook(normalized);
  }

  async processVerifiedWebhook(normalized) {
    if (normalized.ignored) return normalized;
    const { favorableResolution = false, ...financialEvidence } = normalized;
    const order = await this.paymentService.getOrderByProviderOrderId(normalized.providerOrderId);
    const evidence = { ...financialEvidence, trusted: true, source: 'PROVIDER_WEBHOOK', internalOrderId: order.internalOrderId };
    const result = await this.paymentService.recordVerifiedEvent(evidence);
    if (result.status === 'CAPTURED') await this.activationCoordinator.activateFromCapturedPayment(result.paymentId);
    if (favorableResolution) {
      if (!this.lifecycleCoordinator?.resolveFavorable) throw Object.assign(new Error('Financial lifecycle coordinator is unavailable.'), { code: 'payment/lifecycle-coordinator-unavailable' });
      await this.lifecycleCoordinator.resolveFavorable({ canonical: result, evidence });
    } else if (['PARTIALLY_REFUNDED', 'REFUNDED', 'DISPUTED', 'REVERSED'].includes(result.status)) {
      if (!this.lifecycleCoordinator?.apply) throw Object.assign(new Error('Financial lifecycle coordinator is unavailable.'), { code: 'payment/lifecycle-coordinator-unavailable' });
      await this.lifecycleCoordinator.apply({ canonical: result, evidence });
    }
    return result;
  }
}
