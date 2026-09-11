import { createHash } from 'node:crypto';
import { getSubscriptionPlan } from '../subscriptions/SubscriptionPlans.js';
import { assertPaymentTransition, PAYMENT_SCHEMA_VERSION, PAYMENT_STATUS, validateRefundedAmount } from './PaymentModels.js';

const ORDER_FIELDS = new Set(['planId', 'requestId']);
const EVIDENCE_FIELDS = new Set(['trusted', 'source', 'provider', 'eventId', 'eventType', 'internalOrderId', 'providerOrderId', 'providerPaymentId', 'status', 'amountMinor', 'refundedAmountMinor', 'currency', 'occurredAt']);
const IDENTIFIER = /^[A-Za-z0-9_.:-]{8,180}$/;
const TRUSTED_SOURCES = new Set(['PROVIDER_WEBHOOK', 'PROVIDER_FETCH', 'PROVIDER_RECONCILIATION', 'VERIFIED_CHECKOUT_SIGNATURE']);
const digest = (prefix, value) => `${prefix}_${createHash('sha256').update(value).digest('hex')}`;
const data = (snapshot) => snapshot?.exists ? snapshot.data() : null;
function fail(code, message) { throw Object.assign(new Error(message), { code }); }

export class PaymentService {
  constructor({ db, timestamp }) {
    if (!db?.doc || !db?.runTransaction || !timestamp?.now) throw new TypeError('PaymentService requires Firestore and a timestamp factory.');
    this.db = db;
    this.timestamp = timestamp;
  }

  async createCanonicalOrder({ principal, request, provider }) {
    const ownerUid = principal?.uid;
    if (!ownerUid) fail('payment/unauthenticated', 'Authentication is required.');
    if (!request || typeof request !== 'object' || Array.isArray(request) || Object.keys(request).some((key) => !ORDER_FIELDS.has(key))) {
      fail('payment/client-authority-rejected', 'Only a plan and request identity may be submitted.');
    }
    if (!IDENTIFIER.test(request.requestId ?? '') || !IDENTIFIER.test(provider ?? '')) fail('payment/invalid-order', 'Payment order identity is invalid.');
    const plan = getSubscriptionPlan(request.planId);
    const internalOrderId = digest('order', `${ownerUid}\0${request.requestId}`);
    const fingerprint = createHash('sha256').update([ownerUid, request.requestId, plan.planId, plan.version, String(plan.priceMinor), plan.currency, provider].join('\0')).digest('hex');
    const orderRef = this.db.doc(`paymentOrders/${internalOrderId}`);
    return this.db.runTransaction(async (tx) => {
      const existing = data(await tx.get(orderRef));
      if (existing) {
        if (existing.fingerprint !== fingerprint) fail('payment/order-conflict', 'Payment request identity was reused with conflicting data.');
        return { ...existing, duplicate: true };
      }
      const order = {
        internalOrderId, ownerUid, planId: plan.planId, planVersion: plan.version,
        amountMinor: plan.priceMinor, currency: plan.currency, provider,
        status: PAYMENT_STATUS.ORDER_CREATED, providerOrderId: null, providerOrderState: 'NOT_STARTED', fingerprint,
        createdAt: this.timestamp.now(), schemaVersion: PAYMENT_SCHEMA_VERSION,
      };
      tx.create(orderRef, order);
      return { ...order, duplicate: false };
    });
  }

  async claimProviderOrderCreation(internalOrderId, ownerUid) {
    const orderRef = this.db.doc(`paymentOrders/${internalOrderId}`);
    return this.db.runTransaction(async (tx) => {
      const order = data(await tx.get(orderRef));
      if (!order || order.ownerUid !== ownerUid) fail('payment/order-not-found', 'Canonical payment order was not found.');
      if (order.providerOrderState === 'CREATED') return { claimed: false, order };
      if (order.providerOrderState !== 'NOT_STARTED') fail('payment/order-pending-reconciliation', 'Payment order creation requires reconciliation.');
      const updatedAt = this.timestamp.now();
      tx.update(orderRef, { providerOrderState: 'CREATING', updatedAt });
      return { claimed: true, order: { ...order, providerOrderState: 'CREATING', updatedAt } };
    });
  }

  async attachProviderOrder({ internalOrderId, ownerUid, providerOrderId }) {
    if (!IDENTIFIER.test(providerOrderId ?? '')) fail('payment/invalid-provider-order', 'Provider order identity is invalid.');
    const orderRef = this.db.doc(`paymentOrders/${internalOrderId}`);
    const lookupRef = this.db.doc(`paymentOrderLookup/${digest('provider-order', providerOrderId)}`);
    return this.db.runTransaction(async (tx) => {
      const [orderSnapshot, lookupSnapshot] = await tx.getAll(orderRef, lookupRef);
      const order = data(orderSnapshot); const lookup = data(lookupSnapshot);
      if (!order || order.ownerUid !== ownerUid) fail('payment/order-not-found', 'Canonical payment order was not found.');
      if (order.providerOrderId) {
        if (order.providerOrderId !== providerOrderId) fail('payment/provider-order-conflict', 'Provider order conflicts with canonical state.');
        return { ...order, duplicate: true };
      }
      if (order.providerOrderState !== 'CREATING' || lookup) fail('payment/order-integrity', 'Provider order cannot be attached safely.');
      const updatedAt = this.timestamp.now();
      const result = { ...order, providerOrderId, providerOrderState: 'CREATED', updatedAt };
      tx.set(orderRef, result, { merge: false });
      tx.create(lookupRef, { providerOrderId, internalOrderId, ownerUid, createdAt: updatedAt, schemaVersion: PAYMENT_SCHEMA_VERSION });
      return { ...result, duplicate: false };
    });
  }

  async markProviderOrderUnknown(internalOrderId, ownerUid) {
    const orderRef = this.db.doc(`paymentOrders/${internalOrderId}`);
    return this.db.runTransaction(async (tx) => {
      const order = data(await tx.get(orderRef));
      if (!order || order.ownerUid !== ownerUid || order.providerOrderState !== 'CREATING') fail('payment/order-integrity', 'Payment order recovery state is invalid.');
      tx.update(orderRef, { providerOrderState: 'UNKNOWN', updatedAt: this.timestamp.now() });
    });
  }

  async getOrderByProviderOrderId(providerOrderId) {
    if (!IDENTIFIER.test(providerOrderId ?? '')) fail('payment/invalid-provider-order', 'Provider order identity is invalid.');
    const lookup = data(await this.db.doc(`paymentOrderLookup/${digest('provider-order', providerOrderId)}`).get());
    if (!lookup?.internalOrderId) fail('payment/order-not-found', 'Canonical payment order was not found.');
    const order = data(await this.db.doc(`paymentOrders/${lookup.internalOrderId}`).get());
    if (!order || order.providerOrderId !== providerOrderId || order.ownerUid !== lookup.ownerUid) fail('payment/order-integrity', 'Provider order lookup is invalid.');
    return order;
  }

  async recordVerifiedEvent(evidence) {
    if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence) || Object.keys(evidence).some((key) => !EVIDENCE_FIELDS.has(key))) {
      fail('payment/invalid-evidence', 'Verified payment evidence is invalid.');
    }
    if (evidence.trusted !== true || !TRUSTED_SOURCES.has(evidence.source)) fail('payment/untrusted-evidence', 'Trusted provider evidence is required.');
    for (const field of ['provider', 'eventId', 'eventType', 'internalOrderId', 'providerOrderId', 'providerPaymentId']) {
      if (!IDENTIFIER.test(evidence[field] ?? '')) fail('payment/invalid-evidence', 'Verified payment evidence is incomplete.');
    }
    const eventKey = digest('payment-event', `${evidence.provider}\0${evidence.eventId}`);
    const paymentId = digest('payment', `${evidence.provider}\0${evidence.providerPaymentId}`);
    const eventRef = this.db.doc(`paymentEvents/${eventKey}`);
    const orderRef = this.db.doc(`paymentOrders/${evidence.internalOrderId}`);
    const paymentRef = this.db.doc(`payments/${paymentId}`);
    const fingerprint = createHash('sha256').update([
      evidence.provider, evidence.eventId, evidence.eventType, evidence.internalOrderId,
      evidence.providerOrderId, evidence.providerPaymentId, evidence.status,
      String(evidence.amountMinor), String(evidence.refundedAmountMinor ?? 0), evidence.currency,
    ].join('\0')).digest('hex');
    return this.db.runTransaction(async (tx) => {
      const replay = data(await tx.get(eventRef));
      if (replay) {
        if (replay.fingerprint !== fingerprint) fail('payment/event-conflict', 'Provider event identity was reused with conflicting evidence.');
        return { ...replay.result, duplicate: true };
      }
      const order = data(await tx.get(orderRef));
      if (!order) fail('payment/order-not-found', 'Canonical payment order was not found.');
      const plan = getSubscriptionPlan(order.planId);
      if (order.planVersion !== plan.version || order.amountMinor !== plan.priceMinor || order.currency !== plan.currency || order.provider !== evidence.provider) {
        fail('payment/order-integrity', 'Canonical payment order does not match plan authority.');
      }
      if (evidence.amountMinor !== plan.priceMinor || evidence.currency !== plan.currency) fail('payment/amount-mismatch', 'Provider payment does not match the canonical amount.');
      if (order.providerOrderId && order.providerOrderId !== evidence.providerOrderId) fail('payment/provider-order-conflict', 'Provider order does not match canonical order.');
      const existingPayment = data(await tx.get(paymentRef));
      if (existingPayment && (existingPayment.internalOrderId !== order.internalOrderId || existingPayment.ownerUid !== order.ownerUid)) {
        fail('payment/payment-conflict', 'Provider payment identity is bound to another order.');
      }
      const fromStatus = existingPayment?.status ?? order.status;
      const transition = assertPaymentTransition(fromStatus, evidence.status);
      const previousRefunded = existingPayment?.refundedAmountMinor ?? 0;
      const refundedAmountMinor = ['PARTIALLY_REFUNDED', 'REFUNDED'].includes(evidence.status)
        ? validateRefundedAmount(plan.priceMinor, evidence.refundedAmountMinor)
        : previousRefunded;
      if (evidence.status === PAYMENT_STATUS.PARTIALLY_REFUNDED && (refundedAmountMinor <= 0 || refundedAmountMinor >= plan.priceMinor)) fail('payment/invalid-refund', 'A partial refund must be greater than zero and less than the payment amount.');
      if (evidence.status === PAYMENT_STATUS.REFUNDED && refundedAmountMinor !== plan.priceMinor) fail('payment/invalid-refund', 'A full refund must equal the payment amount.');
      if (refundedAmountMinor < previousRefunded) fail('payment/refund-regression', 'Cumulative refunded value cannot decrease.');
      const processedAt = this.timestamp.now();
      const payment = {
        ...(existingPayment ?? {}), paymentId, provider: evidence.provider,
        internalOrderId: order.internalOrderId, providerOrderId: evidence.providerOrderId,
        providerPaymentId: evidence.providerPaymentId, ownerUid: order.ownerUid,
        planId: plan.planId, planVersion: plan.version, amountMinor: plan.priceMinor,
        currency: plan.currency, status: evidence.status,
        refundedAmountMinor,
        createdAt: existingPayment?.createdAt ?? processedAt, updatedAt: processedAt,
        ...(evidence.status === PAYMENT_STATUS.CAPTURED
          ? { capturedAt: existingPayment?.capturedAt ?? processedAt }
          : {}),
        schemaVersion: PAYMENT_SCHEMA_VERSION,
      };
      const result = { paymentId, internalOrderId: order.internalOrderId, ownerUid: order.ownerUid, status: payment.status, transitionIdempotent: transition.idempotent };
      if (existingPayment) tx.set(paymentRef, payment, { merge: false }); else tx.create(paymentRef, payment);
      tx.set(orderRef, { ...order, providerOrderId: evidence.providerOrderId, status: evidence.status === PAYMENT_STATUS.CAPTURED ? PAYMENT_STATUS.CAPTURED : order.status, updatedAt: processedAt }, { merge: false });
      tx.create(eventRef, {
        eventId: evidence.eventId, eventType: evidence.eventType, provider: evidence.provider,
        providerOrderId: evidence.providerOrderId, providerPaymentId: evidence.providerPaymentId,
        internalOrderId: order.internalOrderId, paymentId, occurredAt: evidence.occurredAt ?? null,
        amountMinor: plan.priceMinor, currency: plan.currency,
        processedAt, fingerprint, result, schemaVersion: PAYMENT_SCHEMA_VERSION,
      });
      return { ...result, duplicate: false };
    });
  }
}
