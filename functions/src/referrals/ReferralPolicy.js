export const REFERRAL_POLICY = Object.freeze({
  policyVersion: 'm5-v1',
  enabled: true,
  currency: 'INR',
  rounding: 'FLOOR_TO_MINOR_UNIT',
  qualificationEvent: 'VERIFIED_PREMIUM_PURCHASE',
  ratesBps: Object.freeze({ FREE: 1000, PREMIUM: 1500 }),
});

export function referralRateForTier(tier, policy = REFERRAL_POLICY) {
  if (!policy.enabled) throw Object.assign(new Error('The referral policy is disabled.'), { code: 'referral/policy-disabled' });
  return tier === 'PREMIUM' ? policy.ratesBps.PREMIUM : policy.ratesBps.FREE;
}

export function calculateReferralReward(amountMinor, rateBps) {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0 || !Number.isInteger(rateBps) || rateBps < 0) {
    throw Object.assign(new Error('Referral reward inputs are invalid.'), { code: 'referral/invalid-calculation' });
  }
  return Math.floor((amountMinor * rateBps) / 10_000);
}
