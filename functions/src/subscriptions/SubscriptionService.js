import { createHash } from 'node:crypto';
import { getSubscriptionPlan } from './SubscriptionPlans.js';

const REQUEST_FIELDS = new Set(['planId', 'requestId']);
export const SUBSCRIPTION_STATUSES = Object.freeze({ ACTIVE: 'ACTIVE', EXPIRED: 'EXPIRED', CANCELLED: 'CANCELLED' });
export const SUBSCRIPTION_SOURCES = Object.freeze({ DEVELOPMENT_GRANT: 'DEVELOPMENT_GRANT', PAYMENT: 'PAYMENT' });

function fail(code, message) { throw Object.assign(new Error(message), { code }); }
function dateOf(value) { return value?.toDate?.() ?? (value instanceof Date ? value : null); }
function uid(principal) {
  if (!principal?.uid) fail('subscription/unauthenticated', 'Authentication is required.');
  return principal.uid;
}
function request(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object' || Object.keys(value).some((key) => !REQUEST_FIELDS.has(key))) {
    fail('subscription/client-authority-rejected', 'Client-controlled subscription fields are not accepted.');
  }
  if (typeof value.requestId !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(value.requestId)) fail('subscription/invalid-request', 'A valid grant request identity is required.');
  return { plan: getSubscriptionPlan(value.planId), requestId: value.requestId };
}

export function addCalendarMonths(dateValue, months) {
  const date = new Date(dateValue);
  const day = date.getUTCDate();
  const target = new Date(date.getTime());
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

export function resolvePremiumEntitlement(entitlement, now = new Date(), subscription = null) {
  const expiresAt = dateOf(entitlement?.expiresAt);
  const backed = typeof entitlement?.subscriptionId === 'string'
    && subscription?.status === SUBSCRIPTION_STATUSES.ACTIVE
    && subscription?.ownerUid === entitlement?.ownerUid
    && subscription?.planId === entitlement?.planId;
  if (!backed || entitlement?.active !== true || entitlement?.tier !== 'PREMIUM' || !expiresAt || expiresAt.getTime() <= now.getTime()) {
    return Object.freeze({ tier: 'FREE', active: false, planId: null, expiresAt: null });
  }
  return Object.freeze({ tier: 'PREMIUM', active: true, planId: entitlement.planId, expiresAt });
}

export function subscriptionGrantsPremium(subscription, now = new Date()) {
  return subscription?.status === SUBSCRIPTION_STATUSES.ACTIVE && (dateOf(subscription.expiresAt)?.getTime() ?? 0) > now.getTime();
}

export class SubscriptionService {
  constructor({ db, timestamp, now = () => new Date() }) {
    if (!db?.runTransaction || !timestamp?.fromDate || !timestamp?.now) throw new TypeError('SubscriptionService requires Firestore and a timestamp factory.');
    this.db = db; this.timestamp = timestamp; this.now = now;
  }

  async hasPremiumAccess(uidValue) {
    const snapshot = await this.db.doc(`users/${uidValue}/entitlements/premium`).get();
    if (!snapshot.exists) return resolvePremiumEntitlement(null, this.now());
    const entitlement = snapshot.data();
    const subscription = entitlement.subscriptionId
      ? await this.db.doc(`users/${uidValue}/subscriptions/${entitlement.subscriptionId}`).get() : null;
    return resolvePremiumEntitlement(entitlement, this.now(), subscription?.exists ? subscription.data() : null);
  }

  async grantDevelopmentPlan({ principal, request: input }) {
    const ownerUid = uid(principal);
    const { plan, requestId } = request(input);
    const subscriptionId = `dev_${createHash('sha256').update(`${ownerUid}\0${requestId}`).digest('hex')}`;
    const subscriptionRef = this.db.doc(`users/${ownerUid}/subscriptions/${subscriptionId}`);
    const entitlementRef = this.db.doc(`users/${ownerUid}/entitlements/premium`);
    const now = this.now();
    const serverNow = this.timestamp.now();
    return this.db.runTransaction(async (transaction) => {
      const entitlementSnapshot = await transaction.get(entitlementRef);
      const storedEntitlement = entitlementSnapshot.exists ? entitlementSnapshot.data() : null;
      const backingRef = storedEntitlement?.subscriptionId ? this.db.doc(`users/${ownerUid}/subscriptions/${storedEntitlement.subscriptionId}`) : null;
      const snapshots = await transaction.getAll(subscriptionRef, ...(backingRef ? [backingRef] : []));
      const [existing, backingSnapshot] = snapshots;
      const current = resolvePremiumEntitlement(storedEntitlement, now, backingSnapshot?.exists ? backingSnapshot.data() : null);
      if (existing.exists) {
        const backingSubscription = backingSnapshot?.exists
          ? backingSnapshot.data()
          : storedEntitlement?.subscriptionId === subscriptionId
            ? existing.data()
            : null;
        return {
          duplicate: true,
          subscriptionId,
          entitlement: resolvePremiumEntitlement(storedEntitlement, now, backingSubscription),
        };
      }
      const startsAtDate = current.active ? current.expiresAt : now;
      const expiresAtDate = addCalendarMonths(startsAtDate, plan.durationMonths);
      const startsAt = this.timestamp.fromDate(startsAtDate);
      const expiresAt = this.timestamp.fromDate(expiresAtDate);
      const subscription = {
        ownerUid, planId: plan.planId, planVersion: plan.version, priceMinor: plan.priceMinor,
        currency: plan.currency, status: SUBSCRIPTION_STATUSES.ACTIVE, startsAt, expiresAt,
        source: SUBSCRIPTION_SOURCES.DEVELOPMENT_GRANT, createdAt: serverNow, updatedAt: serverNow, schemaVersion: '1.0.0',
      };
      const entitlement = {
        ownerUid, tier: 'PREMIUM', active: true, subscriptionId, planId: plan.planId,
        startsAt, expiresAt, updatedAt: serverNow, schemaVersion: '1.0.0',
      };
      transaction.create(subscriptionRef, subscription);
      transaction.set(entitlementRef, entitlement, { merge: false });
      return { duplicate: false, subscriptionId, entitlement: resolvePremiumEntitlement(entitlement, now, subscription) };
    });
  }
}
