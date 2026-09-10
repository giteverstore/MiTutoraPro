import { createHash, randomBytes } from 'node:crypto';
import { getSubscriptionPlan } from '../subscriptions/SubscriptionPlans.js';
import { resolvePremiumEntitlement, SUBSCRIPTION_SOURCES } from '../subscriptions/SubscriptionService.js';
import { calculateReferralReward, REFERRAL_POLICY, referralRateForTier } from './ReferralPolicy.js';

const CODE_PATTERN = /^MIT[A-Z0-9]{6}$/;
const ATTRIBUTION_FIELDS = new Set(['referralCode']);
const SCHEMA_VERSION = '1.0.0';
const VERIFIED_PURCHASE = 'VERIFIED_PREMIUM_PURCHASE';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function fail(code, message) { throw Object.assign(new Error(message), { code }); }
function snapshotData(snapshot) { return snapshot?.exists ? snapshot.data() : null; }

export function normalizeReferralCode(value) {
  const code = String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '');
  if (!CODE_PATTERN.test(code)) fail('referral/invalid-code', 'Enter a valid referral code.');
  return code;
}

export function createReferralCode(bytes = randomBytes(6)) {
  return `MIT${Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('')}`;
}

function referralIdFor(uid) { return createHash('sha256').update(`m5-referral\0${uid}`).digest('hex'); }
function safeReadModel(record) {
  return {
    referralId: record.referralId,
    status: record.status,
    attributedAt: record.attributedAt,
    ...(record.status === 'QUALIFIED' ? {
      qualifiedAt: record.qualifiedAt,
      qualifyingPlanId: record.qualifyingPlanId,
      qualifyingAmountMinor: record.qualifyingAmountMinor,
      currency: record.currency,
      referrerTierAtQualification: record.referrerTierAtQualification,
      rewardRateBps: record.rewardRateBps,
      calculatedRewardMinor: record.calculatedRewardMinor,
      policyVersion: record.policyVersion,
    } : {}),
    schemaVersion: SCHEMA_VERSION,
  };
}

export class ReferralService {
  constructor({ db, timestamp, now = () => new Date(), codeFactory = createReferralCode, policy = REFERRAL_POLICY }) {
    if (!db?.runTransaction || !timestamp?.now) throw new TypeError('ReferralService requires Firestore and a timestamp factory.');
    this.db = db; this.timestamp = timestamp; this.now = now; this.codeFactory = codeFactory; this.policy = policy;
  }

  async ensureReferralIdentity(principal) {
    const ownerUid = principal?.uid;
    if (!ownerUid) fail('referral/unauthenticated', 'Authentication is required.');
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = normalizeReferralCode(this.codeFactory());
      try {
        return await this.db.runTransaction(async (tx) => {
          const identityRef = this.db.doc(`users/${ownerUid}/referralIdentity/current`);
          const identity = await tx.get(identityRef);
          if (identity.exists) return { ...identity.data(), created: false };
          const codeRef = this.db.doc(`referralCodes/${code}`);
          if ((await tx.get(codeRef)).exists) fail('referral/code-collision', 'Referral code collision.');
          const createdAt = this.timestamp.now();
          const document = { code, ownerUid, active: true, createdAt, schemaVersion: SCHEMA_VERSION };
          tx.create(codeRef, document);
          tx.create(identityRef, document);
          return { ...document, created: true };
        });
      } catch (error) {
        if (error.code !== 'referral/code-collision') throw error;
      }
    }
    fail('referral/code-exhausted', 'Unable to allocate a referral code.');
  }

  async attributeReferral({ principal, request }) {
    const referredUid = principal?.uid;
    if (!referredUid) fail('referral/unauthenticated', 'Authentication is required.');
    if (!request || typeof request !== 'object' || Array.isArray(request) || Object.keys(request).some((key) => !ATTRIBUTION_FIELDS.has(key))) {
      fail('referral/client-authority-rejected', 'Only a referral code may be submitted.');
    }
    const code = normalizeReferralCode(request.referralCode);
    return this.db.runTransaction(async (tx) => {
      const codeData = snapshotData(await tx.get(this.db.doc(`referralCodes/${code}`)));
      if (!codeData) fail('referral/code-not-found', 'That referral code does not exist.');
      if (codeData.active !== true) fail('referral/code-inactive', 'That referral code is inactive.');
      if (codeData.ownerUid === referredUid) fail('referral/self-referral', 'You cannot use your own referral code.');
      const attributionRef = this.db.doc(`users/${referredUid}/referralAttribution/current`);
      if ((await tx.get(attributionRef)).exists) fail('referral/already-attributed', 'A referral is already attached to this account.');
      const referralId = referralIdFor(referredUid);
      const referralRef = this.db.doc(`referrals/${referralId}`);
      if ((await tx.get(referralRef)).exists) fail('referral/already-attributed', 'A referral is already attached to this account.');
      const attributedAt = this.timestamp.now();
      const attribution = { referredUid, referrerUid: codeData.ownerUid, referralCode: code, status: 'ATTRIBUTED', attributedAt, policyVersionAtAttribution: this.policy.policyVersion, schemaVersion: SCHEMA_VERSION };
      const record = { referralId, ...attribution };
      tx.create(attributionRef, attribution);
      tx.create(referralRef, record);
      tx.create(this.db.doc(`users/${codeData.ownerUid}/referralReadModel/${referralId}`), safeReadModel(record));
      return { referralId, status: 'ATTRIBUTED' };
    });
  }

  async qualifyReferralFromVerifiedPurchase(event) {
    if (!event || event.evidenceType !== VERIFIED_PURCHASE || event.trusted !== true) fail('referral/untrusted-purchase', 'Trusted purchase evidence is required.');
    if (event.source !== SUBSCRIPTION_SOURCES.PAYMENT) fail('referral/non-qualifying-source', 'Only verified payment evidence qualifies referrals.');
    if (!/^[A-Za-z0-9_-]{8,160}$/.test(event.purchaseId ?? '') || !event.purchaserUid) fail('referral/invalid-purchase', 'Purchase identity is invalid.');
    const plan = getSubscriptionPlan(event.planId);
    if (event.amountMinor !== plan.priceMinor || event.currency !== plan.currency) fail('referral/purchase-mismatch', 'Purchase evidence does not match the canonical plan.');
    return this.db.runTransaction(async (tx) => {
      const eventRef = this.db.doc(`referralPurchaseQualifications/${event.purchaseId}`);
      const storedEvent = snapshotData(await tx.get(eventRef));
      const fingerprint = createHash('sha256').update([
        event.evidenceType, event.source, event.purchaserUid, plan.planId,
        String(plan.priceMinor), plan.currency,
      ].join('\0')).digest('hex');
      if (storedEvent) {
        if (storedEvent.fingerprint !== fingerprint) fail('referral/purchase-conflict', 'Purchase identity was reused with conflicting evidence.');
        return { duplicate: true, qualified: true, ...storedEvent.result };
      }
      const attribution = snapshotData(await tx.get(this.db.doc(`users/${event.purchaserUid}/referralAttribution/current`)));
      if (!attribution) return { qualified: false, reason: 'NO_ATTRIBUTION' };
      const referralRef = this.db.doc(`referrals/${referralIdFor(event.purchaserUid)}`);
      const record = snapshotData(await tx.get(referralRef));
      if (!record) fail('referral/integrity-failure', 'Referral attribution is incomplete.');
      if (record.status === 'QUALIFIED') return { qualified: false, reason: 'FIRST_PURCHASE_ALREADY_QUALIFIED' };
      const entitlementRef = this.db.doc(`users/${record.referrerUid}/entitlements/premium`);
      const entitlement = snapshotData(await tx.get(entitlementRef));
      const subscription = entitlement?.subscriptionId
        ? snapshotData(await tx.get(this.db.doc(`users/${record.referrerUid}/subscriptions/${entitlement.subscriptionId}`))) : null;
      const tier = resolvePremiumEntitlement(entitlement, this.now(), subscription).tier;
      const rateBps = referralRateForTier(tier, this.policy);
      const qualifiedAt = this.timestamp.now();
      const qualified = { ...record, status: 'QUALIFIED', qualifiedAt, qualifyingPurchaseReference: event.purchaseId, qualifyingPlanId: plan.planId, qualifyingAmountMinor: plan.priceMinor, currency: plan.currency, referrerTierAtQualification: tier, rewardRateBps: rateBps, calculatedRewardMinor: calculateReferralReward(plan.priceMinor, rateBps), policyVersion: this.policy.policyVersion, walletSettlementStatus: 'UNSETTLED' };
      tx.set(referralRef, qualified, { merge: false });
      tx.set(this.db.doc(`users/${event.purchaserUid}/referralAttribution/current`), { ...attribution, status: 'QUALIFIED' }, { merge: false });
      tx.set(this.db.doc(`users/${record.referrerUid}/referralReadModel/${record.referralId}`), safeReadModel(qualified), { merge: false });
      const result = safeReadModel(qualified);
      tx.create(eventRef, { purchaseId: event.purchaseId, purchaserUid: event.purchaserUid, referralId: record.referralId, fingerprint, status: 'QUALIFIED', result, createdAt: qualifiedAt, schemaVersion: SCHEMA_VERSION });
      return { duplicate: false, qualified: true, ...result };
    });
  }
}
