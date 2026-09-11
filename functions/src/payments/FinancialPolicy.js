export const FINANCIAL_POLICY = Object.freeze({
  policyVersion: 'm8-v1',
  referralReleaseDelayDays: 7,
});

export function calculateNetEligibleMinor(originalPaymentMinor, cumulativeRefundedMinor) {
  if (!Number.isSafeInteger(originalPaymentMinor) || originalPaymentMinor <= 0
    || !Number.isSafeInteger(cumulativeRefundedMinor) || cumulativeRefundedMinor < 0
    || cumulativeRefundedMinor > originalPaymentMinor) {
    throw Object.assign(new Error('Refund amount is outside the payment bounds.'), { code: 'payment/invalid-refund' });
  }
  return originalPaymentMinor - cumulativeRefundedMinor;
}

export function calculateEligibleReferralMinor(originalPaymentMinor, cumulativeRefundedMinor, frozenRateBps) {
  if (!Number.isSafeInteger(frozenRateBps) || frozenRateBps < 0 || frozenRateBps > 10_000) {
    throw Object.assign(new Error('Frozen referral rate is invalid.'), { code: 'settlement/invalid-referral-rate' });
  }
  const result = Number((BigInt(calculateNetEligibleMinor(originalPaymentMinor, cumulativeRefundedMinor)) * BigInt(frozenRateBps)) / 10_000n);
  if (!Number.isSafeInteger(result)) {
    throw Object.assign(new Error('Eligible referral value exceeds supported monetary bounds.'), { code: 'settlement/invalid-referral-rate' });
  }
  return result;
}
