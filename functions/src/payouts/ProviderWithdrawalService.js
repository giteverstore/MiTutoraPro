import { createHash, createHmac } from 'node:crypto';
import { WITHDRAWAL_POLICY } from '../withdrawals/WithdrawalPolicy.js';
import { maskUpiId, normalizeUpiId } from './UpiDestination.js';
import { assertPayoutTransition, PAYOUT_STATUS } from './PayoutModels.js';

const SCHEMA_VERSION = '2.0.0';
const IDENTIFIER = /^[A-Za-z0-9_.:-]{8,180}$/;
const REQUEST_FIELDS = new Set(['amountMinor', 'upiId', 'requestId']);
const EVIDENCE_FIELDS = new Set(['trusted', 'source', 'eventId', 'withdrawalId', 'status', 'providerPayoutId', 'providerContactId', 'providerFundAccountId', 'amountMinor', 'currency']);
const TRUSTED_SOURCES = new Set(['PROVIDER_RESPONSE', 'PROVIDER_WEBHOOK', 'PROVIDER_RECONCILIATION']);
const digest = (prefix, value) => `${prefix}_${createHash('sha256').update(value).digest('hex')}`;
const data = (snapshot) => snapshot?.exists ? snapshot.data() : null;
function fail(code, message) { throw Object.assign(new Error(message), { code }); }
function safeBoundary(enabled, environment) {
  return enabled && ['test', 'development'].includes(environment.NODE_ENV)
    && /^127\.0\.0\.1:\d+$/.test(environment.FIRESTORE_EMULATOR_HOST ?? '')
    && /^demo-/.test(environment.FIREBASE_PROJECT_ID ?? environment.GCLOUD_PROJECT ?? '');
}
function wallet(value, timestamp) {
  const result = { ...(value ?? { currency: 'INR', pendingBalanceMinor: 0, availableBalanceMinor: 0, lifetimeCreditedMinor: 0, createdAt: timestamp }), reservedBalanceMinor: value?.reservedBalanceMinor ?? 0, outstandingReferralClawbackMinor: value?.outstandingReferralClawbackMinor ?? 0 };
  if (result.currency !== 'INR' || !['pendingBalanceMinor', 'availableBalanceMinor', 'reservedBalanceMinor', 'outstandingReferralClawbackMinor', 'lifetimeCreditedMinor'].every((key) => Number.isSafeInteger(result[key]) && result[key] >= 0)) fail('withdrawal/wallet-integrity', 'Wallet projection is invalid.');
  return result;
}

export class ProviderWithdrawalService {
  constructor({ db, timestamp, destinationFingerprintKey, policy = WITHDRAWAL_POLICY, allowWithdrawalRequests = false, environment = process.env }) {
    if (!db?.doc || !db?.runTransaction || !timestamp?.now) throw new TypeError('ProviderWithdrawalService requires Firestore and a timestamp factory.');
    if (typeof destinationFingerprintKey !== 'string' || Buffer.byteLength(destinationFingerprintKey, 'utf8') < 32) throw new TypeError('ProviderWithdrawalService requires a private destination fingerprint key with at least 256 bits of input material.');
    this.db = db; this.timestamp = timestamp; this.destinationFingerprintKey = destinationFingerprintKey; this.policy = policy;
    this.allowWithdrawalRequests = safeBoundary(allowWithdrawalRequests, environment);
  }

  async requestWithdrawal({ principal, request }) {
    if (!this.allowWithdrawalRequests) fail('withdrawal/requests-disabled', 'Withdrawals are coming soon.');
    const ownerUid = principal?.uid;
    if (!ownerUid) fail('withdrawal/unauthenticated', 'Authentication is required.');
    if (!request || typeof request !== 'object' || Array.isArray(request) || Object.keys(request).some((key) => !REQUEST_FIELDS.has(key))) fail('withdrawal/client-authority-rejected', 'Only amount, UPI destination, and request identity may be submitted.');
    if (!Number.isSafeInteger(request.amountMinor) || request.amountMinor < this.policy.minimumWithdrawalMinor) fail('withdrawal/below-minimum', 'Withdrawal amount is below the policy minimum.');
    if (!IDENTIFIER.test(request.requestId ?? '')) fail('withdrawal/invalid-request', 'Withdrawal request identity is invalid.');
    const normalizedDestination = normalizeUpiId(request.upiId);
    const maskedDestination = maskUpiId(normalizedDestination);
    const destinationFingerprint = createHmac('sha256', this.destinationFingerprintKey).update(normalizedDestination).digest('hex');
    const withdrawalId = digest('withdrawal', request.requestId);
    const fingerprint = createHash('sha256').update([ownerUid, String(request.amountMinor), destinationFingerprint, this.policy.currency, this.policy.policyVersion].join('\0')).digest('hex');
    const replayRef = this.db.doc(`withdrawalIdempotency/${digest('withdrawal-idem', request.requestId)}`);
    const walletRef = this.db.doc(`users/${ownerUid}/wallet/account`);
    const withdrawalRef = this.db.doc(`users/${ownerUid}/withdrawals/${withdrawalId}`);
    const ledgerRef = this.db.doc(`users/${ownerUid}/walletTransactions/${digest('wallet-reserve', request.requestId)}`);
    const lookupRef = this.db.doc(`withdrawalLookup/${withdrawalId}`);
    const outboxRef = this.db.doc(`payoutOutbox/${withdrawalId}`);
    return this.db.runTransaction(async (tx) => {
      const replay = data(await tx.get(replayRef));
      if (replay) {
        if (replay.ownerUid !== ownerUid || replay.fingerprint !== fingerprint) fail('withdrawal/request-conflict', 'Withdrawal request identity conflicts with stored data.');
        return { ...replay.result, duplicate: true };
      }
      const timestamp = this.timestamp.now();
      const current = wallet(data(await tx.get(walletRef)), timestamp);
      if (current.availableBalanceMinor - current.outstandingReferralClawbackMinor < request.amountMinor) fail('withdrawal/insufficient-balance', 'Withdrawable wallet balance is insufficient.');
      for (const reference of [withdrawalRef, ledgerRef, lookupRef, outboxRef]) if ((await tx.get(reference)).exists) fail('withdrawal/data-integrity', 'Withdrawal state exists without idempotency protection.');
      const next = wallet({ ...current, availableBalanceMinor: current.availableBalanceMinor - request.amountMinor, reservedBalanceMinor: current.reservedBalanceMinor + request.amountMinor, updatedAt: timestamp }, timestamp);
      const withdrawal = { withdrawalId, ownerUid, amountMinor: request.amountMinor, currency: 'INR', status: PAYOUT_STATUS.INITIATION_PENDING, destinationType: 'UPI', maskedDestination, providerPayoutId: null, providerContactId: null, providerFundAccountId: null, policyVersion: this.policy.policyVersion, requestedAt: timestamp, updatedAt: timestamp, completedAt: null, schemaVersion: SCHEMA_VERSION };
      const ledger = { transactionId: ledgerRef.path.split('/').at(-1), type: 'WITHDRAWAL_RESERVED', amountMinor: request.amountMinor, currency: 'INR', sourceType: 'WITHDRAWAL', sourceId: withdrawalId, fromBucket: 'AVAILABLE', balanceBucket: 'RESERVED', createdAt: timestamp, schemaVersion: SCHEMA_VERSION };
      const result = { withdrawalId, ownerUid, amountMinor: request.amountMinor, currency: 'INR', status: withdrawal.status, destinationType: 'UPI', maskedDestination, availableBalanceMinor: next.availableBalanceMinor, reservedBalanceMinor: next.reservedBalanceMinor };
      tx.set(walletRef, next, { merge: false }); tx.create(withdrawalRef, withdrawal); tx.create(ledgerRef, ledger);
      tx.create(lookupRef, { withdrawalId, ownerUid, createdAt: timestamp, schemaVersion: SCHEMA_VERSION });
      tx.create(outboxRef, { withdrawalId, ownerUid, status: 'PENDING', providerIdempotencyKey: digest('payout', withdrawalId), attempts: 0, createdAt: timestamp, updatedAt: timestamp, schemaVersion: SCHEMA_VERSION });
      tx.create(replayRef, { ownerUid, fingerprint, withdrawalId, result, createdAt: timestamp, schemaVersion: SCHEMA_VERSION });
      return { ...result, duplicate: false };
    });
  }

  async applyProviderEvent(evidence) {
    if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence) || Object.keys(evidence).some((key) => !EVIDENCE_FIELDS.has(key))) fail('payout/invalid-evidence', 'Payout evidence is invalid.');
    if (evidence.trusted !== true || !TRUSTED_SOURCES.has(evidence.source) || !IDENTIFIER.test(evidence.eventId ?? '') || !IDENTIFIER.test(evidence.withdrawalId ?? '')) fail('payout/untrusted-evidence', 'Trusted payout evidence is required.');
    const replayRef = this.db.doc(`payoutWebhookEvents/${digest('payout-event', evidence.eventId)}`);
    const lookupRef = this.db.doc(`withdrawalLookup/${evidence.withdrawalId}`);
    const fingerprint = createHash('sha256').update([evidence.source, evidence.eventId, evidence.withdrawalId, evidence.status, evidence.providerPayoutId ?? '', evidence.providerContactId ?? '', evidence.providerFundAccountId ?? '', String(evidence.amountMinor), evidence.currency ?? ''].join('\0')).digest('hex');
    return this.db.runTransaction(async (tx) => {
      const replay = data(await tx.get(replayRef));
      if (replay) {
        if (replay.fingerprint !== fingerprint) fail('payout/event-conflict', 'Payout event identity conflicts with stored evidence.');
        return { ...replay.result, duplicate: true };
      }
      const lookup = data(await tx.get(lookupRef));
      if (!lookup?.ownerUid) fail('withdrawal/not-found', 'Withdrawal was not found.');
      const withdrawalRef = this.db.doc(`users/${lookup.ownerUid}/withdrawals/${evidence.withdrawalId}`);
      const walletRef = this.db.doc(`users/${lookup.ownerUid}/wallet/account`);
      const outboxRef = this.db.doc(`payoutOutbox/${evidence.withdrawalId}`);
      const withdrawal = data(await tx.get(withdrawalRef));
      if (!withdrawal) fail('withdrawal/not-found', 'Withdrawal was not found.');
      if (evidence.amountMinor !== withdrawal.amountMinor || evidence.currency !== withdrawal.currency) fail('payout/provider-binding-mismatch', 'Payout evidence does not match the withdrawal.');
      if (withdrawal.providerPayoutId && evidence.providerPayoutId !== withdrawal.providerPayoutId) fail('payout/provider-binding-mismatch', 'Provider payout identity does not match the withdrawal.');
      if (withdrawal.providerContactId && evidence.providerContactId && evidence.providerContactId !== withdrawal.providerContactId) fail('payout/provider-binding-mismatch', 'Provider contact identity does not match the withdrawal.');
      if (withdrawal.providerFundAccountId && evidence.providerFundAccountId && evidence.providerFundAccountId !== withdrawal.providerFundAccountId) fail('payout/provider-binding-mismatch', 'Provider fund account identity does not match the withdrawal.');
      const transition = assertPayoutTransition(withdrawal.status, evidence.status);
      const timestamp = this.timestamp.now();
      const current = wallet(data(await tx.get(walletRef)), timestamp);
      let next = current;
      let ledgerType = null;
      if (!transition.idempotent && ['FAILED', 'CANCELLED'].includes(evidence.status)) {
        if (current.reservedBalanceMinor < withdrawal.amountMinor) fail('withdrawal/wallet-integrity', 'Reserved wallet balance is insufficient.');
        next = wallet({ ...current, availableBalanceMinor: current.availableBalanceMinor + withdrawal.amountMinor, reservedBalanceMinor: current.reservedBalanceMinor - withdrawal.amountMinor, updatedAt: timestamp }, timestamp);
        ledgerType = 'WITHDRAWAL_RELEASED';
      } else if (!transition.idempotent && evidence.status === 'PAID') {
        if (current.reservedBalanceMinor < withdrawal.amountMinor) fail('withdrawal/wallet-integrity', 'Reserved wallet balance is insufficient.');
        next = wallet({ ...current, reservedBalanceMinor: current.reservedBalanceMinor - withdrawal.amountMinor, updatedAt: timestamp }, timestamp);
        ledgerType = 'WITHDRAWAL_PAID';
      } else if (!transition.idempotent && evidence.status === 'REVERSED') {
        if (withdrawal.status === 'PAID') next = wallet({ ...current, availableBalanceMinor: current.availableBalanceMinor + withdrawal.amountMinor, updatedAt: timestamp }, timestamp);
        else {
          if (current.reservedBalanceMinor < withdrawal.amountMinor) fail('withdrawal/wallet-integrity', 'Reserved wallet balance is insufficient.');
          next = wallet({ ...current, availableBalanceMinor: current.availableBalanceMinor + withdrawal.amountMinor, reservedBalanceMinor: current.reservedBalanceMinor - withdrawal.amountMinor, updatedAt: timestamp }, timestamp);
        }
        ledgerType = 'WITHDRAWAL_REVERSED';
      }
      if (ledgerType) {
        const ledgerRef = this.db.doc(`users/${lookup.ownerUid}/walletTransactions/${digest('wallet-payout-event', evidence.eventId)}`);
        if ((await tx.get(ledgerRef)).exists) fail('withdrawal/data-integrity', 'Payout ledger exists without event idempotency state.');
        tx.create(ledgerRef, { transactionId: ledgerRef.path.split('/').at(-1), type: ledgerType, amountMinor: withdrawal.amountMinor, currency: 'INR', sourceType: 'WITHDRAWAL', sourceId: evidence.withdrawalId, fromBucket: ledgerType === 'WITHDRAWAL_REVERSED' && withdrawal.status === 'PAID' ? 'EXTERNAL' : 'RESERVED', balanceBucket: ledgerType === 'WITHDRAWAL_PAID' ? 'EXTERNAL' : 'AVAILABLE', createdAt: timestamp, schemaVersion: SCHEMA_VERSION });
        tx.set(walletRef, next, { merge: false });
      }
      const terminal = ['PAID', 'FAILED', 'CANCELLED', 'REVERSED'].includes(evidence.status);
      tx.update(withdrawalRef, { status: evidence.status, providerPayoutId: evidence.providerPayoutId ?? withdrawal.providerPayoutId ?? null, providerContactId: evidence.providerContactId ?? withdrawal.providerContactId ?? null, providerFundAccountId: evidence.providerFundAccountId ?? withdrawal.providerFundAccountId ?? null, updatedAt: timestamp, completedAt: terminal ? (withdrawal.completedAt ?? timestamp) : null });
      tx.set(outboxRef, { status: terminal ? 'COMPLETE' : evidence.status, providerPayoutId: evidence.providerPayoutId ?? withdrawal.providerPayoutId ?? null, providerContactId: evidence.providerContactId ?? withdrawal.providerContactId ?? null, providerFundAccountId: evidence.providerFundAccountId ?? withdrawal.providerFundAccountId ?? null, updatedAt: timestamp }, { merge: true });
      const result = { withdrawalId: evidence.withdrawalId, ownerUid: lookup.ownerUid, status: evidence.status, availableBalanceMinor: next.availableBalanceMinor, reservedBalanceMinor: next.reservedBalanceMinor };
      tx.create(replayRef, { fingerprint, withdrawalId: evidence.withdrawalId, result, processedAt: timestamp, schemaVersion: SCHEMA_VERSION });
      return { ...result, duplicate: false };
    });
  }
}
