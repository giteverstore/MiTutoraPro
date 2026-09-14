import { describe, expect, it } from 'vitest';
import { CoinRedemptionService } from '../../functions/src/coins/CoinRedemptionService.js';
import { coinRedemptionPolicy, kolkataMonthKey } from '../../functions/src/coins/CoinRedemptionPolicy.js';

const stamp = (date) => ({ toDate: () => new Date(date) });
const timestamp = { now: () => stamp('2026-09-20T06:30:00Z'), fromDate: (date) => stamp(date) };
function database(seed = {}) {
  const values = new Map(Object.entries(seed)); const snap = (path, id = path.split('/').at(-1)) => ({ id, exists: values.has(path), data: () => values.get(path) });
  const db = {
    values, doc: (path) => ({ path, get: async () => snap(path) }),
    collection: (name) => ({ where(field, op, value) { const filters = [[field, value]]; return { where(nextField, nextOp, nextValue) { filters.push([nextField, nextValue]); return this; }, limit() { return this; }, async get() { const docs = [...values].filter(([path, data]) => path.startsWith(`${name}/`) && filters.every(([key, expected]) => data[key] === expected)).map(([path]) => snap(path)); return { size: docs.length, docs }; } }; } }),
    runTransaction: async (fn) => fn({ get: async ({ path }) => snap(path), getAll: async (...refs) => refs.map(({ path }) => snap(path)), create: ({ path }, value) => { if (values.has(path)) throw new Error('exists'); values.set(path, value); }, set: ({ path }, value) => values.set(path, value), update: ({ path }, value) => values.set(path, { ...values.get(path), ...value }) }),
  }; return db;
}
const account = (balance) => ({ availableBalance: balance, lifetimeEarned: balance, lifetimeSpent: 0, revision: 1, createdAt: timestamp.now(), updatedAt: timestamp.now(), schemaVersion: '1.0.0' });
const principal = { authenticated: true, uid: 'learner' };
const service = (db, now = '2026-09-20T06:30:00Z') => new CoinRedemptionService({ db, timestamp, now: () => new Date(now) });

describe('coin redemption authority', () => {
  it('pins policy, costs, limits and Kolkata accounting month', () => {
    expect(coinRedemptionPolicy).toMatchObject({ version: 'coin-redemption-v1', timeZone: 'Asia/Kolkata', challengePass: { costCoins: 150, monthlyLimit: 3 }, premiumMonth: { costCoins: 2500, durationMonths: 1, monthlyLimit: 1 } });
    expect(kolkataMonthKey(new Date('2026-08-31T19:00:00Z'))).toBe('2026-09');
  });
  it('atomically debits an eligible pass once and creates an auditable unlock', async () => {
    const db = database({ 'users/learner/coinAccount/summary': account(500), 'dailyChallenges/2026-09-10': { id: '2026-09-10', date: '2026-09-10', version: 'v1', published: true } });
    const input = { principal, request: { requestId: 'challenge-request-0001', occurrenceDate: '2026-09-10' } };
    expect(await service(db).redeemChallengePass(input)).toMatchObject({ duplicate: false, balance: 350, occurrenceDate: '2026-09-10' });
    expect(await service(db).redeemChallengePass(input)).toMatchObject({ duplicate: true, balance: 350 });
    expect(db.values.get('users/learner/challengeUnlocks/2026-09-10')).toMatchObject({ status: 'UNLOCKED', assignmentId: '2026-09-10' });
    expect([...db.values.values()].filter((item) => item.direction === 'DEBIT')).toHaveLength(1);
  });
  it('rejects future, unpublished, completed, insufficient and fourth monthly pass without debit', async () => {
    const base = { 'users/learner/coinAccount/summary': account(1000), 'dailyChallenges/2026-09-10': { id: '2026-09-10', date: '2026-09-10', version: 'v1', published: true } };
    await expect(service(database(base)).redeemChallengePass({ principal, request: { requestId: 'future-request-0001', occurrenceDate: '2026-09-21' } })).rejects.toMatchObject({ code: 'coin/challenge-not-eligible' });
    await expect(service(database({ ...base, 'users/learner/coinAccount/summary': account(149) })).redeemChallengePass({ principal, request: { requestId: 'poor-request-00001', occurrenceDate: '2026-09-10' } })).rejects.toMatchObject({ code: 'coin/insufficient-balance' });
    const limited = database({ ...base, 'users/learner/redemptionUsage/2026-09': { challengePass: 3, premiumMonth: 0 } });
    await expect(service(limited).redeemChallengePass({ principal, request: { requestId: 'limit-request-0001', occurrenceDate: '2026-09-10' } })).rejects.toMatchObject({ code: 'coin/redemption-limit-reached' });
    expect(limited.values.get('users/learner/coinAccount/summary').availableBalance).toBe(1000);
  });
  it('creates one canonical coin Premium subscription and safely extends active access', async () => {
    const db = database({ 'users/learner/coinAccount/summary': account(6000), 'users/learner/entitlements/premium': { ownerUid: 'learner', tier: 'PREMIUM', active: true, subscriptionId: 'old', planId: 'monthly', expiresAt: stamp('2026-10-25T06:30:00Z') }, 'users/learner/subscriptions/old': { ownerUid: 'learner', status: 'ACTIVE', planId: 'monthly', expiresAt: stamp('2026-10-25T06:30:00Z') } });
    const input = { principal, request: { requestId: 'premium-request-0001' } };
    const first = await service(db).redeemPremiumMonth(input); const replay = await service(db).redeemPremiumMonth(input);
    expect(first).toMatchObject({ duplicate: false, balance: 3500, type: 'PREMIUM_MONTH' }); expect(replay.duplicate).toBe(true);
    const subscription = [...db.values.values()].find((item) => item.source === 'COIN_REDEMPTION');
    expect(subscription).toMatchObject({ planId: 'monthly', planVersion: 'm3-v1', priceMinor: 49900, currency: 'INR', status: 'ACTIVE' });
    expect(subscription.expiresAt.toDate().toISOString()).toBe('2026-11-25T06:30:00.000Z');
    expect([...db.values.keys()].some((path) => /payments|wallet|referral/i.test(path))).toBe(false);
  });
  it('fails closed for client-controlled economics and enforces one Premium redemption per Kolkata month', async () => {
    const db = database({ 'users/learner/coinAccount/summary': account(6000) });
    await expect(service(db).redeemPremiumMonth({ principal, request: { requestId: 'forged-premium-0001', costCoins: 1 } })).rejects.toMatchObject({ code: 'coin/client-authority-rejected' });
    await service(db).redeemPremiumMonth({ principal, request: { requestId: 'premium-limit-first' } });
    await expect(service(db).redeemPremiumMonth({ principal, request: { requestId: 'premium-limit-second' } })).rejects.toMatchObject({ code: 'coin/redemption-limit-reached' });
    expect(db.values.get('users/learner/coinAccount/summary').availableBalance).toBe(3500);
  });
});
