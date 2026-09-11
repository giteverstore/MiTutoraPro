import { createHmac, timingSafeEqual } from 'node:crypto';

const API_BASE = 'https://api.razorpay.com/v1';
const IDENTIFIER = /^(?:order|pay)_[A-Za-z0-9]{8,64}$/;
const ENTITY_IDENTIFIER = Object.freeze({ order: /^order_[A-Za-z0-9]{8,64}$/, payment: /^pay_[A-Za-z0-9]{8,64}$/, refund: /^rfnd_[A-Za-z0-9]{8,64}$/, dispute: /^disp_[A-Za-z0-9]{8,64}$/ });
const EVENT_ID = /^[A-Za-z0-9_.:-]{8,180}$/;
const ALLOWED_EVENTS = new Set([
  'payment.captured', 'payment.failed', 'order.paid',
  'refund.processed', 'refund.failed',
  'payment.dispute.created', 'payment.dispute.action_required', 'payment.dispute.under_review',
  'payment.dispute.won', 'payment.dispute.lost', 'payment.dispute.closed',
]);
const PROVIDER_TIMEOUT_MS = 15_000;
const STATUS = Object.freeze({ authorized: 'AUTHORIZED', captured: 'CAPTURED', failed: 'FAILED' });

function fail(code, message, status = 400) { throw Object.assign(new Error(message), { code, status }); }
function required(environment, name) {
  const value = String(environment[name] ?? '').trim();
  if (!value) fail('payment/provider-unavailable', 'Payment provider configuration is unavailable.', 503);
  return value;
}
function validateConfiguration(environment, keyId, keySecret, webhookSecret) {
  if (String(environment.PAYMENT_PROVIDER ?? '').trim() !== 'razorpay') fail('payment/provider-unavailable', 'Payment provider configuration is unavailable.', 503);
  const match = keyId.match(/^rzp_(test|live)_[A-Za-z0-9]+$/);
  if (!match || Buffer.byteLength(keySecret, 'utf8') < 16 || Buffer.byteLength(webhookSecret, 'utf8') < 16) fail('payment/provider-unavailable', 'Payment provider configuration is unavailable.', 503);
  const production = environment.NODE_ENV === 'production';
  if ((production && match[1] !== 'live') || (!production && match[1] !== 'test')) fail('payment/provider-unavailable', 'Payment provider mode does not match the runtime.', 503);
}
function safeEqualHex(expected, received) {
  if (typeof received !== 'string' || !/^[a-f0-9]{64}$/i.test(received)) return false;
  const left = Buffer.from(expected, 'hex'); const right = Buffer.from(received, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}
function assertProviderEntity(entity, kind) {
  if (!entity || entity.entity !== kind || !ENTITY_IDENTIFIER[kind]?.test(entity.id ?? '')) fail('payment/provider-malformed-response', 'Payment provider returned invalid data.', 502);
  return entity;
}

function paymentLifecycle(payment, order, refundedAmountMinor = Number(payment?.amount_refunded ?? 0)) {
  if (payment.order_id !== order.id || payment.amount !== order.amount || payment.currency !== order.currency
    || !Number.isSafeInteger(refundedAmountMinor) || refundedAmountMinor < 0 || refundedAmountMinor > payment.amount) {
    fail('payment/provider-payment-mismatch', 'Provider payment does not match the canonical order.', 502);
  }
  if (refundedAmountMinor === payment.amount) {
    if (payment.refund_status !== 'full' || payment.status !== 'refunded') fail('payment/provider-refund-mismatch', 'Provider full-refund evidence is inconsistent.', 409);
    return { status: 'REFUNDED', refundedAmountMinor };
  }
  if (refundedAmountMinor > 0) {
    if (payment.refund_status !== 'partial' || payment.status !== 'captured' || payment.captured !== true) fail('payment/provider-refund-mismatch', 'Provider partial-refund evidence is inconsistent.', 409);
    return { status: 'PARTIALLY_REFUNDED', refundedAmountMinor };
  }
  if (payment.refund_status != null) fail('payment/provider-refund-mismatch', 'Provider refund evidence is inconsistent.', 409);
  if (!STATUS[payment.status]) fail('payment/provider-status-unsupported', 'Provider payment state is unsupported.', 409);
  if (payment.status === 'captured' && (payment.captured !== true || order.status !== 'paid' || order.amount_paid !== payment.amount || order.amount_due !== 0)) {
    fail('payment/provider-status-mismatch', 'Provider capture is not confirmed by the order.', 409);
  }
  return { status: STATUS[payment.status], refundedAmountMinor: 0 };
}

function processedRefundTotal(collection, payment) {
  if (collection?.entity !== 'collection' || !Array.isArray(collection.items)) fail('payment/provider-malformed-response', 'Payment provider returned invalid data.', 502);
  let total = 0;
  for (const refund of collection.items) {
    assertProviderEntity(refund, 'refund');
    if (refund.payment_id !== payment.id || !Number.isSafeInteger(refund.amount) || refund.amount <= 0
      || (refund.currency && refund.currency !== payment.currency)
      || !['pending', 'processed', 'failed'].includes(refund.status)) {
      fail('payment/provider-refund-mismatch', 'Provider refund does not match the canonical payment.', 502);
    }
    if (refund.status === 'processed') total += refund.amount;
    if (!Number.isSafeInteger(total) || total > payment.amount) fail('payment/provider-refund-mismatch', 'Provider cumulative refund is invalid.', 409);
  }
  return total;
}

export class RazorpayPaymentProvider {
  constructor({ environment = process.env, fetchImpl = globalThis.fetch } = {}) {
    this.keyId = required(environment, 'RAZORPAY_KEY_ID');
    this.keySecret = required(environment, 'RAZORPAY_KEY_SECRET');
    this.webhookSecret = required(environment, 'RAZORPAY_PAYMENT_WEBHOOK_SECRET');
    validateConfiguration(environment, this.keyId, this.keySecret, this.webhookSecret);
    if (typeof fetchImpl !== 'function') throw new TypeError('RazorpayPaymentProvider requires fetch.');
    this.fetchImpl = fetchImpl;
  }

  async #request(path, options = {}) {
    const authorization = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    let response;
    try {
      response = await this.fetchImpl(`${API_BASE}${path}`, { ...options, signal: options.signal ?? AbortSignal.timeout(PROVIDER_TIMEOUT_MS), headers: { Authorization: `Basic ${authorization}`, 'Content-Type': 'application/json', ...(options.headers ?? {}) } });
    } catch (cause) { throw Object.assign(new Error('Payment provider is unavailable.'), { code: 'payment/provider-unavailable', status: 503, cause }); }
    if (!response?.ok) fail(response?.status === 429 ? 'payment/provider-rate-limited' : 'payment/provider-rejected', 'Payment provider rejected the request.', response?.status === 429 ? 429 : 502);
    try { return await response.json(); } catch { return fail('payment/provider-malformed-response', 'Payment provider returned invalid data.', 502); }
  }

  async createOrder({ amountMinor, currency, receipt, notes }) {
    const order = assertProviderEntity(await this.#request('/orders', { method: 'POST', body: JSON.stringify({ amount: amountMinor, currency, receipt, notes, partial_payment: false }) }), 'order');
    if (order.amount !== amountMinor || order.currency !== currency || order.receipt !== receipt || order.status !== 'created') fail('payment/provider-order-mismatch', 'Payment provider order does not match the canonical order.', 502);
    return Object.freeze({ providerOrderId: order.id, amountMinor: order.amount, currency: order.currency, status: order.status });
  }

  async fetchOrder(providerOrderId) { return assertProviderEntity(await this.#request(`/orders/${encodeURIComponent(providerOrderId)}`), 'order'); }
  async fetchPayment(providerPaymentId) { return assertProviderEntity(await this.#request(`/payments/${encodeURIComponent(providerPaymentId)}`), 'payment'); }
  async fetchPaymentRefunds(providerPaymentId) { return this.#request(`/payments/${encodeURIComponent(providerPaymentId)}/refunds`); }

  async fetchCanonicalEvidence(record) {
    if (!record || record.provider !== 'razorpay'
      || !IDENTIFIER.test(record.internalOrderId ?? '')
      || !IDENTIFIER.test(record.providerOrderId ?? '')
      || !Number.isInteger(record.amountMinor) || record.amountMinor <= 0
      || typeof record.currency !== 'string' || !/^[A-Z]{3}$/.test(record.currency)) {
      fail('payment/invalid-reconciliation-record', 'Canonical reconciliation input is invalid.');
    }
    const [order, collection] = await Promise.all([
      this.fetchOrder(record.providerOrderId),
      this.#request(`/orders/${encodeURIComponent(record.providerOrderId)}/payments`),
    ]);
    if (order.id !== record.providerOrderId || order.amount !== record.amountMinor || order.currency !== record.currency) {
      fail('payment/provider-order-mismatch', 'Provider order does not match canonical state.', 502);
    }
    if (collection?.entity !== 'collection' || !Array.isArray(collection.items)) {
      fail('payment/provider-malformed-response', 'Payment provider returned invalid data.', 502);
    }
    const candidates = collection.items
      .map((payment) => assertProviderEntity(payment, 'payment'))
      .filter((payment) => payment.order_id === record.providerOrderId
        && payment.amount === record.amountMinor
        && payment.currency === record.currency
        && (STATUS[payment.status] || payment.status === 'refunded'))
      .sort((left, right) => Number(right.created_at ?? 0) - Number(left.created_at ?? 0));
    const payment = candidates.find((candidate) => candidate.status === 'refunded')
      ?? candidates.find((candidate) => candidate.status === 'captured')
      ?? candidates.find((candidate) => candidate.status === 'authorized')
      ?? candidates.find((candidate) => candidate.status === 'failed');
    if (!payment) fail('payment/provider-payment-unresolved', 'Provider payment is not available for reconciliation.', 409);
    let lifecycle = paymentLifecycle(payment, order);
    if (lifecycle.refundedAmountMinor > 0) {
      const processedTotal = processedRefundTotal(await this.fetchPaymentRefunds(payment.id), payment);
      if (processedTotal !== lifecycle.refundedAmountMinor) fail('payment/provider-refund-mismatch', 'Provider cumulative refund is not final.', 409);
      lifecycle = paymentLifecycle(payment, order, processedTotal);
    }
    return Object.freeze({
      provider: 'razorpay',
      eventId: `reconciliation:${payment.id}:${lifecycle.status.toLowerCase()}:${lifecycle.refundedAmountMinor}`,
      eventType: `payment.reconciled.${lifecycle.status.toLowerCase()}`,
      internalOrderId: record.internalOrderId,
      providerOrderId: order.id,
      providerPaymentId: payment.id,
      status: lifecycle.status,
      refundedAmountMinor: lifecycle.refundedAmountMinor,
      amountMinor: payment.amount,
      currency: payment.currency,
      occurredAt: Number(payment.created_at) || null,
    });
  }

  async verifyCheckoutSignature({ serverOrderId, razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
    if (!IDENTIFIER.test(serverOrderId ?? '') || serverOrderId !== razorpayOrderId || !IDENTIFIER.test(razorpayPaymentId ?? '')) fail('payment/invalid-callback', 'Payment verification data is invalid.');
    const expected = createHmac('sha256', this.keySecret).update(`${serverOrderId}|${razorpayPaymentId}`).digest('hex');
    if (!safeEqualHex(expected, razorpaySignature)) fail('payment/invalid-signature', 'Payment signature is invalid.', 401);
    return Object.freeze({ providerOrderId: serverOrderId, providerPaymentId: razorpayPaymentId });
  }

  async verifyWebhook({ rawBody, headers }) {
    return verifyRazorpayWebhook({ rawBody, headers, webhookSecret: this.webhookSecret });
  }

  getCheckoutKeyId() { return this.keyId; }
}

export function verifyRazorpayWebhook({ rawBody, headers, webhookSecret }) {
  if (!(rawBody instanceof Uint8Array)) fail('payment/invalid-webhook', 'Webhook raw body is required.');
    const signature = headers?.['x-razorpay-signature'] ?? headers?.['X-Razorpay-Signature'];
    const eventId = headers?.['x-razorpay-event-id'] ?? headers?.['X-Razorpay-Event-Id'];
    const expected = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    if (!safeEqualHex(expected, signature)) fail('payment/invalid-webhook-signature', 'Webhook signature is invalid.', 401);
    if (typeof eventId !== 'string' || !EVENT_ID.test(eventId)) fail('payment/invalid-webhook', 'Webhook event identity is invalid.');
    let payload;
    try { payload = JSON.parse(Buffer.from(rawBody).toString('utf8')); } catch { return fail('payment/invalid-webhook', 'Webhook payload is invalid.'); }
    if (!ALLOWED_EVENTS.has(payload.event)) fail('payment/webhook-event-ignored', 'Webhook event is not supported.', 422);
    const payment = payload.payload?.payment?.entity;
    const order = payload.payload?.order?.entity;
    const refund = payload.payload?.refund?.entity;
    const dispute = payload.payload?.dispute?.entity;
    if (payload.event === 'refund.failed') {
      assertProviderEntity(payment, 'payment'); assertProviderEntity(refund, 'refund');
      if (refund.status !== 'failed' || refund.payment_id !== payment.id || !IDENTIFIER.test(payment.order_id ?? '')) fail('payment/invalid-webhook', 'Webhook refund data is invalid.');
      const lifecycle = paymentLifecycle(payment, { id: payment.order_id, amount: payment.amount, currency: payment.currency, status: 'paid', amount_paid: payment.amount, amount_due: 0 });
      return Object.freeze({ provider: 'razorpay', eventId, eventType: payload.event, providerOrderId: payment.order_id, providerPaymentId: payment.id, status: lifecycle.status, refundedAmountMinor: lifecycle.refundedAmountMinor, amountMinor: payment.amount, currency: payment.currency, occurredAt: Number(refund.created_at) || null });
    }
    if (payload.event === 'refund.processed') {
      assertProviderEntity(payment, 'payment'); assertProviderEntity(refund, 'refund');
      if (refund.status !== 'processed' || refund.payment_id !== payment.id || !IDENTIFIER.test(payment.order_id ?? '')
        || !Number.isSafeInteger(refund.amount) || refund.amount <= 0 || (refund.currency && refund.currency !== payment.currency)) fail('payment/invalid-webhook', 'Webhook refund data is invalid.');
      const syntheticOrder = { id: payment.order_id, amount: payment.amount, currency: payment.currency };
      const lifecycle = paymentLifecycle(payment, syntheticOrder);
      if (!['PARTIALLY_REFUNDED', 'REFUNDED'].includes(lifecycle.status)) fail('payment/invalid-webhook', 'Webhook refund state is incomplete.');
      return Object.freeze({ provider: 'razorpay', eventId, eventType: payload.event, providerOrderId: payment.order_id, providerPaymentId: payment.id, status: lifecycle.status, refundedAmountMinor: lifecycle.refundedAmountMinor, amountMinor: payment.amount, currency: payment.currency, occurredAt: Number(refund.created_at) || null });
    }
    if (payload.event.startsWith('payment.dispute.')) {
      assertProviderEntity(payment, 'payment'); assertProviderEntity(dispute, 'dispute');
      if (dispute.payment_id !== payment.id || !IDENTIFIER.test(payment.order_id ?? '') || dispute.currency !== payment.currency
        || !Number.isSafeInteger(dispute.amount) || dispute.amount <= 0 || dispute.amount > payment.amount) fail('payment/invalid-webhook', 'Webhook dispute data is invalid.');
      let status;
      if (['payment.dispute.created', 'payment.dispute.action_required', 'payment.dispute.under_review'].includes(payload.event)) status = 'DISPUTED';
      else if (payload.event === 'payment.dispute.won' || (payload.event === 'payment.dispute.closed' && dispute.status === 'won')) status = paymentLifecycle(payment, { id: payment.order_id, amount: payment.amount, currency: payment.currency, status: 'paid', amount_paid: payment.amount, amount_due: 0 }).status;
      else if (payload.event === 'payment.dispute.lost' || (payload.event === 'payment.dispute.closed' && dispute.status === 'lost')) {
        status = 'REVERSED';
      } else fail('payment/provider-state-unsupported', 'Provider dispute state is unsupported.', 409);
      return Object.freeze({ provider: 'razorpay', eventId, eventType: payload.event, providerOrderId: payment.order_id, providerPaymentId: payment.id, status, favorableResolution: payload.event === 'payment.dispute.won' || (payload.event === 'payment.dispute.closed' && dispute.status === 'won'), refundedAmountMinor: Number(payment.amount_refunded ?? 0), amountMinor: payment.amount, currency: payment.currency, occurredAt: Number(dispute.created_at) || null });
    }
    const entity = payment ?? order;
    if (!entity) fail('payment/invalid-webhook', 'Webhook payment data is missing.');
    if ((payment && payment.entity !== 'payment') || (order && order.entity !== 'order')) fail('payment/invalid-webhook', 'Webhook entity is invalid.');
    const providerOrderId = payment?.order_id ?? order?.id;
    const providerPaymentId = payment?.id ?? order?.payment_id;
    const providerStatus = payment?.status ?? (payload.event === 'order.paid' ? 'captured' : null);
    if (!IDENTIFIER.test(providerOrderId ?? '') || !IDENTIFIER.test(providerPaymentId ?? '') || !STATUS[providerStatus]) fail('payment/invalid-webhook', 'Webhook payment data is invalid.');
    if (providerStatus === 'captured' && payment?.captured !== true) fail('payment/invalid-webhook', 'Webhook capture evidence is incomplete.');
    return Object.freeze({ provider: 'razorpay', eventId, eventType: payload.event, providerOrderId, providerPaymentId, status: STATUS[providerStatus], amountMinor: payment?.amount ?? order?.amount_paid, currency: payment?.currency ?? order?.currency, occurredAt: Number(entity.created_at) || null });
}

export class RazorpayWebhookVerifier {
  constructor({ environment = process.env } = {}) {
    if (String(environment.PAYMENT_PROVIDER ?? '').trim() !== 'razorpay') fail('payment/provider-unavailable', 'Payment provider configuration is unavailable.', 503);
    this.webhookSecret = required(environment, 'RAZORPAY_PAYMENT_WEBHOOK_SECRET');
    if (Buffer.byteLength(this.webhookSecret, 'utf8') < 16) fail('payment/provider-unavailable', 'Payment provider configuration is unavailable.', 503);
  }

  async verifyWebhook({ rawBody, headers }) {
    return verifyRazorpayWebhook({ rawBody, headers, webhookSecret: this.webhookSecret });
  }
}

export function createRazorpayPaymentProvider(options) { return new RazorpayPaymentProvider(options); }
