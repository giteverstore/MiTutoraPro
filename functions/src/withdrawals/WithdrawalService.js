import { createHash } from 'node:crypto';
import { WITHDRAWAL_POLICY } from './WithdrawalPolicy.js';

const SCHEMA_VERSION = '1.0.0';
const IDENTIFIER = /^[A-Za-z0-9_.:-]{8,180}$/;
const REQUEST_FIELDS = new Set(['amountMinor', 'requestId']);
const TRANSITION_FIELDS = new Set(['trusted', 'evidenceType', 'transitionId', 'withdrawalId']);
const TRANSITIONS = Object.freeze({
  SYNTHETIC_WITHDRAWAL_FAILED: 'FAILED',
  SYNTHETIC_WITHDRAWAL_CANCELLED: 'CANCELLED',
  SYNTHETIC_WITHDRAWAL_PAID: 'PAID',
});
function fail(code, message) { throw Object.assign(new Error(message), { code }); }
function data(snapshot) { return snapshot?.exists ? snapshot.data() : null; }
function digest(prefix, value) { return `${prefix}_${createHash('sha256').update(value).digest('hex')}`; }
function safeBoundary(enabled, environment) {
  return enabled && ['test', 'development'].includes(environment.NODE_ENV)
    && /^127\.0\.0\.1:\d+$/.test(environment.FIRESTORE_EMULATOR_HOST ?? '')
    && /^demo-/.test(environment.FIREBASE_PROJECT_ID ?? environment.GCLOUD_PROJECT ?? '');
}
function amount(value, policy) {
  if (!Number.isSafeInteger(value) || value < policy.minimumWithdrawalMinor) fail('withdrawal/below-minimum', `Minimum withdrawal is ${policy.minimumWithdrawalMinor} paise.`);
  return value;
}
function wallet(value, timestamp) {
  const normalized = value ?? { currency: 'INR', pendingBalanceMinor: 0, availableBalanceMinor: 0, lifetimeCreditedMinor: 0, createdAt: timestamp, updatedAt: timestamp, schemaVersion: SCHEMA_VERSION };
  const result = { ...normalized, reservedBalanceMinor: normalized.reservedBalanceMinor ?? 0 };
  if (result.currency !== 'INR' || !['pendingBalanceMinor', 'availableBalanceMinor', 'reservedBalanceMinor', 'lifetimeCreditedMinor'].every((field) => Number.isSafeInteger(result[field]) && result[field] >= 0)) fail('withdrawal/wallet-integrity', 'Wallet projection is invalid.');
  return result;
}

export class WithdrawalService {
  constructor({ db, timestamp, policy = WITHDRAWAL_POLICY, allowWithdrawalRequests = false, allowSyntheticTransitions = false, environment = process.env }) {
    if (!db?.doc || !db?.runTransaction || !timestamp?.now) throw new TypeError('WithdrawalService requires Firestore and a timestamp factory.');
    this.db = db; this.timestamp = timestamp; this.policy = policy;
    this.allowWithdrawalRequests = safeBoundary(allowWithdrawalRequests, environment);
    this.allowSyntheticTransitions = safeBoundary(allowSyntheticTransitions, environment);
  }

  async requestWithdrawal({ principal, request }) {
    if (!this.allowWithdrawalRequests) fail('withdrawal/requests-disabled', 'Withdrawals are coming soon.');
    const uid = principal?.uid;
    if (!uid) fail('withdrawal/unauthenticated', 'Authentication is required.');
    if (!request || typeof request !== 'object' || Array.isArray(request) || Object.keys(request).some((key) => !REQUEST_FIELDS.has(key))) fail('withdrawal/client-authority-rejected', 'Only amountMinor and requestId may be submitted.');
    if (!this.policy.enabled || this.policy.currency !== 'INR' || this.policy.requestStatus !== 'PENDING') fail('withdrawal/policy-disabled', 'Withdrawal policy is unavailable.');
    const requestedMinor = amount(request.amountMinor, this.policy);
    if (!IDENTIFIER.test(request.requestId ?? '')) fail('withdrawal/invalid-request', 'Request identity is invalid.');
    const fingerprint = createHash('sha256').update([uid, String(requestedMinor), this.policy.currency, this.policy.policyVersion].join('\0')).digest('hex');
    const withdrawalId = digest('withdrawal', request.requestId);
    const replayRef = this.db.doc(`withdrawalIdempotency/${digest('withdrawal-idem', request.requestId)}`);
    const walletRef = this.db.doc(`users/${uid}/wallet/account`);
    const withdrawalRef = this.db.doc(`users/${uid}/withdrawals/${withdrawalId}`);
    const ledgerRef = this.db.doc(`users/${uid}/walletTransactions/${digest('wallet-reserve', request.requestId)}`);
    const lookupRef = this.db.doc(`withdrawalLookup/${withdrawalId}`);
    return this.db.runTransaction(async (tx) => {
      const replay = data(await tx.get(replayRef));
      if (replay) {
        if (replay.ownerUid !== uid || replay.fingerprint !== fingerprint) fail('withdrawal/request-conflict', 'Request identity is bound to different withdrawal evidence.');
        return { ...replay.result, duplicate: true };
      }
      const timestamp = this.timestamp.now();
      const current = wallet(data(await tx.get(walletRef)), timestamp);
      if ((await tx.get(withdrawalRef)).exists || (await tx.get(ledgerRef)).exists || (await tx.get(lookupRef)).exists) fail('withdrawal/data-integrity', 'Withdrawal state exists without idempotency protection.');
      if (current.availableBalanceMinor < requestedMinor) fail('withdrawal/insufficient-balance', 'Available wallet balance is insufficient.');
      const next = wallet({ ...current, availableBalanceMinor: current.availableBalanceMinor - requestedMinor, reservedBalanceMinor: current.reservedBalanceMinor + requestedMinor, updatedAt: timestamp }, timestamp);
      const withdrawal = { withdrawalId, ownerUid: uid, amountMinor: requestedMinor, currency: 'INR', status: 'PENDING', policyVersion: this.policy.policyVersion, requestId: request.requestId, requestedAt: timestamp, updatedAt: timestamp, completedAt: null, schemaVersion: SCHEMA_VERSION };
      const ledger = { transactionId: ledgerRef.path.split('/').at(-1), type: 'WITHDRAWAL_RESERVED', amountMinor: requestedMinor, currency: 'INR', sourceType: 'WITHDRAWAL', sourceId: withdrawalId, fromBucket: 'AVAILABLE', balanceBucket: 'RESERVED', createdAt: timestamp, schemaVersion: SCHEMA_VERSION };
      const result = { withdrawalId, ownerUid: uid, amountMinor: requestedMinor, currency: 'INR', status: 'PENDING', availableBalanceMinor: next.availableBalanceMinor, reservedBalanceMinor: next.reservedBalanceMinor };
      tx.set(walletRef, next, { merge: false }); tx.create(withdrawalRef, withdrawal); tx.create(ledgerRef, ledger);
      tx.create(lookupRef, { withdrawalId, ownerUid: uid, createdAt: timestamp, schemaVersion: SCHEMA_VERSION });
      tx.create(replayRef, { ownerUid: uid, fingerprint, withdrawalId, result, createdAt: timestamp, schemaVersion: SCHEMA_VERSION });
      return { ...result, duplicate: false };
    });
  }

  async transitionSynthetic(evidence) {
    if (!this.allowSyntheticTransitions) fail('withdrawal/synthetic-disabled', 'Synthetic withdrawal transitions are unavailable.');
    if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence) || Object.keys(evidence).some((key) => !TRANSITION_FIELDS.has(key))) fail('withdrawal/client-authority-rejected', 'Transition accepts only trusted source identities.');
    const status = TRANSITIONS[evidence.evidenceType];
    if (evidence.trusted !== true || !status) fail('withdrawal/untrusted-transition', 'Trusted transition evidence is required.');
    if (!IDENTIFIER.test(evidence.transitionId ?? '') || !IDENTIFIER.test(evidence.withdrawalId ?? '')) fail('withdrawal/invalid-transition', 'Transition identity is invalid.');
    const fingerprint = createHash('sha256').update([evidence.evidenceType, evidence.transitionId, evidence.withdrawalId].join('\0')).digest('hex');
    const replayRef = this.db.doc(`withdrawalTransitionIdempotency/${digest('withdrawal-transition', evidence.transitionId)}`);
    return this.db.runTransaction(async (tx) => {
      const replay = data(await tx.get(replayRef));
      if (replay) {
        if (replay.fingerprint !== fingerprint) fail('withdrawal/transition-conflict', 'Transition identity is bound to different evidence.');
        return { ...replay.result, duplicate: true };
      }
      const withdrawalQuery = await tx.get(this.db.doc(`withdrawalLookup/${evidence.withdrawalId}`));
      const lookup = data(withdrawalQuery);
      if (!lookup?.ownerUid) fail('withdrawal/not-found', 'Withdrawal was not found.');
      const withdrawalRef = this.db.doc(`users/${lookup.ownerUid}/withdrawals/${evidence.withdrawalId}`);
      const walletRef = this.db.doc(`users/${lookup.ownerUid}/wallet/account`);
      const ledgerRef = this.db.doc(`users/${lookup.ownerUid}/walletTransactions/${digest('wallet-transition', evidence.transitionId)}`);
      const withdrawal = data(await tx.get(withdrawalRef));
      const timestamp = this.timestamp.now();
      const current = wallet(data(await tx.get(walletRef)), timestamp);
      if (!withdrawal || withdrawal.status !== 'PENDING') fail('withdrawal/invalid-state', 'Only a pending withdrawal may transition.');
      if ((await tx.get(ledgerRef)).exists) fail('withdrawal/data-integrity', 'Transition ledger exists without idempotency protection.');
      if (current.reservedBalanceMinor < withdrawal.amountMinor) fail('withdrawal/wallet-integrity', 'Reserved wallet balance is insufficient.');
      const released = status !== 'PAID';
      const next = wallet({ ...current, availableBalanceMinor: current.availableBalanceMinor + (released ? withdrawal.amountMinor : 0), reservedBalanceMinor: current.reservedBalanceMinor - withdrawal.amountMinor, updatedAt: timestamp }, timestamp);
      const type = released ? 'WITHDRAWAL_RELEASED' : 'WITHDRAWAL_PAID';
      const ledger = { transactionId: ledgerRef.path.split('/').at(-1), type, amountMinor: withdrawal.amountMinor, currency: 'INR', sourceType: 'WITHDRAWAL', sourceId: evidence.withdrawalId, fromBucket: 'RESERVED', balanceBucket: released ? 'AVAILABLE' : 'EXTERNAL', createdAt: timestamp, schemaVersion: SCHEMA_VERSION };
      const result = { withdrawalId: evidence.withdrawalId, ownerUid: lookup.ownerUid, amountMinor: withdrawal.amountMinor, status, availableBalanceMinor: next.availableBalanceMinor, reservedBalanceMinor: next.reservedBalanceMinor };
      tx.set(walletRef, next, { merge: false }); tx.update(withdrawalRef, { status, updatedAt: timestamp, completedAt: timestamp }); tx.create(ledgerRef, ledger);
      tx.create(replayRef, { fingerprint, withdrawalId: evidence.withdrawalId, result, createdAt: timestamp, schemaVersion: SCHEMA_VERSION });
      return { ...result, duplicate: false };
    });
  }
}

export const WITHDRAWAL_TRANSITIONS = TRANSITIONS;
