import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { calculateReferralReward, REFERRAL_POLICY, referralRateForTier } from '../../functions/src/referrals/ReferralPolicy.js';
import { createReferralCode, normalizeReferralCode, ReferralService } from '../../functions/src/referrals/ReferralService.js';

const stamp = (value = '2026-09-10T00:00:00Z') => ({ toDate: () => new Date(value) });
const timestamp = { now: () => stamp() };
function database(seed = {}) {
  const values = new Map(Object.entries(seed));
  const snapshot = (path) => ({ exists: values.has(path), data: () => values.get(path) });
  return {
    values,
    doc: (path) => ({ path, get: async () => snapshot(path) }),
    runTransaction: async (callback) => callback({
      get: async ({ path }) => snapshot(path),
      create: ({ path }, value) => { if (values.has(path)) throw new Error('exists'); values.set(path, value); },
      set: ({ path }, value) => values.set(path, value),
    }),
  };
}
const service = (db, options = {}) => new ReferralService({ db, timestamp, now: () => new Date('2026-09-10T00:00:00Z'), ...options });

describe('M5.1 referral policy', () => {
  it('pins the versioned INR policy and rates', () => {
    expect(REFERRAL_POLICY).toMatchObject({ policyVersion: 'm5-v1', currency: 'INR', enabled: true, rounding: 'FLOOR_TO_MINOR_UNIT', ratesBps: { FREE: 1000, PREMIUM: 1500 } });
    expect(referralRateForTier('FREE')).toBe(1000);
    expect(referralRateForTier('PREMIUM')).toBe(1500);
    expect(() => referralRateForTier('FREE', { ...REFERRAL_POLICY, enabled: false })).toThrowError(expect.objectContaining({ code: 'referral/policy-disabled' }));
  });
  it.each([[49900, 1000, 4990], [99900, 1000, 9990], [149900, 1000, 14990], [49900, 1500, 7485], [99900, 1500, 14985], [149900, 1500, 22485]])('calculates %i at %i bps as %i paise', (amount, rate, reward) => expect(calculateReferralReward(amount, rate)).toBe(reward));
  it('floors future fractional paise deterministically', () => expect(calculateReferralReward(101, 333)).toBe(3));
});

describe('M5.1 referral identity and attribution', () => {
  it('normalizes codes and rejects malformed codes', () => {
    expect(normalizeReferralCode(' mit-ab12cd ')).toBe('MITAB12CD');
    expect(() => normalizeReferralCode('LEARN10')).toThrowError(expect.objectContaining({ code: 'referral/invalid-code' }));
    expect(createReferralCode(new Uint8Array(6))).toMatch(/^MIT[A-Z0-9]{6}$/);
  });
  it('creates one stable unique server-owned code and retries a collision', async () => {
    const db = database({ 'referralCodes/MITAAAAAA': { ownerUid: 'other' } });
    const codes = ['MITAAAAAA', 'MITBBBBBB'];
    const referrals = service(db, { codeFactory: () => codes.shift() ?? 'MITCCCCCC' });
    expect(await referrals.ensureReferralIdentity({ uid: 'owner' })).toMatchObject({ code: 'MITBBBBBB', ownerUid: 'owner', created: true });
    expect(await referrals.ensureReferralIdentity({ uid: 'owner' })).toMatchObject({ code: 'MITBBBBBB', created: false });
  });
  it('creates immutable attribution and a privacy-minimal referrer read model', async () => {
    const db = database({ 'referralCodes/MITABC234': { code: 'MITABC234', ownerUid: 'referrer', active: true } });
    const referrals = service(db);
    expect(await referrals.attributeReferral({ principal: { uid: 'learner' }, request: { referralCode: 'mit-abc234' } })).toMatchObject({ status: 'ATTRIBUTED' });
    const readModel = [...db.values.entries()].find(([path]) => path.includes('referralReadModel'))[1];
    expect(readModel).toMatchObject({ status: 'ATTRIBUTED' });
    expect(readModel).not.toHaveProperty('referredUid');
    expect(readModel).not.toHaveProperty('email');
    await expect(referrals.attributeReferral({ principal: { uid: 'learner' }, request: { referralCode: 'MITABC234' } })).rejects.toMatchObject({ code: 'referral/already-attributed' });
  });
  it('rejects self-referral, inactive/nonexistent codes, and client authority', async () => {
    const db = database({ 'referralCodes/MITABC234': { ownerUid: 'owner', active: true }, 'referralCodes/MITOFF234': { ownerUid: 'other', active: false } });
    const referrals = service(db);
    await expect(referrals.attributeReferral({ principal: { uid: 'owner' }, request: { referralCode: 'MITABC234' } })).rejects.toMatchObject({ code: 'referral/self-referral' });
    await expect(referrals.attributeReferral({ principal: { uid: 'owner' }, request: { referralCode: 'MITOFF234' } })).rejects.toMatchObject({ code: 'referral/code-inactive' });
    await expect(referrals.attributeReferral({ principal: { uid: 'owner' }, request: { referralCode: 'MITZZZ999' } })).rejects.toMatchObject({ code: 'referral/code-not-found' });
    await expect(referrals.attributeReferral({ principal: { uid: 'owner' }, request: { referralCode: 'MITZZZ999', referrerUid: 'chosen' } })).rejects.toMatchObject({ code: 'referral/client-authority-rejected' });
  });
});

describe('M5.1 trusted qualification', () => {
  function attributed({ premium = false } = {}) {
    const referralId = 'stored-referral';
    const base = {
      'users/buyer/referralAttribution/current': { referredUid: 'buyer', referrerUid: 'owner', referralCode: 'MITABC234', status: 'ATTRIBUTED', attributedAt: stamp() },
      'referrals/7c1d0': {},
    };
    const db = database(base);
    // Service derives this opaque id; discover it by first performing attribution instead.
    db.values.clear();
    db.values.set('referralCodes/MITABC234', { code: 'MITABC234', ownerUid: 'owner', active: true });
    return service(db).attributeReferral({ principal: { uid: 'buyer' }, request: { referralCode: 'MITABC234' } }).then(() => {
      if (premium) {
        db.values.set('users/owner/entitlements/premium', { ownerUid: 'owner', tier: 'PREMIUM', active: true, subscriptionId: 'sub', planId: 'monthly', expiresAt: stamp('2027-01-01T00:00:00Z') });
        db.values.set('users/owner/subscriptions/sub', { ownerUid: 'owner', status: 'ACTIVE', planId: 'monthly', expiresAt: stamp('2027-01-01T00:00:00Z') });
      }
      return { db, referrals: service(db), referralId };
    });
  }
  const event = (overrides = {}) => ({ trusted: true, evidenceType: 'VERIFIED_PREMIUM_PURCHASE', source: 'PAYMENT', purchaserUid: 'buyer', purchaseId: 'purchase_00000001', planId: 'monthly', amountMinor: 49900, currency: 'INR', ...overrides });

  it('signup and Premium entitlement alone earn nothing; development grants fail closed', async () => {
    const { db, referrals } = await attributed({ premium: true });
    expect([...db.values.values()].some((value) => value.status === 'QUALIFIED')).toBe(false);
    await expect(referrals.qualifyReferralFromVerifiedPurchase(event({ source: 'DEVELOPMENT_GRANT' }))).rejects.toMatchObject({ code: 'referral/non-qualifying-source' });
    await expect(referrals.qualifyReferralFromVerifiedPurchase(event({ source: 'COINS' }))).rejects.toMatchObject({ code: 'referral/non-qualifying-source' });
  });
  it.each([[false, 1000, 4990], [true, 1500, 7485]])('uses current tier at qualification (premium=%s)', async (premium, rate, reward) => {
    const { referrals } = await attributed({ premium });
    expect(await referrals.qualifyReferralFromVerifiedPurchase(event())).toMatchObject({ qualified: true, rewardRateBps: rate, calculatedRewardMinor: reward, qualifyingAmountMinor: 49900 });
  });
  it('evaluates tier at qualification after attribution, including expired Premium', async () => {
    const current = await attributed();
    current.db.values.set('users/owner/entitlements/premium', { ownerUid: 'owner', tier: 'PREMIUM', active: true, subscriptionId: 'sub', planId: 'monthly', expiresAt: stamp('2027-01-01T00:00:00Z') });
    current.db.values.set('users/owner/subscriptions/sub', { ownerUid: 'owner', status: 'ACTIVE', planId: 'monthly', expiresAt: stamp('2027-01-01T00:00:00Z') });
    expect(await current.referrals.qualifyReferralFromVerifiedPurchase(event())).toMatchObject({ referrerTierAtQualification: 'PREMIUM', rewardRateBps: 1500 });

    const expired = await attributed();
    expired.db.values.set('users/owner/entitlements/premium', { ownerUid: 'owner', tier: 'PREMIUM', active: true, subscriptionId: 'old', planId: 'monthly', expiresAt: stamp('2026-01-01T00:00:00Z') });
    expired.db.values.set('users/owner/subscriptions/old', { ownerUid: 'owner', status: 'ACTIVE', planId: 'monthly', expiresAt: stamp('2026-01-01T00:00:00Z') });
    expect(await expired.referrals.qualifyReferralFromVerifiedPurchase(event())).toMatchObject({ referrerTierAtQualification: 'FREE', rewardRateBps: 1000 });
  });
  it('is purchase-idempotent, blocks conflicts and never creates wallet/payment/coin records', async () => {
    const { db, referrals } = await attributed();
    const first = await referrals.qualifyReferralFromVerifiedPurchase(event());
    expect(await referrals.qualifyReferralFromVerifiedPurchase(event())).toMatchObject({ duplicate: true, qualified: true, referralId: first.referralId, calculatedRewardMinor: 4990 });
    await expect(referrals.qualifyReferralFromVerifiedPurchase(event({ purchaserUid: 'attacker' }))).rejects.toMatchObject({ code: 'referral/purchase-conflict' });
    expect(first.status).toBe('QUALIFIED');
    expect([...db.values.keys()].some((path) => /wallet|withdraw|coin|payment/i.test(path))).toBe(false);
  });
  it('does not reward a later qualifying purchase', async () => {
    const { db, referrals } = await attributed();
    await referrals.qualifyReferralFromVerifiedPurchase(event());
    expect(await referrals.qualifyReferralFromVerifiedPurchase(event({ purchaseId: 'purchase_00000002', planId: 'annual', amountMinor: 149900 }))).toEqual({ qualified: false, reason: 'FIRST_PURCHASE_ALREADY_QUALIFIED' });
    expect([...db.values.values()].filter((value) => value.status === 'QUALIFIED' && value.calculatedRewardMinor != null)).toHaveLength(2); // authoritative record + safe projection
  });
  it('validates trusted evidence against canonical price and exposes no browser qualification boundary', async () => {
    const { referrals } = await attributed();
    await expect(referrals.qualifyReferralFromVerifiedPurchase(event({ amountMinor: 1, rateBps: 9999, currency: 'USD' }))).rejects.toMatchObject({ code: 'referral/purchase-mismatch' });
    await expect(referrals.qualifyReferralFromVerifiedPurchase({ ...event(), trusted: false })).rejects.toMatchObject({ code: 'referral/untrusted-purchase' });
    expect(readFileSync('functions/src/index.js', 'utf8')).not.toMatch(/export const qualifyReferral/);
  });
});
