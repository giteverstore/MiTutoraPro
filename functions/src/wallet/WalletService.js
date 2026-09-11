import { createHash } from 'node:crypto';

const SCHEMA_VERSION = '1.0.0';
const CURRENCY = 'INR';
const SYNTHETIC_EVIDENCE = 'SYNTHETIC_REFERRAL_SETTLEMENT';
const IDENTIFIER = /^[A-Za-z0-9_.:-]{8,180}$/;
const SYNTHETIC_FIELDS = new Set(['trusted', 'evidenceType', 'settlementId', 'referralId']);
const PENDING_EVIDENCE = 'CAPTURED_PAYMENT_REFERRAL_PENDING';
const PENDING_FIELDS = new Set(['trusted', 'evidenceType', 'pendingId', 'referralId']);

function fail(code, message) { throw Object.assign(new Error(message), { code }); }
function data(snapshot) { return snapshot?.exists ? snapshot.data() : null; }
function positiveMinor(value) {
  if (!Number.isSafeInteger(value) || value <= 0) fail('wallet/invalid-amount', 'Wallet credits require positive integer paise.');
  return value;
}
function account(timestamp) {
  return { currency: CURRENCY, pendingBalanceMinor: 0, availableBalanceMinor: 0, reservedBalanceMinor: 0, outstandingReferralClawbackMinor: 0, lifetimeCreditedMinor: 0, createdAt: timestamp, updatedAt: timestamp, schemaVersion: SCHEMA_VERSION };
}
function validateAccount(value) {
  const normalized = { ...value, reservedBalanceMinor: value.reservedBalanceMinor ?? 0, outstandingReferralClawbackMinor: value.outstandingReferralClawbackMinor ?? 0 };
  if (normalized.currency !== CURRENCY || !['pendingBalanceMinor', 'availableBalanceMinor', 'reservedBalanceMinor', 'outstandingReferralClawbackMinor', 'lifetimeCreditedMinor'].every((field) => Number.isSafeInteger(normalized[field]) && normalized[field] >= 0)) {
    fail('wallet/data-integrity', 'Wallet account invariants failed.');
  }
  return normalized;
}
function digest(prefix, value) { return `${prefix}_${createHash('sha256').update(value).digest('hex')}`; }

export function reconcileWalletProjection(wallet, transactions, withdrawals = []) {
  const valid = validateAccount(wallet);
  const credits = transactions.filter((entry) => entry.type === 'REFERRAL_REWARD' && entry.balanceBucket === 'AVAILABLE');
  const directTotal = credits.reduce((sum, entry) => sum + positiveMinor(entry.amountMinor), 0);
  const pendingCredits = transactions.filter((entry) => entry.type === 'REFERRAL_REWARD_PENDING' && entry.balanceBucket === 'PENDING');
  const pendingReleased = transactions.filter((entry) => entry.type === 'REFERRAL_REWARD_AVAILABLE' && entry.fromBucket === 'PENDING');
  const pendingReversed = transactions.filter((entry) => entry.type === 'REFERRAL_REWARD_REVERSED' && entry.fromBucket === 'PENDING');
  const pendingAdjusted = transactions.filter((entry) => entry.type === 'REFERRAL_REWARD_ADJUSTED' && entry.fromBucket === 'PENDING');
  const clawbackRequired = transactions.filter((entry) => entry.type === 'REFERRAL_CLAWBACK_REQUIRED').reduce((sum, entry) => sum + positiveMinor(entry.amountMinor), 0);
  const clawbackOffset = transactions.filter((entry) => entry.type === 'REFERRAL_CLAWBACK_OFFSET').reduce((sum, entry) => sum + positiveMinor(entry.amountMinor), 0);
  const pendingCreditedTotal = pendingCredits.reduce((sum, entry) => sum + positiveMinor(entry.amountMinor), 0);
  const pendingReleasedTotal = pendingReleased.reduce((sum, entry) => sum + positiveMinor(entry.amountMinor), 0);
  const pendingReversedTotal = pendingReversed.reduce((sum, entry) => sum + positiveMinor(entry.amountMinor), 0);
  const pendingAdjustedTotal = pendingAdjusted.reduce((sum, entry) => sum + positiveMinor(entry.amountMinor), 0);
  const pendingTotal = pendingCreditedTotal - pendingReleasedTotal - pendingReversedTotal - pendingAdjustedTotal;
  const reserved = transactions.filter((entry) => entry.type === 'WITHDRAWAL_RESERVED').reduce((sum, entry) => sum + positiveMinor(entry.amountMinor), 0);
  const released = transactions.filter((entry) => entry.type === 'WITHDRAWAL_RELEASED').reduce((sum, entry) => sum + positiveMinor(entry.amountMinor), 0);
  const paid = transactions.filter((entry) => entry.type === 'WITHDRAWAL_PAID').reduce((sum, entry) => sum + positiveMinor(entry.amountMinor), 0);
  const reversed = transactions.filter((entry) => entry.type === 'WITHDRAWAL_REVERSED').reduce((sum, entry) => sum + positiveMinor(entry.amountMinor), 0);
  const expectedReserved = reserved - released - paid;
  const expectedAvailable = directTotal + pendingReleasedTotal - clawbackOffset - reserved + released + reversed;
  const lifetimeTotal = directTotal + pendingCreditedTotal - pendingReversedTotal - pendingAdjustedTotal;
  const expectedClawback = clawbackRequired - clawbackOffset;
  const pendingWithdrawals = withdrawals.filter((entry) => ['PENDING', 'INITIATION_PENDING', 'PROCESSING', 'UNKNOWN'].includes(entry.status)).reduce((sum, entry) => sum + positiveMinor(entry.amountMinor), 0);
  const withdrawalMatch = withdrawals.length === 0 || pendingWithdrawals === expectedReserved;
  return { reconciled: expectedReserved >= 0 && expectedAvailable >= 0 && pendingTotal >= 0 && expectedClawback >= 0 && valid.pendingBalanceMinor === pendingTotal && valid.availableBalanceMinor === expectedAvailable && valid.reservedBalanceMinor === expectedReserved && valid.outstandingReferralClawbackMinor === expectedClawback && valid.lifetimeCreditedMinor === lifetimeTotal && withdrawalMatch, pendingLedgerMinor: pendingTotal, availableLedgerMinor: expectedAvailable, reservedLedgerMinor: expectedReserved, outstandingClawbackLedgerMinor: expectedClawback, lifetimeLedgerMinor: lifetimeTotal, pendingBalanceMinor: valid.pendingBalanceMinor, availableBalanceMinor: valid.availableBalanceMinor, reservedBalanceMinor: valid.reservedBalanceMinor, outstandingReferralClawbackMinor: valid.outstandingReferralClawbackMinor, lifetimeCreditedMinor: valid.lifetimeCreditedMinor };
}

export class WalletService {
  constructor({ db, timestamp, allowSyntheticSettlement = false, environment = process.env }) {
    if (!db?.doc || !db?.runTransaction || !timestamp?.now) throw new TypeError('WalletService requires Firestore and a timestamp factory.');
    this.db = db;
    this.timestamp = timestamp;
    this.allowSyntheticSettlement = allowSyntheticSettlement
      && ['test', 'development'].includes(environment.NODE_ENV)
      && /^127\.0\.0\.1:\d+$/.test(environment.FIRESTORE_EMULATOR_HOST ?? '')
      && /^demo-/.test(environment.FIREBASE_PROJECT_ID ?? environment.GCLOUD_PROJECT ?? '');
  }

  async ensureAccount(uid) {
    if (!uid) fail('wallet/unauthenticated', 'Authentication is required.');
    const reference = this.db.doc(`users/${uid}/wallet/account`);
    return this.db.runTransaction(async (tx) => {
      const existing = data(await tx.get(reference));
      if (existing) return { ...validateAccount(existing), created: false };
      const created = account(this.timestamp.now());
      tx.create(reference, created);
      return { ...created, created: true };
    });
  }

  async settleSyntheticReferralReward(evidence) {
    if (!this.allowSyntheticSettlement) fail('wallet/synthetic-disabled', 'Synthetic settlement is unavailable outside the local test boundary.');
    if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence) || Object.keys(evidence).some((key) => !SYNTHETIC_FIELDS.has(key))) fail('wallet/client-authority-rejected', 'Settlement accepts only trusted source identities.');
    if (evidence?.evidenceType !== SYNTHETIC_EVIDENCE || evidence?.trusted !== true) fail('wallet/untrusted-settlement', 'Trusted synthetic settlement evidence is required.');
    return this.#settle(evidence);
  }

  async recordPendingReferralReward(evidence) {
    if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence) || Object.keys(evidence).some((key) => !PENDING_FIELDS.has(key))) fail('wallet/client-authority-rejected', 'Pending reward accepts only trusted source identities.');
    if (evidence.trusted !== true || evidence.evidenceType !== PENDING_EVIDENCE) fail('wallet/untrusted-pending-reward', 'Trusted captured-payment evidence is required.');
    if (!IDENTIFIER.test(evidence.pendingId ?? '') || !IDENTIFIER.test(evidence.referralId ?? '')) fail('wallet/invalid-pending-reward', 'Pending reward identity is invalid.');
    const idempotencyId = digest('wallet-pending-idem', evidence.pendingId);
    const transactionId = digest('wallet-pending', evidence.pendingId);
    return this.db.runTransaction(async (tx) => {
      const replayRef = this.db.doc(`walletSettlementIdempotency/${idempotencyId}`);
      const referralRef = this.db.doc(`referrals/${evidence.referralId}`);
      const replay = data(await tx.get(replayRef));
      const fingerprint = createHash('sha256').update([evidence.evidenceType, evidence.pendingId, evidence.referralId].join('\0')).digest('hex');
      if (replay) {
        if (replay.fingerprint !== fingerprint) fail('wallet/settlement-conflict', 'Pending reward identity conflicts with stored evidence.');
        return { ...replay.result, duplicate: true };
      }
      const referral = data(await tx.get(referralRef));
      if (!referral || referral.status !== 'QUALIFIED' || !referral.referrerUid) fail('wallet/referral-not-qualified', 'A qualified referral is required.');
      if (!['UNSETTLED', undefined].includes(referral.walletSettlementStatus)) fail('wallet/referral-already-settled', 'Referral reward already has financial state.');
      const amountMinor = positiveMinor(referral.calculatedRewardMinor);
      if (referral.currency !== CURRENCY) fail('wallet/currency-mismatch', 'Referral currency must be INR.');
      const walletRef = this.db.doc(`users/${referral.referrerUid}/wallet/account`);
      const ledgerRef = this.db.doc(`users/${referral.referrerUid}/walletTransactions/${transactionId}`);
      const timestamp = this.timestamp.now();
      const walletSnapshot = await tx.get(walletRef);
      const current = walletSnapshot.exists ? validateAccount(walletSnapshot.data()) : account(timestamp);
      if ((await tx.get(ledgerRef)).exists) fail('wallet/data-integrity', 'Pending ledger exists without idempotency state.');
      const next = validateAccount({ ...current, pendingBalanceMinor: current.pendingBalanceMinor + amountMinor, lifetimeCreditedMinor: current.lifetimeCreditedMinor + amountMinor, updatedAt: timestamp });
      const ledger = { transactionId, type: 'REFERRAL_REWARD_PENDING', amountMinor, currency: CURRENCY, balanceBucket: 'PENDING', sourceType: 'REFERRAL', sourceId: evidence.referralId, createdAt: timestamp, schemaVersion: SCHEMA_VERSION };
      const result = { transactionId, referralId: evidence.referralId, ownerUid: referral.referrerUid, amountMinor, currency: CURRENCY, balanceBucket: 'PENDING', pendingBalanceMinor: next.pendingBalanceMinor };
      tx.set(walletRef, next, { merge: false });
      tx.create(ledgerRef, ledger);
      tx.update(referralRef, { walletSettlementStatus: 'PENDING', walletTransactionId: transactionId, pendingRewardMinor: amountMinor, eligibleRewardMinor: amountMinor, pendingAt: timestamp });
      tx.create(replayRef, { fingerprint, referralId: evidence.referralId, result, createdAt: timestamp, schemaVersion: SCHEMA_VERSION });
      return { ...result, duplicate: false };
    });
  }

  async #settle(evidence) {
    if (!IDENTIFIER.test(evidence?.settlementId ?? '') || !IDENTIFIER.test(evidence?.referralId ?? '')) fail('wallet/invalid-settlement', 'Settlement identity is invalid.');
    const fingerprint = createHash('sha256').update([evidence.evidenceType, evidence.settlementId, evidence.referralId].join('\0')).digest('hex');
    const idempotencyId = digest('wallet-idem', evidence.settlementId);
    const transactionId = digest('wallet', evidence.settlementId);
    return this.db.runTransaction(async (tx) => {
      const replayRef = this.db.doc(`walletSettlementIdempotency/${idempotencyId}`);
      const referralRef = this.db.doc(`referrals/${evidence.referralId}`);
      const replay = data(await tx.get(replayRef));
      if (replay) {
        if (replay.fingerprint !== fingerprint || replay.referralId !== evidence.referralId) fail('wallet/settlement-conflict', 'Settlement identity is bound to different evidence.');
        return { ...replay.result, duplicate: true };
      }
      const referral = data(await tx.get(referralRef));
      if (!referral || referral.status !== 'QUALIFIED') fail('wallet/referral-not-qualified', 'A qualified referral is required.');
      if (!referral.referrerUid) fail('wallet/data-integrity', 'Referral owner is missing.');
      const amountMinor = positiveMinor(referral.calculatedRewardMinor);
      if (referral.currency !== CURRENCY) fail('wallet/currency-mismatch', 'Referral currency must be INR.');
      if (referral.walletSettlementStatus === 'SETTLED') fail('wallet/referral-already-settled', 'Referral reward is already settled.');

      const walletRef = this.db.doc(`users/${referral.referrerUid}/wallet/account`);
      const ledgerRef = this.db.doc(`users/${referral.referrerUid}/walletTransactions/${transactionId}`);
      const walletSnapshot = await tx.get(walletRef);
      if ((await tx.get(ledgerRef)).exists) fail('wallet/data-integrity', 'Ledger entry exists without idempotency state.');
      const timestamp = this.timestamp.now();
      const current = walletSnapshot.exists ? validateAccount(walletSnapshot.data()) : account(timestamp);
      const releasesPending = referral.walletSettlementStatus === 'PENDING';
      if (releasesPending && current.pendingBalanceMinor < amountMinor) fail('wallet/data-integrity', 'Pending wallet balance is insufficient.');
      const next = validateAccount({
        ...current,
        pendingBalanceMinor: current.pendingBalanceMinor - (releasesPending ? amountMinor : 0),
        availableBalanceMinor: current.availableBalanceMinor + amountMinor,
        lifetimeCreditedMinor: current.lifetimeCreditedMinor + (releasesPending ? 0 : amountMinor),
        updatedAt: timestamp,
      });
      const ledger = { transactionId, type: releasesPending ? 'REFERRAL_REWARD_AVAILABLE' : 'REFERRAL_REWARD', amountMinor, currency: CURRENCY, balanceBucket: 'AVAILABLE', ...(releasesPending ? { fromBucket: 'PENDING' } : {}), sourceType: 'REFERRAL', sourceId: evidence.referralId, idempotencyKey: idempotencyId, createdAt: timestamp, schemaVersion: SCHEMA_VERSION };
      const result = { transactionId, referralId: evidence.referralId, ownerUid: referral.referrerUid, amountMinor, currency: CURRENCY, balanceBucket: 'AVAILABLE', availableBalanceMinor: next.availableBalanceMinor, lifetimeCreditedMinor: next.lifetimeCreditedMinor };
      tx.set(walletRef, next, { merge: false });
      tx.create(ledgerRef, ledger);
      tx.update(referralRef, { walletSettlementStatus: 'SETTLED', walletTransactionId: transactionId, settledAt: timestamp });
      tx.create(replayRef, { settlementId: evidence.settlementId, referralId: evidence.referralId, fingerprint, transactionId, result, createdAt: timestamp, schemaVersion: SCHEMA_VERSION });
      return { ...result, duplicate: false };
    });
  }
}

export const WALLET_CONSTANTS = Object.freeze({ currency: CURRENCY, schemaVersion: SCHEMA_VERSION, syntheticEvidenceType: SYNTHETIC_EVIDENCE, pendingEvidenceType: PENDING_EVIDENCE });
