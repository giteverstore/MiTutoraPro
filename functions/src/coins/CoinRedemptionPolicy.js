export const COIN_REDEMPTION_POLICY_VERSION = 'coin-redemption-v1';
export const COIN_REDEMPTION_TIME_ZONE = 'Asia/Kolkata';

export const COIN_REDEMPTION_TYPES = Object.freeze({
  CHALLENGE_PASS: 'CHALLENGE_PASS',
  PREMIUM_MONTH: 'PREMIUM_MONTH',
});

export const coinRedemptionPolicy = Object.freeze({
  version: COIN_REDEMPTION_POLICY_VERSION,
  timeZone: COIN_REDEMPTION_TIME_ZONE,
  challengePass: Object.freeze({ type: COIN_REDEMPTION_TYPES.CHALLENGE_PASS, costCoins: 150, monthlyLimit: 3 }),
  premiumMonth: Object.freeze({ type: COIN_REDEMPTION_TYPES.PREMIUM_MONTH, costCoins: 2500, durationMonths: 1, monthlyLimit: 1 }),
});

export function kolkataMonthKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: COIN_REDEMPTION_TIME_ZONE, year: 'numeric', month: '2-digit' }).formatToParts(date);
  const value = Object.fromEntries(parts.map(({ type, value: item }) => [type, item]));
  return `${value.year}-${value.month}`;
}

export function kolkataDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: COIN_REDEMPTION_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const value = Object.fromEntries(parts.map(({ type, value: item }) => [type, item]));
  return `${value.year}-${value.month}-${value.day}`;
}
