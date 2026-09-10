import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { reconcileWalletProjection, WalletService, WALLET_CONSTANTS } from '../../functions/src/wallet/WalletService.js';

const stamp = () => ({ seconds: 1 });
function database(seed = {}) {
  const values = new Map(Object.entries(seed));
  const snapshot = (path) => ({ exists: values.has(path), data: () => values.get(path) });
  return {
    values,
    doc: (path) => ({ path }),
    runTransaction: async (callback) => callback({
      get: async ({ path }) => snapshot(path),
      create: ({ path }, value) => { if (values.has(path)) throw Object.assign(new Error('exists'), { code: 'already-exists' }); values.set(path, value); },
      set: ({ path }, value) => values.set(path, value),
      update: ({ path }, patch) => values.set(path, { ...values.get(path), ...patch }),
    }),
  };
}
const qualified = (ownerUid = 'owner', amount = 4990) => ({ referralId: 'referral-one', referrerUid: ownerUid, referredUid: 'buyer', status: 'QUALIFIED', calculatedRewardMinor: amount, currency: 'INR' });
const evidence = (overrides = {}) => ({ trusted: true, evidenceType: 'SYNTHETIC_REFERRAL_SETTLEMENT', settlementId: 'settlement-0001', referralId: 'referral-one', ...overrides });
const safeEnvironment = { NODE_ENV: 'test', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_PROJECT_ID: 'demo-wallet' };
const service = (db, allow = true, environment = safeEnvironment) => new WalletService({ db, timestamp: { now: stamp }, allowSyntheticSettlement: allow, environment });

describe('M6.1 wallet foundation', () => {
  it('defines INR integer-paise wallet accounts with zero pending and available balances', async () => {
    const db = database();
    expect(await service(db).ensureAccount('owner')).toMatchObject({ currency: 'INR', pendingBalanceMinor: 0, availableBalanceMinor: 0, lifetimeCreditedMinor: 0, created: true });
    expect(await service(db).ensureAccount('owner')).toMatchObject({ created: false });
    expect(WALLET_CONSTANTS.currency).toBe('INR');
  });

  it('does not credit merely because an M5 referral is qualified', async () => {
    const db = database({ 'referrals/referral-one': qualified() });
    expect([...db.values.keys()].some((path) => path.includes('/wallet'))).toBe(false);
    expect([...db.values.keys()].some((path) => path.includes('walletTransactions'))).toBe(false);
  });

  it.each([[4990], [7485]])('settles an authoritative referral amount of %i paise directly to AVAILABLE', async (amount) => {
    const db = database({ 'referrals/referral-one': qualified('owner', amount) });
    const result = await service(db).settleSyntheticReferralReward(evidence());
    expect(result).toMatchObject({ duplicate: false, ownerUid: 'owner', amountMinor: amount, availableBalanceMinor: amount, lifetimeCreditedMinor: amount });
    expect(db.values.get('users/owner/wallet/account')).toMatchObject({ currency: 'INR', pendingBalanceMinor: 0, availableBalanceMinor: amount, lifetimeCreditedMinor: amount });
    expect([...db.values.values()].find((value) => value.type === 'REFERRAL_REWARD')).toMatchObject({ amountMinor: amount, balanceBucket: 'AVAILABLE', sourceType: 'REFERRAL', sourceId: 'referral-one' });
    expect(db.values.get('referrals/referral-one')).toMatchObject({ status: 'QUALIFIED', walletSettlementStatus: 'SETTLED' });
  });

  it('is idempotent and returns the original authoritative result', async () => {
    const db = database({ 'referrals/referral-one': qualified() });
    const wallet = service(db);
    const first = await wallet.settleSyntheticReferralReward(evidence());
    const replay = await wallet.settleSyntheticReferralReward(evidence());
    expect(replay).toMatchObject({ duplicate: true, transactionId: first.transactionId, amountMinor: 4990, availableBalanceMinor: 4990 });
    expect([...db.values.values()].filter((value) => value.type === 'REFERRAL_REWARD')).toHaveLength(1);
  });

  it('fails closed on conflicting settlement identity and already-settled referrals', async () => {
    const db = database({ 'referrals/referral-one': qualified(), 'referrals/referral-two': { ...qualified(), referralId: 'referral-two', referredUid: 'buyer-two' } });
    const wallet = service(db);
    await wallet.settleSyntheticReferralReward(evidence());
    await expect(wallet.settleSyntheticReferralReward(evidence({ referralId: 'referral-two' }))).rejects.toMatchObject({ code: 'wallet/settlement-conflict' });
    await expect(wallet.settleSyntheticReferralReward(evidence({ settlementId: 'settlement-0002' }))).rejects.toMatchObject({ code: 'wallet/referral-already-settled' });
    expect(db.values.get('users/owner/wallet/account').availableBalanceMinor).toBe(4990);
  });

  it('accumulates independent referrals and reconciles projection to immutable credits', async () => {
    const db = database({
      'referrals/referral-one': qualified('owner', 4990),
      'referrals/referral-two': { ...qualified('owner', 9990), referralId: 'referral-two' },
      'referrals/referral-three': { ...qualified('owner', 14990), referralId: 'referral-three' },
    });
    const wallet = service(db);
    await wallet.settleSyntheticReferralReward(evidence());
    await wallet.settleSyntheticReferralReward(evidence({ settlementId: 'settlement-0002', referralId: 'referral-two' }));
    await wallet.settleSyntheticReferralReward(evidence({ settlementId: 'settlement-0003', referralId: 'referral-three' }));
    const account = db.values.get('users/owner/wallet/account');
    const ledger = [...db.values.values()].filter((value) => value.type === 'REFERRAL_REWARD');
    expect(account.availableBalanceMinor).toBe(29970);
    expect(reconcileWalletProjection(account, ledger)).toMatchObject({ reconciled: true, availableLedgerMinor: 29970 });
    expect(reconcileWalletProjection({ ...account, availableBalanceMinor: 1 }, ledger).reconciled).toBe(false);
  });

  it('rejects amount/currency integrity failures and exposes no client-selected amount or owner', async () => {
    for (const amount of [0, -1, 1.5, Number.NaN]) {
      const badAmount = database({ 'referrals/referral-one': qualified('owner', amount) });
      await expect(service(badAmount).settleSyntheticReferralReward(evidence())).rejects.toMatchObject({ code: 'wallet/invalid-amount' });
      expect([...badAmount.values.keys()].some((path) => path.includes('/wallet/'))).toBe(false);
    }
    await expect(service(database({ 'referrals/referral-one': qualified() })).settleSyntheticReferralReward({ ...evidence(), amountMinor: 10000000, ownerUid: 'attacker', currency: 'USD', balanceBucket: 'PENDING', sourceId: 'other' })).rejects.toMatchObject({ code: 'wallet/client-authority-rejected' });
    const badCurrency = database({ 'referrals/referral-one': { ...qualified(), currency: 'USD' } });
    await expect(service(badCurrency).settleSyntheticReferralReward(evidence())).rejects.toMatchObject({ code: 'wallet/currency-mismatch' });
    await expect(service(database()).settleSyntheticReferralReward(evidence({ referralId: '../bad' }))).rejects.toMatchObject({ code: 'wallet/invalid-settlement' });
    await expect(service(database()).settleSyntheticReferralReward(evidence({ trusted: false }))).rejects.toMatchObject({ code: 'wallet/untrusted-settlement' });
  });

  it('keeps the synthetic settlement seam disabled unless explicitly injected', async () => {
    const db = database({ 'referrals/referral-one': qualified() });
    await expect(service(db, false).settleSyntheticReferralReward(evidence())).rejects.toMatchObject({ code: 'wallet/synthetic-disabled' });
    await expect(service(db, true, { NODE_ENV: 'production', FIRESTORE_EMULATOR_HOST: '', FIREBASE_PROJECT_ID: 'mi-tutora-pro' }).settleSyntheticReferralReward(evidence())).rejects.toMatchObject({ code: 'wallet/synthetic-disabled' });
    expect(readFileSync('functions/src/index.js', 'utf8')).not.toMatch(/export const (?:settle|credit).*Wallet/i);
  });

  it('keeps coins and development grants outside the wallet domain', async () => {
    const db = database({
      'users/owner/coinAccount/summary': { availableBalance: 999999 },
      'users/owner/entitlements/premium': { source: 'DEVELOPMENT_GRANT', tier: 'PREMIUM' },
    });
    await service(db).ensureAccount('owner');
    expect(db.values.get('users/owner/wallet/account')).toMatchObject({ availableBalanceMinor: 0, lifetimeCreditedMinor: 0 });
    expect(db.values.get('users/owner/coinAccount/summary').availableBalance).toBe(999999);
  });
});
