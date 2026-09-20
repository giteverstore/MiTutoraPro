import { createHash } from 'node:crypto';
import { addCalendarMonths, resolvePremiumEntitlement, SUBSCRIPTION_SOURCES, SUBSCRIPTION_STATUSES } from '../subscriptions/SubscriptionService.js';
import { getSubscriptionPlan } from '../subscriptions/SubscriptionPlans.js';
import { failCoin } from './CoinError.js';
import { coinRedemptionPolicy, COIN_REDEMPTION_TYPES, kolkataDateKey, kolkataMonthKey } from './CoinRedemptionPolicy.js';

const REQUEST_ID = /^[A-Za-z0-9_-]{16,128}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const digest = (prefix, value) => `${prefix}_${createHash('sha256').update(value).digest('hex')}`;
const asDate = (value) => value?.toDate?.() ?? (value instanceof Date ? value : null);
const serializedDate = (value) => asDate(value)?.toISOString() ?? null;
const fail = (code, message) => failCoin(code, message);

function request(input, expectedType) {
  const allowed = expectedType === COIN_REDEMPTION_TYPES.CHALLENGE_PASS ? ['requestId', 'occurrenceDate'] : expectedType === COIN_REDEMPTION_TYPES.BRAND_THEME ? ['requestId', 'themeId'] : ['requestId'];
  if (!input || Array.isArray(input) || typeof input !== 'object' || Object.keys(input).some((key) => !allowed.includes(key))) fail('coin/client-authority-rejected', 'Client-controlled redemption fields are not accepted.');
  if (!REQUEST_ID.test(input.requestId ?? '')) fail('coin/invalid-argument', 'A valid redemption request identity is required.');
  if (expectedType === COIN_REDEMPTION_TYPES.CHALLENGE_PASS && !DATE.test(input.occurrenceDate ?? '')) fail('coin/invalid-argument', 'A canonical challenge date is required.');
  if (expectedType === COIN_REDEMPTION_TYPES.BRAND_THEME && !/^[a-z][a-z0-9-]{1,31}$/.test(input.themeId ?? '')) fail('coin/invalid-argument', 'A canonical theme identity is required.');
  return input;
}

export class CoinRedemptionService {
  constructor({ db, timestamp, now = () => new Date(), policy = coinRedemptionPolicy }) {
    if (!db?.runTransaction || !timestamp?.now || !timestamp?.fromDate) throw new TypeError('CoinRedemptionService requires Firestore and timestamps.');
    this.db = db; this.timestamp = timestamp; this.now = now; this.policy = policy;
  }

  async redeemChallengePass({ principal, request: input }) {
    const uid = this.#uid(principal); const value = request(input, COIN_REDEMPTION_TYPES.CHALLENGE_PASS);
    const today = kolkataDateKey(this.now());
    if (value.occurrenceDate >= today) fail('coin/challenge-not-eligible', 'Only a missed historical challenge can be unlocked.');
    const assignment = await this.db.doc(`dailyChallenges/${value.occurrenceDate}`).get();
    const metadata = assignment.exists ? assignment.data() : null;
    if (!metadata || metadata.id !== value.occurrenceDate || metadata.date !== value.occurrenceDate || metadata.published !== true) fail('coin/challenge-not-eligible', 'A published challenge assignment is required.');
    return this.#redeem({ uid, requestId: value.requestId, type: COIN_REDEMPTION_TYPES.CHALLENGE_PASS, policy: this.policy.challengePass, occurrenceDate: value.occurrenceDate, assignmentId: assignment.id, assignmentVersion: metadata.version });
  }

  async redeemPremiumMonth({ principal, request: input }) {
    const uid = this.#uid(principal); const value = request(input, COIN_REDEMPTION_TYPES.PREMIUM_MONTH);
    return this.#redeem({ uid, requestId: value.requestId, type: COIN_REDEMPTION_TYPES.PREMIUM_MONTH, policy: this.policy.premiumMonth });
  }

  async redeemBrandTheme({ principal, request: input }) {
    const uid = this.#uid(principal); const value = request(input, COIN_REDEMPTION_TYPES.BRAND_THEME);
    const policy = this.policy.brandThemes[value.themeId];
    if (!policy) fail('coin/invalid-argument', 'The requested brand theme is unavailable.');
    return this.#redeem({ uid, requestId: value.requestId, type: COIN_REDEMPTION_TYPES.BRAND_THEME, policy, themeId: value.themeId });
  }

  #uid(principal) { if (!principal?.authenticated || !principal.uid) fail('coin/unauthenticated', 'Authentication is required.'); return principal.uid; }

  async #redeem({ uid, requestId, type, policy, occurrenceDate = null, assignmentId = null, assignmentVersion = null, themeId = null }) {
    const redemptionId = digest('redemption', `${uid}\0${requestId}`);
    const transactionId = digest('coin', `redemption:${uid}:${requestId}`);
    const month = kolkataMonthKey(this.now());
    const refs = {
      account: this.db.doc(`users/${uid}/coinAccount/summary`), redemption: this.db.doc(`users/${uid}/coinRedemptions/${redemptionId}`),
      ledger: this.db.doc(`users/${uid}/coinTransactions/${transactionId}`), usage: this.db.doc(`users/${uid}/redemptionUsage/${month}`),
      completion: occurrenceDate ? this.db.doc(`users/${uid}/activityCompletions/${digest('completion', [uid, 'DAILY_CHALLENGE', assignmentId, assignmentVersion, occurrenceDate].join('\0'))}`) : null,
      unlock: occurrenceDate ? this.db.doc(`users/${uid}/challengeUnlocks/${occurrenceDate}`) : null,
      entitlement: type === COIN_REDEMPTION_TYPES.PREMIUM_MONTH ? this.db.doc(`users/${uid}/entitlements/premium`) : null,
      ownership: type === COIN_REDEMPTION_TYPES.BRAND_THEME ? this.db.doc(`users/${uid}/themeOwnership/${themeId}`) : null,
    };
    return this.db.runTransaction(async (tx) => {
      const snapshots = await tx.getAll(refs.account, refs.redemption, refs.ledger, refs.usage, ...(refs.completion ? [refs.completion] : []), ...(refs.entitlement ? [refs.entitlement] : []), ...(refs.ownership ? [refs.ownership] : []));
      const [accountSnap, redemptionSnap, ledgerSnap, usageSnap] = snapshots;
      let snapshotIndex = 4;
      const completionSnap = refs.completion ? snapshots[snapshotIndex++] : null;
      const entitlementSnap = refs.entitlement ? snapshots[snapshotIndex] : null;
      if (refs.entitlement) snapshotIndex += 1;
      const ownershipSnap = refs.ownership ? snapshots[snapshotIndex] : null;
      if (redemptionSnap.exists) {
        const stored = redemptionSnap.data();
        if (stored.ownerUid !== uid || stored.requestId !== requestId || stored.type !== type || (stored.occurrenceDate ?? null) !== occurrenceDate || (stored.themeId ?? null) !== themeId) fail('coin/idempotency-conflict', 'The request identity is already used.');
        return { duplicate: true, redemptionId, transactionId: stored.transactionId, balance: stored.balanceAfter, type, occurrenceDate, themeId, expiresAt: serializedDate(stored.expiresAt) };
      }
      if (ledgerSnap.exists) fail('coin/data-integrity', 'Ledger entry exists without its redemption.');
      if (ownershipSnap?.exists) fail('coin/theme-already-owned', 'This brand theme is already owned.');
      const account = accountSnap.exists ? accountSnap.data() : { availableBalance: 0, lifetimeEarned: 0, lifetimeSpent: 0, revision: 0 };
      if (![account.availableBalance, account.lifetimeEarned, account.lifetimeSpent, account.revision].every(Number.isSafeInteger)) fail('coin/data-integrity', 'Coin account is invalid.');
      if (account.availableBalance < policy.costCoins) fail('coin/insufficient-balance', 'The coin account has insufficient balance.');
      const usage = usageSnap.exists ? usageSnap.data() : { challengePass: 0, premiumMonth: 0 };
      const usageField = type === COIN_REDEMPTION_TYPES.CHALLENGE_PASS ? 'challengePass' : type === COIN_REDEMPTION_TYPES.PREMIUM_MONTH ? 'premiumMonth' : null;
      const used = usageField && Number.isSafeInteger(usage[usageField]) ? usage[usageField] : 0;
      if (usageField && used >= policy.monthlyLimit) fail('coin/redemption-limit-reached', 'The monthly redemption limit was reached.');
      if (completionSnap?.exists && completionSnap.data()?.completionStatus === 'COMPLETED') fail('coin/challenge-not-eligible', 'Completed challenges cannot be unlocked.');
      const serverNow = this.timestamp.now(); const balance = account.availableBalance - policy.costCoins; const revision = account.revision + 1;
      let expiresAt = null; let subscriptionId = null;
      const redemption = { ownerUid: uid, type, requestId, policyVersion: this.policy.version, costCoins: policy.costCoins, status: type === COIN_REDEMPTION_TYPES.CHALLENGE_PASS ? 'UNLOCKED' : type === COIN_REDEMPTION_TYPES.BRAND_THEME ? 'OWNED' : 'REDEEMED', occurrenceDate, assignmentId, themeId, transactionId, balanceAfter: balance, monthKey: month, createdAt: serverNow, schemaVersion: '1.0.0' };
      if (type === COIN_REDEMPTION_TYPES.PREMIUM_MONTH) {
        const storedEntitlement = entitlementSnap.exists ? entitlementSnap.data() : null;
        const backingRef = storedEntitlement?.subscriptionId ? this.db.doc(`users/${uid}/subscriptions/${storedEntitlement.subscriptionId}`) : null;
        const backingSnap = backingRef ? await tx.get(backingRef) : null;
        const current = resolvePremiumEntitlement(storedEntitlement, this.now(), backingSnap?.exists ? backingSnap.data() : null);
        const startsAtDate = current.active ? current.expiresAt : this.now(); expiresAt = this.timestamp.fromDate(addCalendarMonths(startsAtDate, 1));
        subscriptionId = digest('coin_sub', `${uid}\0${requestId}`); const subscriptionRef = this.db.doc(`users/${uid}/subscriptions/${subscriptionId}`);
        const plan = getSubscriptionPlan('monthly');
        const subscription = { ownerUid: uid, planId: plan.planId, planVersion: plan.version, priceMinor: plan.priceMinor, currency: plan.currency, status: SUBSCRIPTION_STATUSES.ACTIVE, startsAt: this.timestamp.fromDate(startsAtDate), expiresAt, source: SUBSCRIPTION_SOURCES.COIN_REDEMPTION, redemptionId, createdAt: serverNow, updatedAt: serverNow, schemaVersion: '1.0.0' };
        tx.create(subscriptionRef, subscription);
        tx.set(refs.entitlement, { ownerUid: uid, tier: 'PREMIUM', active: true, subscriptionId, planId: 'monthly', startsAt: subscription.startsAt, expiresAt, updatedAt: serverNow, schemaVersion: '1.0.0' }, { merge: false });
        Object.assign(redemption, { subscriptionId, expiresAt });
      }
      tx.set(refs.account, { ...account, availableBalance: balance, lifetimeSpent: account.lifetimeSpent + policy.costCoins, revision, updatedAt: serverNow, schemaVersion: '1.0.0', ...(accountSnap.exists ? {} : { createdAt: serverNow }) }, { merge: false });
      tx.create(refs.ledger, { ownerUid: uid, amount: policy.costCoins, direction: 'DEBIT', type: 'COIN_SPEND', sourceType: type === COIN_REDEMPTION_TYPES.CHALLENGE_PASS ? 'CHALLENGE_PASS' : type === COIN_REDEMPTION_TYPES.BRAND_THEME ? 'THEME_REDEMPTION' : 'PREMIUM_REDEMPTION', sourceId: redemptionId, idempotencyKey: requestId, redemptionId, redemptionType: type, occurrenceDate, themeId, subscriptionId, balanceAfter: balance, accountRevision: revision, policyVersion: this.policy.version, status: 'POSTED', createdAt: serverNow, schemaVersion: '1.0.0' });
      tx.create(refs.redemption, redemption);
      if (refs.ownership) tx.create(refs.ownership, { ownerUid: uid, themeId, redemptionId, status: 'OWNED', createdAt: serverNow, schemaVersion: '1.0.0' });
      if (refs.unlock) tx.create(refs.unlock, { ownerUid: uid, occurrenceDate, assignmentId, assignmentVersion, redemptionId, status: 'UNLOCKED', createdAt: serverNow, schemaVersion: '1.0.0' });
      if (usageField) tx.set(refs.usage, { ...usage, ownerUid: uid, monthKey: month, [usageField]: used + 1, updatedAt: serverNow, schemaVersion: '1.0.0' }, { merge: false });
      return { duplicate: false, redemptionId, transactionId, balance, type, occurrenceDate, themeId, expiresAt: serializedDate(expiresAt) };
    });
  }
}
