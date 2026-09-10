import { describe, expect, it } from 'vitest';
import { getSubscriptionPlan, subscriptionPlans } from '../../functions/src/subscriptions/SubscriptionPlans.js';
import { addCalendarMonths, resolvePremiumEntitlement, subscriptionGrantsPremium, SubscriptionService } from '../../functions/src/subscriptions/SubscriptionService.js';
import { createDevelopmentGrantHandler } from '../../server/subscriptions/developmentGrantHandler.js';

const stamp = (date) => ({ toDate: () => new Date(date) });
const timestamp = { now: () => stamp('2026-01-15T12:00:00Z'), fromDate: stamp };
function database(seed = {}) {
  const values = new Map(Object.entries(seed));
  const snapshot = (path) => ({ exists: values.has(path), data: () => values.get(path) });
  return {
    values,
    doc: (path) => ({ path, get: async () => snapshot(path) }),
    runTransaction: async (callback) => callback({
      get: async ({ path }) => snapshot(path),
      getAll: async (...refs) => refs.map(({ path }) => snapshot(path)),
      create: ({ path }, value) => { if (values.has(path)) throw new Error('already exists'); values.set(path, value); },
      set: ({ path }, value) => values.set(path, value),
    }),
  };
}
const service = (db, now = '2026-01-15T12:00:00Z') => new SubscriptionService({ db, timestamp, now: () => new Date(now) });

describe('M3 subscription foundation', () => {
  it('pins canonical INR plans and calendar durations', () => {
    expect(subscriptionPlans.map(({ planId, priceMinor, durationMonths, currency }) => ({ planId, priceMinor, durationMonths, currency }))).toEqual([
      { planId: 'monthly', priceMinor: 49_900, durationMonths: 1, currency: 'INR' },
      { planId: 'half_yearly', priceMinor: 99_900, durationMonths: 6, currency: 'INR' },
      { planId: 'annual', priceMinor: 149_900, durationMonths: 12, currency: 'INR' },
    ]);
  });
  it('rejects unsupported and disabled plans', () => {
    expect(() => getSubscriptionPlan('weekly')).toThrowError(expect.objectContaining({ code: 'subscription/unsupported-plan' }));
    expect(() => getSubscriptionPlan('monthly', [{ ...subscriptionPlans[0], enabled: false }])).toThrowError(expect.objectContaining({ code: 'subscription/disabled-plan' }));
  });
  it('uses deterministic end-of-month calendar semantics', () => {
    expect(addCalendarMonths(new Date('2025-01-31T08:30:00Z'), 1).toISOString()).toBe('2025-02-28T08:30:00.000Z');
    expect(addCalendarMonths(new Date('2024-01-31T08:30:00Z'), 1).toISOString()).toBe('2024-02-29T08:30:00.000Z');
  });
  it.each([['monthly', '2026-02-15T12:00:00.000Z'], ['half_yearly', '2026-07-15T12:00:00.000Z'], ['annual', '2027-01-15T12:00:00.000Z']])('grants %s from server time', async (planId, expiry) => {
    const db = database();
    const result = await service(db).grantDevelopmentPlan({ principal: { uid: 'owner' }, request: { planId, requestId: `request-${planId}-0001` } });
    expect(result.entitlement).toMatchObject({ tier: 'PREMIUM', active: true, planId });
    expect(result.entitlement.expiresAt.toISOString()).toBe(expiry);
    const subscription = [...db.values.entries()].find(([path]) => path.includes('/subscriptions/'))[1];
    expect(subscription).toMatchObject({ ownerUid: 'owner', planId, source: 'DEVELOPMENT_GRANT', status: 'ACTIVE', currency: 'INR' });
  });
  it('extends active Premium from existing expiry', async () => {
    const path = 'users/owner/entitlements/premium';
    const subscriptionId = 'previous-active';
    const db = database({
      [path]: { ownerUid: 'owner', tier: 'PREMIUM', active: true, subscriptionId, planId: 'monthly', expiresAt: stamp('2026-03-20T12:00:00Z') },
      [`users/owner/subscriptions/${subscriptionId}`]: { ownerUid: 'owner', status: 'ACTIVE', planId: 'monthly', expiresAt: stamp('2026-03-20T12:00:00Z') },
    });
    const result = await service(db).grantDevelopmentPlan({ principal: { uid: 'owner' }, request: { planId: 'monthly', requestId: 'request-extension-0001' } });
    expect(result.entitlement.expiresAt.toISOString()).toBe('2026-04-20T12:00:00.000Z');
  });
  it('starts expired Premium from current server time', async () => {
    const db = database({ 'users/owner/entitlements/premium': { ownerUid: 'owner', tier: 'PREMIUM', active: true, subscriptionId: 'expired', planId: 'monthly', expiresAt: stamp('2025-12-01T00:00:00Z') }, 'users/owner/subscriptions/expired': { ownerUid: 'owner', status: 'ACTIVE', planId: 'monthly', expiresAt: stamp('2025-12-01T00:00:00Z') } });
    const result = await service(db).grantDevelopmentPlan({ principal: { uid: 'owner' }, request: { planId: 'monthly', requestId: 'request-expired-0001' } });
    expect(result.entitlement.expiresAt.toISOString()).toBe('2026-02-15T12:00:00.000Z');
  });
  it('rejects missing identity and client authority fields', async () => {
    await expect(service(database()).grantDevelopmentPlan({ principal: null, request: { planId: 'monthly', requestId: 'request-no-auth-0001' } })).rejects.toMatchObject({ code: 'subscription/unauthenticated' });
    for (const field of ['uid', 'priceMinor', 'durationMonths']) {
      await expect(service(database()).grantDevelopmentPlan({ principal: { uid: 'owner' }, request: { planId: 'monthly', requestId: `request-forged-${field}`, [field]: 1 } })).rejects.toMatchObject({ code: 'subscription/client-authority-rejected' });
    }
  });
  it('keeps replay idempotent and creates no coin or payment records', async () => {
    const db = database();
    const input = { principal: { uid: 'owner' }, request: { planId: 'monthly', requestId: 'request-replay-0001' } };
    expect((await service(db).grantDevelopmentPlan(input)).duplicate).toBe(false);
    expect((await service(db).grantDevelopmentPlan(input)).duplicate).toBe(true);
    expect([...db.values.keys()].filter((path) => path.includes('/subscriptions/'))).toHaveLength(1);
    expect([...db.values.keys()].some((path) => /coin|payment|wallet/i.test(path))).toBe(false);
  });
  it('replaying an older grant preserves the newer authoritative entitlement', async () => {
    const db = database();
    const monthly = { principal: { uid: 'owner' }, request: { planId: 'monthly', requestId: 'request-history-monthly' } };
    const halfYearly = { principal: { uid: 'owner' }, request: { planId: 'half_yearly', requestId: 'request-history-half-yearly' } };
    await service(db).grantDevelopmentPlan(monthly);
    const latest = await service(db).grantDevelopmentPlan(halfYearly);
    const replay = await service(db).grantDevelopmentPlan(monthly);
    expect(replay).toMatchObject({ duplicate: true, entitlement: { tier: 'PREMIUM', active: true, planId: 'half_yearly' } });
    expect(replay.entitlement.expiresAt).toEqual(latest.entitlement.expiresAt);
    expect([...db.values.keys()].filter((path) => path.includes('/subscriptions/'))).toHaveLength(2);
  });
  it('resolves expired and cancelled access as FREE', () => {
    const stale = { ownerUid: 'owner', tier: 'PREMIUM', active: true, subscriptionId: 'sub', planId: 'monthly', expiresAt: stamp('2026-01-01T00:00:00Z') };
    expect(resolvePremiumEntitlement(stale, new Date('2026-01-15T00:00:00Z'), { ownerUid: 'owner', status: 'ACTIVE', planId: 'monthly' }).tier).toBe('FREE');
    expect(resolvePremiumEntitlement({ ...stale, expiresAt: stamp('2027-01-01T00:00:00Z') }, new Date('2026-01-15T00:00:00Z'), { ownerUid: 'owner', status: 'CANCELLED', planId: 'monthly' }).tier).toBe('FREE');
    expect(subscriptionGrantsPremium({ status: 'CANCELLED', expiresAt: stamp('2027-01-01T00:00:00Z') }, new Date('2026-01-15T00:00:00Z'))).toBe(false);
  });
  it('handles six-month and annual leap-day calendar edges', () => {
    expect(addCalendarMonths(new Date('2025-08-31T00:00:00Z'), 6).toISOString()).toBe('2026-02-28T00:00:00.000Z');
    expect(addCalendarMonths(new Date('2024-02-29T00:00:00Z'), 12).toISOString()).toBe('2025-02-28T00:00:00.000Z');
  });
  it('keeps the development grant route fail-closed outside the local emulator boundary', async () => {
    let result;
    const response = { status: (status) => ({ json: (body) => { result = { status, body }; } }) };
    await createDevelopmentGrantHandler({ environment: {} })({ method: 'POST' }, response);
    expect(result).toEqual({ status: 404, body: { error: { code: 'subscription/not-available', message: 'Subscription grants are unavailable.' } } });
  });
});
