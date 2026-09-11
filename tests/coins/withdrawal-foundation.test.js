import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { reconcileWalletProjection } from '../../functions/src/wallet/WalletService.js';
import { WITHDRAWAL_POLICY } from '../../functions/src/withdrawals/WithdrawalPolicy.js';
import { WithdrawalService } from '../../functions/src/withdrawals/WithdrawalService.js';

const stamp = () => ({ seconds: 1 });
const safeEnvironment = { NODE_ENV: 'test', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_PROJECT_ID: 'demo-withdrawals' };
function account(available = 0, reserved) { return { currency: 'INR', pendingBalanceMinor: 0, availableBalanceMinor: available, ...(reserved === undefined ? {} : { reservedBalanceMinor: reserved }), lifetimeCreditedMinor: available + (reserved ?? 0), createdAt: stamp(), updatedAt: stamp(), schemaVersion: '1.0.0' }; }
function database(seed = {}) {
  const values = new Map(Object.entries(seed));
  const snapshot = (path) => ({ exists: values.has(path), data: () => values.get(path) });
  return { values, doc: (path) => ({ path }), runTransaction: async (callback) => callback({ get: async ({ path }) => snapshot(path), create: ({ path }, value) => { if (values.has(path)) throw new Error('exists'); values.set(path, value); }, set: ({ path }, value) => values.set(path, value), update: ({ path }, patch) => values.set(path, { ...values.get(path), ...patch }) }) };
}
const service = (db, options = {}) => new WithdrawalService({ db, timestamp: { now: stamp }, allowWithdrawalRequests: true, allowSyntheticTransitions: true, environment: safeEnvironment, ...options });
const request = (amountMinor = 50_000, requestId = 'request-0001') => ({ principal: { uid: 'owner' }, request: { amountMinor, requestId } });
const transition = (withdrawalId, evidenceType, transitionId = 'transition-0001') => ({ trusted: true, evidenceType, transitionId, withdrawalId });
const ledgers = (db) => [...db.values.values()].filter((value) => /^WITHDRAWAL_|REFERRAL_REWARD/.test(value.type ?? ''));
const withdrawals = (db) => [...db.values.values()].filter((value) => value.withdrawalId && value.status);

describe('M7.1 withdrawal policy and reservation', () => {
  it('pins one INR policy at exactly 50,000 paise', () => expect(WITHDRAWAL_POLICY).toEqual({ policyVersion: 'm7-v1', currency: 'INR', minimumWithdrawalMinor: 50000, enabled: true, requestStatus: 'PENDING' }));

  it.each([[-1], [0], [49_999], [49_999.5], [Number.NaN]])('rejects invalid/below-minimum amount %s without writes', async (value) => {
    const db = database({ 'users/owner/wallet/account': account(100_000) });
    await expect(service(db).requestWithdrawal(request(value))).rejects.toMatchObject({ code: 'withdrawal/below-minimum' });
    expect(withdrawals(db)).toHaveLength(0); expect(ledgers(db)).toHaveLength(0);
  });

  it.each([[50_000, 50_000, 50_000], [50_001, 49_999, 50_001]])('accepts %i and atomically reserves it', async (amountMinor, available, reserved) => {
    const db = database({ 'users/owner/wallet/account': account(100_000) });
    const result = await service(db).requestWithdrawal(request(amountMinor));
    expect(result).toMatchObject({ status: 'PENDING', amountMinor, availableBalanceMinor: available, reservedBalanceMinor: reserved, duplicate: false });
    expect(withdrawals(db)).toHaveLength(1);
    expect(ledgers(db).find(({ type }) => type === 'WITHDRAWAL_RESERVED')).toMatchObject({ amountMinor, fromBucket: 'AVAILABLE', balanceBucket: 'RESERVED' });
  });

  it('accepts exact balance and rejects insufficient balances without partial reservation', async () => {
    const exact = database({ 'users/owner/wallet/account': account(50_000) });
    expect(await service(exact).requestWithdrawal(request())).toMatchObject({ availableBalanceMinor: 0, reservedBalanceMinor: 50_000 });
    for (const [available, requested] of [[49_999, 50_000], [60_000, 70_000]]) {
      const db = database({ 'users/owner/wallet/account': account(available) });
      await expect(service(db).requestWithdrawal(request(requested))).rejects.toMatchObject({ code: 'withdrawal/insufficient-balance' });
      expect(db.values.get('users/owner/wallet/account')).toMatchObject({ availableBalanceMinor: available });
      expect(withdrawals(db)).toHaveLength(0);
    }
  });

  it('defaults legacy reservedBalanceMinor to zero without destructive migration', async () => {
    const db = database({ 'users/owner/wallet/account': account(100_000) });
    delete db.values.get('users/owner/wallet/account').reservedBalanceMinor;
    expect(await service(db).requestWithdrawal(request())).toMatchObject({ availableBalanceMinor: 50_000, reservedBalanceMinor: 50_000 });
  });

  it('replays idempotently and rejects request identity conflicts', async () => {
    const db = database({ 'users/owner/wallet/account': account(100_000) }); const withdrawalsService = service(db);
    const first = await withdrawalsService.requestWithdrawal(request());
    expect(await withdrawalsService.requestWithdrawal(request())).toMatchObject({ duplicate: true, withdrawalId: first.withdrawalId, availableBalanceMinor: 50_000 });
    await expect(withdrawalsService.requestWithdrawal(request(60_000))).rejects.toMatchObject({ code: 'withdrawal/request-conflict' });
    await expect(withdrawalsService.requestWithdrawal({ principal: { uid: 'other' }, request: { amountMinor: 50_000, requestId: 'request-0001' } })).rejects.toMatchObject({ code: 'withdrawal/request-conflict' });
    expect(ledgers(db).filter(({ type }) => type === 'WITHDRAWAL_RESERVED')).toHaveLength(1);
  });

  it('strictly rejects client authority fields and production activation', async () => {
    const db = database({ 'users/owner/wallet/account': account(100_000) });
    await expect(service(db).requestWithdrawal({ principal: { uid: 'owner' }, request: { amountMinor: 50_000, requestId: 'request-0001', status: 'PAID', ownerUid: 'other', currency: 'USD', minimum: 1 } })).rejects.toMatchObject({ code: 'withdrawal/client-authority-rejected' });
    const production = service(db, { environment: { NODE_ENV: 'production', FIREBASE_PROJECT_ID: 'mi-tutora-pro' } });
    await expect(production.requestWithdrawal(request())).rejects.toMatchObject({ code: 'withdrawal/requests-disabled' });
    expect(readFileSync('functions/src/index.js', 'utf8')).not.toMatch(/export const (?:requestWithdrawal|transitionWithdrawal)/);
  });

  it('reserves multiple withdrawals only from remaining AVAILABLE INR', async () => {
    const db = database({ 'users/owner/wallet/account': account(150_000) }); const withdrawalsService = service(db);
    await withdrawalsService.requestWithdrawal(request(50_000, 'request-multiple-001'));
    await withdrawalsService.requestWithdrawal(request(70_000, 'request-multiple-002'));
    await expect(withdrawalsService.requestWithdrawal(request(50_000, 'request-multiple-003'))).rejects.toMatchObject({ code: 'withdrawal/insufficient-balance' });
    expect(db.values.get('users/owner/wallet/account')).toMatchObject({ availableBalanceMinor: 30_000, reservedBalanceMinor: 120_000 });
    expect(withdrawals(db)).toHaveLength(2);
  });

  it('does not treat coins, calculated rewards, qualification, or development grants as AVAILABLE INR', async () => {
    const db = database({
      'users/owner/wallet/account': account(0),
      'users/owner/coinAccount/summary': { availableBalance: 100_000 },
      'users/owner/entitlements/premium': { source: 'DEVELOPMENT_GRANT', active: true },
      'referrals/referral-one': { status: 'QUALIFIED', calculatedRewardMinor: 100_000, walletSettlementStatus: 'UNSETTLED' },
    });
    await expect(service(db).requestWithdrawal(request())).rejects.toMatchObject({ code: 'withdrawal/insufficient-balance' });
    expect(withdrawals(db)).toHaveLength(0);
  });

  it('does not allow an outstanding referral clawback to be withdrawn', async () => {
    const db = database({ 'users/owner/wallet/account': { ...account(100_000), outstandingReferralClawbackMinor: 60_000 } });
    await expect(service(db).requestWithdrawal(request(50_000))).rejects.toMatchObject({ code: 'withdrawal/insufficient-balance' });
    expect(withdrawals(db)).toHaveLength(0);
  });
});

describe('M7.1 terminal transitions', () => {
  async function pending(available = 100_000) { const db = database({ 'users/owner/wallet/account': account(available) }); const withdrawalsService = service(db); const created = await withdrawalsService.requestWithdrawal(request()); return { db, withdrawalsService, created }; }
  it.each([['SYNTHETIC_WITHDRAWAL_FAILED', 'FAILED'], ['SYNTHETIC_WITHDRAWAL_CANCELLED', 'CANCELLED']])('%s releases reserved funds exactly once', async (evidenceType, status) => {
    const { db, withdrawalsService, created } = await pending();
    const first = await withdrawalsService.transitionSynthetic(transition(created.withdrawalId, evidenceType));
    expect(first).toMatchObject({ status, availableBalanceMinor: 100_000, reservedBalanceMinor: 0, duplicate: false });
    expect(await withdrawalsService.transitionSynthetic(transition(created.withdrawalId, evidenceType))).toMatchObject({ status, duplicate: true });
    expect(ledgers(db).filter(({ type }) => type === 'WITHDRAWAL_RELEASED')).toHaveLength(1);
  });

  it('synthetic PAID consumes reserved funds without returning them', async () => {
    const { db, withdrawalsService, created } = await pending();
    const first = await withdrawalsService.transitionSynthetic(transition(created.withdrawalId, 'SYNTHETIC_WITHDRAWAL_PAID'));
    expect(first).toMatchObject({ status: 'PAID', availableBalanceMinor: 50_000, reservedBalanceMinor: 0 });
    expect(await withdrawalsService.transitionSynthetic(transition(created.withdrawalId, 'SYNTHETIC_WITHDRAWAL_PAID'))).toMatchObject({ duplicate: true, status: 'PAID' });
    expect(ledgers(db).find(({ type }) => type === 'WITHDRAWAL_PAID')).toBeTruthy();
  });

  it('rejects terminal-to-terminal transitions and conflicting transition identities', async () => {
    const { db, withdrawalsService, created } = await pending();
    await withdrawalsService.transitionSynthetic(transition(created.withdrawalId, 'SYNTHETIC_WITHDRAWAL_FAILED'));
    await expect(withdrawalsService.transitionSynthetic(transition(created.withdrawalId, 'SYNTHETIC_WITHDRAWAL_PAID', 'transition-0002'))).rejects.toMatchObject({ code: 'withdrawal/invalid-state' });
    await expect(withdrawalsService.transitionSynthetic(transition('withdrawal-other', 'SYNTHETIC_WITHDRAWAL_FAILED'))).rejects.toMatchObject({ code: 'withdrawal/transition-conflict' });
    expect(db.values.get('users/owner/wallet/account')).toMatchObject({ availableBalanceMinor: 100_000, reservedBalanceMinor: 0 });
  });

  it.each([
    ['SYNTHETIC_WITHDRAWAL_PAID', 'SYNTHETIC_WITHDRAWAL_FAILED'],
    ['SYNTHETIC_WITHDRAWAL_PAID', 'SYNTHETIC_WITHDRAWAL_CANCELLED'],
    ['SYNTHETIC_WITHDRAWAL_FAILED', 'SYNTHETIC_WITHDRAWAL_PAID'],
    ['SYNTHETIC_WITHDRAWAL_FAILED', 'SYNTHETIC_WITHDRAWAL_CANCELLED'],
    ['SYNTHETIC_WITHDRAWAL_CANCELLED', 'SYNTHETIC_WITHDRAWAL_PAID'],
    ['SYNTHETIC_WITHDRAWAL_CANCELLED', 'SYNTHETIC_WITHDRAWAL_FAILED'],
  ])('rejects terminal transition %s -> %s', async (firstType, secondType) => {
    const { withdrawalsService, created } = await pending();
    await withdrawalsService.transitionSynthetic(transition(created.withdrawalId, firstType));
    await expect(withdrawalsService.transitionSynthetic(transition(created.withdrawalId, secondType, 'transition-conflict-002'))).rejects.toMatchObject({ code: 'withdrawal/invalid-state' });
  });

  it('fails closed outside the explicit emulator boundary', async () => {
    const { db, created } = await pending();
    const production = service(db, { environment: { NODE_ENV: 'production', FIREBASE_PROJECT_ID: 'mi-tutora-pro' } });
    await expect(production.transitionSynthetic(transition(created.withdrawalId, 'SYNTHETIC_WITHDRAWAL_PAID'))).rejects.toMatchObject({ code: 'withdrawal/synthetic-disabled' });
  });

  it('reconciles reservation, release and paid movements and detects mismatches', async () => {
    const db = database({ 'users/owner/wallet/account': account(100_000), 'users/owner/walletTransactions/credit': { type: 'REFERRAL_REWARD', amountMinor: 100_000, balanceBucket: 'AVAILABLE' } });
    const withdrawalsService = service(db); const created = await withdrawalsService.requestWithdrawal(request());
    const pendingResult = reconcileWalletProjection(db.values.get('users/owner/wallet/account'), ledgers(db), withdrawals(db));
    expect(pendingResult).toMatchObject({ reconciled: true, availableLedgerMinor: 50_000, reservedLedgerMinor: 50_000 });
    const tampered = { ...db.values.get('users/owner/wallet/account'), reservedBalanceMinor: 1 };
    expect(reconcileWalletProjection(tampered, ledgers(db), withdrawals(db)).reconciled).toBe(false);
    await withdrawalsService.transitionSynthetic(transition(created.withdrawalId, 'SYNTHETIC_WITHDRAWAL_PAID'));
    expect(reconcileWalletProjection(db.values.get('users/owner/wallet/account'), ledgers(db), withdrawals(db)).reconciled).toBe(true);
  });

  it.each([
    ['SYNTHETIC_WITHDRAWAL_FAILED', 'FAILED', 100_000],
    ['SYNTHETIC_WITHDRAWAL_CANCELLED', 'CANCELLED', 100_000],
    ['SYNTHETIC_WITHDRAWAL_PAID', 'PAID', 50_000],
  ])('reconciles the %s terminal state and preserves value conservation', async (evidenceType, status, finalTotal) => {
    const db = database({ 'users/owner/wallet/account': account(100_000), 'users/owner/walletTransactions/credit': { type: 'REFERRAL_REWARD', amountMinor: 100_000, balanceBucket: 'AVAILABLE' } });
    const withdrawalsService = service(db);
    const created = await withdrawalsService.requestWithdrawal(request());
    const before = db.values.get('users/owner/wallet/account');
    expect(before.availableBalanceMinor + before.reservedBalanceMinor).toBe(100_000);
    await withdrawalsService.transitionSynthetic(transition(created.withdrawalId, evidenceType));
    const after = db.values.get('users/owner/wallet/account');
    expect(after.availableBalanceMinor + after.reservedBalanceMinor).toBe(finalTotal);
    expect(withdrawals(db)).toEqual(expect.arrayContaining([expect.objectContaining({ status })]));
    expect(reconcileWalletProjection(after, ledgers(db), withdrawals(db)).reconciled).toBe(true);
  });

  it('detects pending-without-reservation and reservation-without-pending-withdrawal mismatches', () => {
    const credit = { type: 'REFERRAL_REWARD', amountMinor: 100_000, balanceBucket: 'AVAILABLE' };
    const reservation = { type: 'WITHDRAWAL_RESERVED', amountMinor: 50_000 };
    expect(reconcileWalletProjection(account(100_000, 0), [credit], [{ status: 'PENDING', amountMinor: 50_000 }]).reconciled).toBe(false);
    expect(reconcileWalletProjection(account(50_000, 50_000), [credit, reservation], [{ status: 'FAILED', amountMinor: 50_000 }]).reconciled).toBe(false);
  });
});
