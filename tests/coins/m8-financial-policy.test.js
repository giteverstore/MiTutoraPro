import { describe, expect, it } from 'vitest';
import { calculateEligibleReferralMinor, calculateNetEligibleMinor, FINANCIAL_POLICY } from '../../functions/src/payments/FinancialPolicy.js';
import { ReferralSettlementService } from '../../functions/src/payments/ReferralSettlementService.js';
import { SubscriptionService } from '../../functions/src/subscriptions/SubscriptionService.js';

const instant = new Date('2026-09-18T00:00:00Z');
const stamp = (date = instant) => ({ toDate: () => date, seconds: Math.floor(date.getTime() / 1000) });
const timestamp = { now: () => stamp(), fromDate: stamp };
function database(seed = {}) {
  const values = new Map(Object.entries(seed));
  const snapshot = (path) => ({ exists: values.has(path), id: path.split('/').at(-1), data: () => values.get(path) });
  const doc = (path) => ({ path });
  const collection = (path) => ({ path, query: true });
  const querySnapshot = (path) => ({ docs: [...values.entries()].filter(([key]) => key.startsWith(`${path}/`) && key.slice(path.length + 1).split('/').length === 1).map(([key]) => snapshot(key)) });
  return { values, doc, collection, runTransaction: async (callback) => callback({
    get: async (ref) => ref.query ? querySnapshot(ref.path) : snapshot(ref.path),
    getAll: async (...refs) => refs.map((ref) => snapshot(ref.path)),
    create: (ref, value) => { if (values.has(ref.path)) throw new Error('exists'); values.set(ref.path, value); },
    set: (ref, value) => values.set(ref.path, value), update: (ref, patch) => values.set(ref.path, { ...values.get(ref.path), ...patch }),
  }) };
}
const pid = (letter) => `payment_${letter.repeat(64)}`;
function settlementSeed({ paymentId = pid('a'), walletStatus = 'PENDING', originalReward = 4_990, pending = originalReward, available = 0, clawback = 0 } = {}) {
  return {
    [`payments/${paymentId}`]: { paymentId, provider: 'test-provider', ownerUid: 'buyer', status: 'CAPTURED', amountMinor: 49_900, refundedAmountMinor: 0, currency: 'INR' },
    [`referralPurchaseQualifications/${paymentId}`]: { referralId: `referral-${paymentId.at(-1)}`, result: { calculatedRewardMinor: originalReward } },
    [`referrals/referral-${paymentId.at(-1)}`]: { referralId: `referral-${paymentId.at(-1)}`, referrerUid: 'owner', qualifyingPurchaseReference: paymentId, status: 'QUALIFIED', calculatedRewardMinor: originalReward, eligibleRewardMinor: pending, pendingRewardMinor: pending, rewardRateBps: 1_000, currency: 'INR', walletSettlementStatus: walletStatus, ...(walletStatus === 'SETTLED' ? { releasedRewardMinor: originalReward } : {}) },
    'users/owner/wallet/account': { currency: 'INR', pendingBalanceMinor: pending, availableBalanceMinor: available, reservedBalanceMinor: 0, outstandingReferralClawbackMinor: clawback, lifetimeCreditedMinor: pending + available, createdAt: stamp(), updatedAt: stamp(), schemaVersion: '1.0.0' },
  };
}
const evidence = (paymentId, state, occurredAt, extra = {}) => ({ trusted: true, source: 'PROVIDER_RECONCILIATION', provider: 'test-provider', evidenceId: `evidence-${state.toLowerCase()}-${paymentId.at(-1)}`, paymentId, state, currency: 'INR', occurredAt: stamp(occurredAt), ...extra });

describe('M8.5 frozen financial policy', () => {
  it('pins m8-v1, seven days, and integer proportional referral arithmetic', () => {
    expect(FINANCIAL_POLICY).toEqual({ policyVersion: 'm8-v1', referralReleaseDelayDays: 7 });
    expect(calculateNetEligibleMinor(49_900, 24_950)).toBe(24_950);
    expect(calculateEligibleReferralMinor(49_900, 24_950, 1_000)).toBe(2_495);
    expect(calculateEligibleReferralMinor(49_900, 1, 1_500)).toBe(7_484);
    expect(calculateEligibleReferralMinor(Number.MAX_SAFE_INTEGER, 0, 10_000)).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('blocks at 6d 23:59:59 and releases at exactly seven days', async () => {
    const start = new Date('2026-09-11T00:00:00Z');
    const beforeDb = database(settlementSeed());
    await expect(new ReferralSettlementService({ db: beforeDb, timestamp, now: () => new Date('2026-09-17T23:59:59Z') }).applyTrustedEvidence(evidence(pid('a'), 'SETTLED', start))).rejects.toMatchObject({ code: 'settlement/cooling-active' });
    const boundaryDb = database(settlementSeed());
    await expect(new ReferralSettlementService({ db: boundaryDb, timestamp, now: () => new Date('2026-09-18T00:00:00Z') }).applyTrustedEvidence(evidence(pid('a'), 'SETTLED', start))).resolves.toMatchObject({ state: 'AVAILABLE', availableMinor: 4_990 });
  });

  it('offsets outstanding clawback before increasing AVAILABLE', async () => {
    const paymentId = pid('b'); const db = database(settlementSeed({ paymentId, originalReward: 7_000, pending: 7_000, clawback: 5_000 }));
    const service = new ReferralSettlementService({ db, timestamp, now: () => instant });
    const result = await service.applyTrustedEvidence(evidence(paymentId, 'SETTLED', new Date('2026-09-11T00:00:00Z')));
    expect(result).toMatchObject({ amountMinor: 7_000, clawbackOffsetMinor: 5_000, availableMinor: 2_000 });
    expect(db.values.get('users/owner/wallet/account')).toMatchObject({ pendingBalanceMinor: 0, availableBalanceMinor: 2_000, outstandingReferralClawbackMinor: 0 });
  });
});

describe('M8.5 authoritative Premium recomputation', () => {
  const subscription = (paymentId, months, planId) => ({ ownerUid: 'buyer', source: 'PAYMENT', paymentId, planId, status: 'ACTIVE', startsAt: stamp(new Date('2026-09-01T00:00:00Z')), expiresAt: stamp(new Date(`2026-${months}-30T00:00:00Z`)) });
  it('keeps Premium from another valid purchase when one purchase is refunded', async () => {
    const first = pid('c'); const second = pid('d');
    const db = database({
      'users/buyer/subscriptions/first': subscription(first, '10', 'monthly'),
      'users/buyer/subscriptions/second': subscription(second, '12', 'annual'),
      [`payments/${first}`]: { ownerUid: 'buyer', subscriptionId: 'first', status: 'CAPTURED' },
      [`payments/${second}`]: { ownerUid: 'buyer', subscriptionId: 'second', status: 'REFUNDED' },
    });
    expect(await new SubscriptionService({ db, timestamp, now: () => instant }).recomputePremiumEntitlement('buyer')).toMatchObject({ tier: 'PREMIUM', subscriptionId: 'first' });
  });

  it('suspends a sole disputed purchase and preserves partial-refund duration', async () => {
    const paymentId = pid('e');
    const disputed = database({ 'users/buyer/subscriptions/only': subscription(paymentId, '12', 'annual'), [`payments/${paymentId}`]: { ownerUid: 'buyer', subscriptionId: 'only', status: 'DISPUTED' } });
    expect(await new SubscriptionService({ db: disputed, timestamp, now: () => instant }).recomputePremiumEntitlement('buyer')).toMatchObject({ tier: 'FREE', active: false });
    const partial = database({ 'users/buyer/subscriptions/only': subscription(paymentId, '12', 'annual'), [`payments/${paymentId}`]: { ownerUid: 'buyer', subscriptionId: 'only', status: 'PARTIALLY_REFUNDED' } });
    expect(await new SubscriptionService({ db: partial, timestamp, now: () => instant }).recomputePremiumEntitlement('buyer')).toMatchObject({ tier: 'PREMIUM', active: true, subscriptionId: 'only' });
  });
});
