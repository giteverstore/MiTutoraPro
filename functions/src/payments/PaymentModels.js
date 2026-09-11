export const PAYMENT_SCHEMA_VERSION = '1.0.0';

export const PAYMENT_STATUS = Object.freeze({
  ORDER_CREATED: 'ORDER_CREATED',
  AUTHORIZED: 'AUTHORIZED',
  CAPTURED: 'CAPTURED',
  FAILED: 'FAILED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  REFUNDED: 'REFUNDED',
  DISPUTED: 'DISPUTED',
  REVERSED: 'REVERSED',
});

const transitions = Object.freeze({
  ORDER_CREATED: new Set(['AUTHORIZED', 'CAPTURED', 'FAILED']),
  AUTHORIZED: new Set(['CAPTURED', 'FAILED']),
  CAPTURED: new Set(['PARTIALLY_REFUNDED', 'REFUNDED', 'DISPUTED', 'REVERSED']),
  PARTIALLY_REFUNDED: new Set(['REFUNDED', 'DISPUTED', 'REVERSED']),
  DISPUTED: new Set(['CAPTURED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'REVERSED']),
  FAILED: new Set(),
  REFUNDED: new Set(),
  REVERSED: new Set(),
});

export function assertPaymentTransition(from, to) {
  if (!Object.hasOwn(PAYMENT_STATUS, from) || !Object.hasOwn(PAYMENT_STATUS, to)) {
    throw Object.assign(new Error('Payment status is unsupported.'), { code: 'payment/invalid-status' });
  }
  if (from === to) return Object.freeze({ idempotent: true });
  if (!transitions[from].has(to)) {
    throw Object.assign(new Error('Payment state transition is not allowed.'), { code: 'payment/invalid-transition' });
  }
  return Object.freeze({ idempotent: false });
}

export function isCapturedPayment(payment) {
  return payment?.status === PAYMENT_STATUS.CAPTURED;
}

export function validateRefundedAmount(amountMinor, refundedAmountMinor) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0
    || !Number.isSafeInteger(refundedAmountMinor) || refundedAmountMinor < 0
    || refundedAmountMinor > amountMinor) {
    throw Object.assign(new Error('Refund amount is outside the canonical payment bounds.'), { code: 'payment/invalid-refund' });
  }
  return refundedAmountMinor;
}
