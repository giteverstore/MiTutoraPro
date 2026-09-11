export const PAYOUT_STATUS = Object.freeze({
  INITIATION_PENDING: 'INITIATION_PENDING',
  PROCESSING: 'PROCESSING',
  UNKNOWN: 'UNKNOWN',
  PAID: 'PAID',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REVERSED: 'REVERSED',
});

const transitions = Object.freeze({
  INITIATION_PENDING: new Set(['PROCESSING', 'UNKNOWN', 'PAID', 'FAILED', 'CANCELLED', 'REVERSED']),
  PROCESSING: new Set(['UNKNOWN', 'PAID', 'FAILED', 'CANCELLED', 'REVERSED']),
  UNKNOWN: new Set(['PROCESSING', 'PAID', 'FAILED', 'CANCELLED', 'REVERSED']),
  PAID: new Set(['REVERSED']),
  FAILED: new Set(),
  CANCELLED: new Set(),
  REVERSED: new Set(),
});

export function assertPayoutTransition(from, to) {
  if (!transitions[from] || !transitions[to]) throw Object.assign(new Error('Payout status is unsupported.'), { code: 'payout/invalid-status' });
  if (from === to) return Object.freeze({ idempotent: true });
  if (!transitions[from].has(to)) throw Object.assign(new Error('Payout state transition is not allowed.'), { code: 'payout/invalid-transition' });
  return Object.freeze({ idempotent: false });
}
