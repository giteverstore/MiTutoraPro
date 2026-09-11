import { createHash } from 'node:crypto';
import { validateRefundedAmount } from './PaymentModels.js';
import { calculateEligibleReferralMinor, FINANCIAL_POLICY } from './FinancialPolicy.js';
import { SubscriptionService } from '../subscriptions/SubscriptionService.js';

const SCHEMA_VERSION = '1.0.0';
const CURRENCY = 'INR';
const IDENTIFIER = /^[A-Za-z0-9_.:-]{8,180}$/;
const TRUSTED_SOURCES = new Set(['PROVIDER_WEBHOOK', 'PROVIDER_FETCH', 'PROVIDER_RECONCILIATION']);
export const SETTLEMENT_STATE = Object.freeze({ SETTLED: 'SETTLED', PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED', REFUNDED: 'REFUNDED', DISPUTED: 'DISPUTED', REVERSED: 'REVERSED' });
const data = (snapshot) => snapshot?.exists ? snapshot.data() : null;
const digest = (prefix, value) => `${prefix}_${createHash('sha256').update(value).digest('hex')}`;
function fail(code, message) { throw Object.assign(new Error(message), { code }); }
function dateOf(value) { return value?.toDate?.() ?? (value instanceof Date ? value : null); }
function account(value) { return { ...value, outstandingReferralClawbackMinor: value?.outstandingReferralClawbackMinor ?? 0 }; }

export class ReferralSettlementService {
  constructor({ db, timestamp, now = () => new Date(), policy = FINANCIAL_POLICY, entitlementService, recomputeEntitlement = true }) {
    if (!db?.doc || !db?.runTransaction || !timestamp?.now) throw new TypeError('ReferralSettlementService requires Firestore.');
    this.db = db; this.timestamp = timestamp; this.now = now; this.policy = policy;
    this.entitlementService = entitlementService ?? (db.collection ? new SubscriptionService({ db, timestamp, now }) : null);
    this.recomputeEntitlement = recomputeEntitlement;
  }

  async applyTrustedEvidence(evidence) {
    this.#validateEvidence(evidence);
    const evidenceKey = digest('settlement-evidence', `${evidence.provider}\0${evidence.evidenceId}`);
    const evidenceRef = this.db.doc(`paymentSettlementEvidence/${evidenceKey}`);
    const outcome = await this.db.runTransaction(async (tx) => {
      const replay = data(await tx.get(evidenceRef));
      const fingerprint = createHash('sha256').update([evidence.source, evidence.provider, evidence.evidenceId, evidence.paymentId, evidence.state, String(evidence.refundedAmountMinor ?? 0), evidence.currency].join('\0')).digest('hex');
      if (replay) {
        if (replay.fingerprint !== fingerprint) fail('settlement/evidence-conflict', 'Settlement evidence identity conflicts with stored evidence.');
        return { ...replay.result, ownerUid: replay.ownerUid, duplicate: true };
      }
      const payment = data(await tx.get(this.db.doc(`payments/${evidence.paymentId}`)));
      if (!payment || payment.provider !== evidence.provider || payment.currency !== evidence.currency || payment.currency !== CURRENCY) fail('settlement/payment-mismatch', 'Settlement evidence does not match canonical payment.');
      const qualification = data(await tx.get(this.db.doc(`referralPurchaseQualifications/${evidence.paymentId}`)));
      if (!qualification?.referralId) fail('settlement/referral-not-found', 'Payment has no qualified referral reward.');
      const referralRef = this.db.doc(`referrals/${qualification.referralId}`);
      const referral = data(await tx.get(referralRef));
      if (!referral || referral.qualifyingPurchaseReference !== evidence.paymentId || referral.currency !== CURRENCY) fail('settlement/referral-integrity', 'Referral qualification is not bound to this payment.');
      const originalRewardMinor = referral.calculatedRewardMinor;
      if (!Number.isSafeInteger(originalRewardMinor) || originalRewardMinor <= 0 || originalRewardMinor !== qualification.result?.calculatedRewardMinor) fail('settlement/reward-mismatch', 'Pending reward does not equal the qualified reward.');
      const result = await this.#applyState(tx, { evidence, payment, referral, referralRef, originalRewardMinor });
      tx.create(evidenceRef, { evidenceId: evidence.evidenceId, paymentId: evidence.paymentId, provider: evidence.provider, ownerUid: payment.ownerUid, state: evidence.state, source: evidence.source, occurredAt: evidence.occurredAt ?? null, refundedAmountMinor: evidence.refundedAmountMinor ?? 0, currency: CURRENCY, policyVersion: this.policy.policyVersion, fingerprint, result, verifiedAt: this.timestamp.now(), schemaVersion: SCHEMA_VERSION });
      return { ...result, ownerUid: payment.ownerUid, duplicate: false };
    });
    if (this.recomputeEntitlement && this.entitlementService && [SETTLEMENT_STATE.REFUNDED, SETTLEMENT_STATE.DISPUTED, SETTLEMENT_STATE.REVERSED, SETTLEMENT_STATE.SETTLED].includes(evidence.state)) await this.entitlementService.recomputePremiumEntitlement(outcome.ownerUid);
    const { ownerUid: _, ...publicOutcome } = outcome;
    return publicOutcome;
  }

  async #applyState(tx, context) {
    const { evidence, payment, referral, originalRewardMinor } = context;
    if (evidence.state === SETTLEMENT_STATE.SETTLED) return this.#release(tx, context);
    if (evidence.state === SETTLEMENT_STATE.PARTIALLY_REFUNDED) {
      const refunded = validateRefundedAmount(payment.amountMinor, evidence.refundedAmountMinor);
      if (refunded <= 0 || refunded >= payment.amountMinor) fail('settlement/invalid-partial-refund', 'Partial refund bounds are invalid.');
      const eligibleRewardMinor = calculateEligibleReferralMinor(payment.amountMinor, refunded, referral.rewardRateBps);
      return this.#reduceEligibility(tx, { ...context, eligibleRewardMinor, refundedAmountMinor: refunded });
    }
    if (evidence.state === SETTLEMENT_STATE.DISPUTED) {
      const released = ['SETTLED', 'CLAWBACK_REQUIRED', 'CLAWBACK_REVIEW_REQUIRED'].includes(referral.walletSettlementStatus);
      tx.update(context.referralRef, { releaseBlockedReason: 'PAYMENT_DISPUTED', ...(released ? { walletSettlementStatus: 'CLAWBACK_REVIEW_REQUIRED' } : {}), policyVersion: this.policy.policyVersion, updatedAt: this.timestamp.now() });
      return { state: released ? 'CLAWBACK_REVIEW_REQUIRED' : 'RELEASE_BLOCKED', referralId: referral.referralId };
    }
    if (evidence.state === SETTLEMENT_STATE.REFUNDED && validateRefundedAmount(payment.amountMinor, evidence.refundedAmountMinor) !== payment.amountMinor) fail('settlement/invalid-full-refund', 'A full refund must equal the canonical payment amount.');
    return this.#blockOrClawback(tx, { ...context, eligibleRewardMinor: 0, reason: evidence.state, originalRewardMinor });
  }

  async #reduceEligibility(tx, context) {
    const { evidence, referral, referralRef, originalRewardMinor, eligibleRewardMinor, refundedAmountMinor } = context;
    const currentEligible = referral.eligibleRewardMinor ?? originalRewardMinor;
    if (eligibleRewardMinor > currentEligible) fail('settlement/refund-regression', 'Referral eligibility cannot increase through refund evidence.');
    const reduction = currentEligible - eligibleRewardMinor;
    if (referral.walletSettlementStatus === 'SETTLED' || referral.walletSettlementStatus === 'CLAWBACK_REQUIRED') {
      const released = referral.releasedRewardMinor ?? originalRewardMinor;
      return this.#recordClawback(tx, { ...context, clawbackMinor: Math.max(0, released - eligibleRewardMinor), reason: 'PARTIAL_REFUND' });
    }
    if (referral.walletSettlementStatus !== 'PENDING') fail('settlement/not-pending', 'Referral reward is not pending.');
    if (reduction === 0) return { state: 'PENDING_ADJUSTED', referralId: referral.referralId, eligibleRewardMinor, adjustmentMinor: 0 };
    const walletRef = this.db.doc(`users/${referral.referrerUid}/wallet/account`);
    const wallet = account(data(await tx.get(walletRef)));
    if (wallet.currency !== CURRENCY || wallet.pendingBalanceMinor < reduction || wallet.lifetimeCreditedMinor < reduction) fail('settlement/wallet-integrity', 'Pending wallet projection is invalid.');
    const transactionId = digest('wallet-adjustment', evidence.evidenceId);
    const ledgerRef = this.db.doc(`users/${referral.referrerUid}/walletTransactions/${transactionId}`);
    if ((await tx.get(ledgerRef)).exists) fail('settlement/ledger-integrity', 'Adjustment ledger exists without matching evidence.');
    const adjustedAt = this.timestamp.now();
    tx.set(walletRef, { ...wallet, pendingBalanceMinor: wallet.pendingBalanceMinor - reduction, lifetimeCreditedMinor: wallet.lifetimeCreditedMinor - reduction, updatedAt: adjustedAt }, { merge: false });
    tx.create(ledgerRef, { transactionId, type: 'REFERRAL_REWARD_ADJUSTED', amountMinor: reduction, currency: CURRENCY, fromBucket: 'PENDING', balanceBucket: 'CANCELLED', sourceType: 'REFERRAL', sourceId: referral.referralId, settlementEvidenceId: evidence.evidenceId, createdAt: adjustedAt, schemaVersion: SCHEMA_VERSION });
    tx.update(referralRef, { eligibleRewardMinor, pendingRewardMinor: eligibleRewardMinor, refundedAmountMinor, policyVersion: this.policy.policyVersion, updatedAt: adjustedAt });
    return { state: 'PENDING_ADJUSTED', referralId: referral.referralId, eligibleRewardMinor, adjustmentMinor: reduction, transactionId };
  }

  async #release(tx, { evidence, payment, referral, referralRef, originalRewardMinor }) {
    if (this.policy?.policyVersion !== 'm8-v1' || this.policy.referralReleaseDelayDays !== 7) fail('settlement/release-policy-unavailable', 'Approved referral release policy is unavailable.');
    if (!['CAPTURED', 'PARTIALLY_REFUNDED'].includes(payment.status) || (referral.releaseBlockedReason && referral.releaseBlockedReason !== 'PAYMENT_DISPUTED')) fail('settlement/release-blocked', 'Payment state blocks referral reward release.');
    if (referral.walletSettlementStatus === 'CLAWBACK_REVIEW_REQUIRED') {
      tx.update(referralRef, { walletSettlementStatus: 'SETTLED', releaseBlockedReason: null, updatedAt: this.timestamp.now() });
      return { state: 'SETTLED', referralId: referral.referralId, amountMinor: 0 };
    }
    const financialEventAt = dateOf(payment.settledAt ?? evidence.occurredAt);
    if (!financialEventAt || this.now().getTime() < financialEventAt.getTime() + this.policy.referralReleaseDelayDays * 86_400_000) fail('settlement/cooling-active', 'Referral reward cooling period has not elapsed.');
    if (referral.walletSettlementStatus !== 'PENDING') fail(referral.walletSettlementStatus === 'SETTLED' ? 'settlement/already-released' : 'settlement/not-pending', 'Referral reward is not releasable.');
    const amountMinor = referral.pendingRewardMinor ?? referral.eligibleRewardMinor ?? originalRewardMinor;
    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) fail('settlement/no-eligible-reward', 'No eligible referral value remains.');
    const walletRef = this.db.doc(`users/${referral.referrerUid}/wallet/account`);
    const wallet = account(data(await tx.get(walletRef)));
    if (wallet.currency !== CURRENCY || wallet.pendingBalanceMinor < amountMinor) fail('settlement/wallet-integrity', 'Pending wallet projection is invalid.');
    const offsetMinor = Math.min(wallet.outstandingReferralClawbackMinor, amountMinor);
    const availableMinor = amountMinor - offsetMinor;
    const releaseId = digest('wallet-release', evidence.paymentId);
    const releaseRef = this.db.doc(`users/${referral.referrerUid}/walletTransactions/${releaseId}`);
    const offsetId = digest('wallet-clawback-offset', evidence.paymentId);
    const offsetRef = this.db.doc(`users/${referral.referrerUid}/walletTransactions/${offsetId}`);
    const refs = await tx.getAll(releaseRef, ...(offsetMinor ? [offsetRef] : []));
    if (refs.some((item) => item.exists)) fail('settlement/ledger-integrity', 'Release ledger exists without matching evidence.');
    const releasedAt = this.timestamp.now();
    tx.set(walletRef, { ...wallet, pendingBalanceMinor: wallet.pendingBalanceMinor - amountMinor, availableBalanceMinor: wallet.availableBalanceMinor + availableMinor, outstandingReferralClawbackMinor: wallet.outstandingReferralClawbackMinor - offsetMinor, updatedAt: releasedAt }, { merge: false });
    tx.create(releaseRef, { transactionId: releaseId, type: 'REFERRAL_REWARD_AVAILABLE', amountMinor, currency: CURRENCY, fromBucket: 'PENDING', balanceBucket: 'AVAILABLE', sourceType: 'REFERRAL', sourceId: referral.referralId, settlementEvidenceId: evidence.evidenceId, createdAt: releasedAt, schemaVersion: SCHEMA_VERSION });
    if (offsetMinor) tx.create(offsetRef, { transactionId: offsetId, type: 'REFERRAL_CLAWBACK_OFFSET', amountMinor: offsetMinor, currency: CURRENCY, fromBucket: 'REFERRAL_RELEASE', balanceBucket: 'CLAWBACK', sourceType: 'REFERRAL', sourceId: referral.referralId, settlementEvidenceId: evidence.evidenceId, createdAt: releasedAt, schemaVersion: SCHEMA_VERSION });
    tx.update(referralRef, { walletSettlementStatus: 'SETTLED', releaseBlockedReason: null, walletReleaseTransactionId: releaseId, releasedRewardMinor: amountMinor, clawbackOffsetMinor: offsetMinor, releasedAt, policyVersion: this.policy.policyVersion, updatedAt: releasedAt });
    return { state: 'AVAILABLE', referralId: referral.referralId, transactionId: releaseId, amountMinor, availableMinor, clawbackOffsetMinor: offsetMinor };
  }

  async #blockOrClawback(tx, context) {
    const { evidence, referral, referralRef, originalRewardMinor, eligibleRewardMinor, reason } = context;
    if (['SETTLED', 'CLAWBACK_REQUIRED', 'CLAWBACK_REVIEW_REQUIRED'].includes(referral.walletSettlementStatus)) {
      const released = referral.releasedRewardMinor ?? referral.eligibleRewardMinor ?? originalRewardMinor;
      return this.#recordClawback(tx, { ...context, clawbackMinor: Math.max(0, released - eligibleRewardMinor), reason });
    }
    if (referral.walletSettlementStatus === 'CANCELLED') return { state: 'CANCELLED', referralId: referral.referralId };
    if (['UNSETTLED', undefined].includes(referral.walletSettlementStatus)) {
      const cancelledAt = this.timestamp.now();
      tx.update(referralRef, { walletSettlementStatus: 'CANCELLED', eligibleRewardMinor: 0, reversalReason: reason, cancelledBeforePending: true, reversedAt: cancelledAt, policyVersion: this.policy.policyVersion, updatedAt: cancelledAt });
      return { state: 'CANCELLED', referralId: referral.referralId, amountMinor: 0 };
    }
    const remaining = referral.pendingRewardMinor ?? referral.eligibleRewardMinor ?? originalRewardMinor;
    if (referral.walletSettlementStatus !== 'PENDING' || remaining <= 0) fail('settlement/not-pending', 'Referral reward is not pending.');
    const walletRef = this.db.doc(`users/${referral.referrerUid}/wallet/account`);
    const wallet = account(data(await tx.get(walletRef)));
    if (wallet.currency !== CURRENCY || wallet.pendingBalanceMinor < remaining || wallet.lifetimeCreditedMinor < remaining) fail('settlement/wallet-integrity', 'Pending wallet projection is invalid.');
    const transactionId = digest('wallet-reversal', evidence.paymentId);
    const ledgerRef = this.db.doc(`users/${referral.referrerUid}/walletTransactions/${transactionId}`);
    if ((await tx.get(ledgerRef)).exists) fail('settlement/ledger-integrity', 'Reversal ledger exists without matching evidence.');
    const reversedAt = this.timestamp.now();
    tx.set(walletRef, { ...wallet, pendingBalanceMinor: wallet.pendingBalanceMinor - remaining, lifetimeCreditedMinor: wallet.lifetimeCreditedMinor - remaining, updatedAt: reversedAt }, { merge: false });
    tx.create(ledgerRef, { transactionId, type: 'REFERRAL_REWARD_REVERSED', amountMinor: remaining, currency: CURRENCY, fromBucket: 'PENDING', balanceBucket: 'CANCELLED', sourceType: 'REFERRAL', sourceId: referral.referralId, reason, settlementEvidenceId: evidence.evidenceId, createdAt: reversedAt, schemaVersion: SCHEMA_VERSION });
    tx.update(referralRef, { walletSettlementStatus: 'CANCELLED', eligibleRewardMinor: 0, pendingRewardMinor: 0, walletReversalTransactionId: transactionId, reversalReason: reason, reversedAt, policyVersion: this.policy.policyVersion, updatedAt: reversedAt });
    return { state: 'CANCELLED', referralId: referral.referralId, transactionId, amountMinor: remaining };
  }

  async #recordClawback(tx, { evidence, referral, referralRef, clawbackMinor, reason, eligibleRewardMinor }) {
    if (!Number.isSafeInteger(clawbackMinor) || clawbackMinor < 0) fail('settlement/clawback-integrity', 'Clawback amount is invalid.');
    if (clawbackMinor === 0) return { state: 'SETTLED', referralId: referral.referralId, clawbackMinor: 0 };
    const walletRef = this.db.doc(`users/${referral.referrerUid}/wallet/account`);
    const wallet = account(data(await tx.get(walletRef)));
    if (wallet.currency !== CURRENCY) fail('settlement/wallet-integrity', 'Wallet projection is invalid.');
    const priorRecorded = referral.clawbackRequiredMinor ?? 0;
    const incremental = clawbackMinor - priorRecorded;
    if (incremental < 0) fail('settlement/clawback-regression', 'Outstanding clawback cannot regress from adverse evidence.');
    if (incremental === 0) return { state: 'CLAWBACK_REQUIRED', referralId: referral.referralId, clawbackMinor: priorRecorded };
    const transactionId = digest('wallet-clawback', evidence.evidenceId);
    const ledgerRef = this.db.doc(`users/${referral.referrerUid}/walletTransactions/${transactionId}`);
    if ((await tx.get(ledgerRef)).exists) fail('settlement/ledger-integrity', 'Clawback ledger exists without matching evidence.');
    const recordedAt = this.timestamp.now();
    tx.set(walletRef, { ...wallet, outstandingReferralClawbackMinor: wallet.outstandingReferralClawbackMinor + incremental, updatedAt: recordedAt }, { merge: false });
    tx.create(ledgerRef, { transactionId, type: 'REFERRAL_CLAWBACK_REQUIRED', amountMinor: incremental, currency: CURRENCY, balanceBucket: 'CLAWBACK', sourceType: 'REFERRAL', sourceId: referral.referralId, reason, settlementEvidenceId: evidence.evidenceId, createdAt: recordedAt, schemaVersion: SCHEMA_VERSION });
    tx.update(referralRef, { walletSettlementStatus: 'CLAWBACK_REQUIRED', eligibleRewardMinor, releaseBlockedReason: reason, clawbackRequiredMinor: clawbackMinor, clawbackReason: reason, policyVersion: this.policy.policyVersion, updatedAt: recordedAt });
    return { state: 'CLAWBACK_REQUIRED', referralId: referral.referralId, clawbackMinor };
  }

  #validateEvidence(evidence) {
    if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) fail('settlement/invalid-evidence', 'Settlement evidence is invalid.');
    const fields = new Set(['trusted', 'source', 'provider', 'evidenceId', 'paymentId', 'state', 'occurredAt', 'refundedAmountMinor', 'currency']);
    if (Object.keys(evidence).some((key) => !fields.has(key)) || evidence.trusted !== true || !TRUSTED_SOURCES.has(evidence.source)) fail('settlement/untrusted-evidence', 'Trusted server evidence is required.');
    if (![evidence.provider, evidence.evidenceId, evidence.paymentId].every((value) => IDENTIFIER.test(value ?? '')) || !Object.values(SETTLEMENT_STATE).includes(evidence.state) || evidence.currency !== CURRENCY) fail('settlement/invalid-evidence', 'Settlement evidence is incomplete.');
  }
}
