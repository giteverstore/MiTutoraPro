import { getSubscriptionPlan } from '../../functions/src/subscriptions/SubscriptionPlans.js';

export async function createCanonicalCapturedPayment(db, timestamp, {
  paymentId,
  ownerUid,
  planId,
  provider = 'test-provider',
}) {
  const plan = getSubscriptionPlan(planId);
  const capturedAt = timestamp.now();
  const internalOrderId = `order-${paymentId}`;
  const providerOrderId = `provider-order-${paymentId}`;
  const providerPaymentId = `provider-payment-${paymentId}`;
  await db.doc(`paymentOrders/${internalOrderId}`).create({
    internalOrderId,
    ownerUid,
    planId: plan.planId,
    planVersion: plan.version,
    amountMinor: plan.priceMinor,
    currency: plan.currency,
    provider,
    providerOrderId,
    status: 'CAPTURED',
    createdAt: capturedAt,
    updatedAt: capturedAt,
    schemaVersion: '1.0.0',
  });
  await db.doc(`payments/${paymentId}`).create({
    paymentId,
    internalOrderId,
    provider,
    providerOrderId,
    providerPaymentId,
    ownerUid,
    planId: plan.planId,
    planVersion: plan.version,
    amountMinor: plan.priceMinor,
    refundedAmountMinor: 0,
    currency: plan.currency,
    status: 'CAPTURED',
    createdAt: capturedAt,
    capturedAt,
    updatedAt: capturedAt,
    schemaVersion: '1.0.0',
  });
  return { paymentId, capturedAt, plan };
}
