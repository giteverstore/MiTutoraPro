import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { COIN_ACTIVITY_TYPES, COMPLETION_ASSURANCES, enumValue, requiredIdentifier, requiredUid } from './CoinModels.js';
import { failCoin } from './CoinError.js';

export const MVP_ACTIVITY_TIMEZONE = 'Asia/Kolkata';
export const MVP_ACTIVITY_LIMITS = Object.freeze({ attemptsPerDay: 120, completionsPerDay: 100, rewardClaimsPerDay: 50 });
const REQUEST_FIELDS = new Set(['activityType', 'activityId', 'activityVersion']);

function identity(prefix, parts) {
  return `${prefix}_${createHash('sha256').update(parts.join('\u0000')).digest('hex')}`;
}

function dateParts(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: MVP_ACTIVITY_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function daysBetween(first, second) {
  return Math.round((Date.parse(`${second}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) / 86_400_000);
}

function normalize(principal, request) {
  if (principal?.authenticated !== true) failCoin('coin/unauthenticated', 'Authentication is required.');
  const uid = requiredUid(principal.uid);
  if (!request || Array.isArray(request) || typeof request !== 'object') failCoin('coin/invalid-request', 'The completion request is invalid.');
  if (Object.keys(request).some((field) => !REQUEST_FIELDS.has(field))) failCoin('coin/client-authority-rejected', 'Client-controlled completion fields are not accepted.');
  return {
    uid,
    activityType: enumValue(request.activityType, COIN_ACTIVITY_TYPES, 'activityType'),
    activityId: requiredIdentifier(request.activityId, 'activityId'),
    activityVersion: requiredIdentifier(request.activityVersion, 'activityVersion', 128),
  };
}

export class MvpActivityCompletionService {
  constructor({ db, resolver, rewardService, now = () => new Date(), timestamp = () => Timestamp.now(), limits = MVP_ACTIVITY_LIMITS }) {
    if (!db?.doc || !db?.runTransaction || !resolver?.resolve || !rewardService?.claimActivityReward) throw new TypeError('Activity completion requires Firestore, canonical resolution, and reward service.');
    this.db = db; this.resolver = resolver; this.rewardService = rewardService; this.now = now; this.timestamp = timestamp; this.limits = limits;
  }

  async complete({ principal, request }) {
    const input = normalize(principal, request);
    const canonical = await this.resolver.resolve(input);
    if (!canonical) return { completionStatus: 'activity_not_found', rewardStatus: 'not_requested', streakStatus: 'not_requested' };
    if (canonical.activityVersion !== input.activityVersion) return { completionStatus: 'version_mismatch', rewardStatus: 'not_requested', streakStatus: 'not_requested' };
    const occurrenceDate = canonical.occurrence || null;
    const eventDate = occurrenceDate || dateParts(this.now());
    const completionId = identity('completion', [input.uid, input.activityType, input.activityId, input.activityVersion, occurrenceDate ?? '']);
    const completionRef = this.db.doc(`users/${input.uid}/activityCompletions/${completionId}`);
    const usageRef = this.db.doc(`users/${input.uid}/activityUsage/${dateParts(this.now())}`);
    const timestamp = this.timestamp();

    const persisted = await this.db.runTransaction(async (transaction) => {
      const [completionSnapshot, usageSnapshot] = await transaction.getAll(completionRef, usageRef);
      const usage = usageSnapshot.exists ? usageSnapshot.data() : { completionAttempts: 0, successfulCompletions: 0, rewardClaims: 0, rewardCoinsCredited: 0 };
      if (usage.completionAttempts >= this.limits.attemptsPerDay) failCoin('coin/activity-rate-limited', 'The daily activity submission limit was reached.');
      if (completionSnapshot.exists) {
        transaction.set(usageRef, { ...usage, completionAttempts: usage.completionAttempts + 1, updatedAt: timestamp, schemaVersion: '1.0.0' }, { merge: false });
        return { duplicate: true, completion: completionSnapshot.data() };
      }
      const current = await this.resolver.resolve(input, { transaction });
      if (!current || current.activityVersion !== canonical.activityVersion || current.occurrence !== canonical.occurrence) failCoin('coin/activity-not-rewardable', 'Canonical activity eligibility changed.');
      if (usage.successfulCompletions >= this.limits.completionsPerDay) failCoin('coin/activity-limit-reached', 'The daily completion limit was reached.');
      const completion = {
        ownerUid: input.uid, activityType: input.activityType, activityId: input.activityId, activityVersion: input.activityVersion,
        occurrenceDate, verificationAssurance: COMPLETION_ASSURANCES.LOCAL_VERIFIED_ACTIVITY, completionStatus: 'COMPLETED',
        completedAt: timestamp, firstCompletedAt: timestamp, lastCompletedAt: timestamp, completionCount: 1,
        rewardClaimId: null, rewardStatus: 'PENDING', streakStatus: 'PENDING', eventDate, schemaVersion: '1.0.0',
      };
      transaction.create(completionRef, completion);
      transaction.set(usageRef, { ...usage, completionAttempts: usage.completionAttempts + 1, successfulCompletions: usage.successfulCompletions + 1, rewardClaims: usage.rewardClaims, updatedAt: timestamp, schemaVersion: '1.0.0' }, { merge: false });
      return { duplicate: false, completion };
    });

    let streak;
    try {
      streak = await this.#reconcileStreak(input.uid, completionRef, completionId, persisted.completion.eventDate);
    } catch {
      streak = { status: 'pending', summary: null };
    }
    let reward = { status: persisted.duplicate && persisted.completion.rewardStatus === 'CREDITED'
      ? 'already_claimed'
      : String(persisted.completion.rewardStatus).toLowerCase() };
    if (['pending', 'unavailable'].includes(reward.status)) {
      let rewardAllowed = null;
      try { rewardAllowed = await this.#reserveRewardAttempt(usageRef); } catch { reward = { status: 'unavailable' }; }
      if (rewardAllowed === false) reward = { status: 'daily_limit_reached' };
      else if (rewardAllowed === true) {
        try {
          reward = await this.rewardService.claimActivityReward({ principal, request, dailyUsagePath: usageRef.path });
        } catch {
          reward = { status: 'unavailable' };
        }
      }
      try { await this.#recordRewardOutcome(completionRef, reward.status, reward.claimId ?? null); } catch { /* durable completion remains retryable */ }
    }
    return {
      completionStatus: persisted.duplicate ? 'already_completed' : 'completed',
      rewardStatus: reward.status,
      rewardAmount: reward.status === 'credited' ? reward.amount : 0,
      balance: reward.balance ?? null,
      streakStatus: streak.status,
      streak: streak.summary,
    };
  }

  async #reserveRewardAttempt(usageRef) {
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(usageRef);
      const usage = snapshot.exists ? snapshot.data() : { completionAttempts: 0, successfulCompletions: 0, rewardClaims: 0, rewardCoinsCredited: 0 };
      if (usage.rewardClaims >= this.limits.rewardClaimsPerDay) return false;
      transaction.update(usageRef, { rewardClaims: usage.rewardClaims + 1, updatedAt: this.timestamp() });
      return true;
    });
  }

  async #reconcileStreak(uid, completionRef, eventId, eventDate) {
    const streakRef = this.db.doc(`users/${uid}/streak/summary`);
    const eventRef = this.db.doc(`users/${uid}/streakEvents/${eventId}`);
    return this.db.runTransaction(async (transaction) => {
      const [streakSnapshot, eventSnapshot, completionSnapshot] = await transaction.getAll(streakRef, eventRef, completionRef);
      if (eventSnapshot.exists) return { status: 'already_applied', summary: streakSnapshot.exists ? streakSnapshot.data() : null };
      if (!completionSnapshot.exists) failCoin('coin/completion-required', 'Durable completion is required for streak reconciliation.');
      const previous = streakSnapshot.exists ? streakSnapshot.data() : { currentStreak: 0, longestStreak: 0, lastQualifiedDate: null, revision: 0 };
      let currentStreak = previous.currentStreak;
      let lastQualifiedDate = previous.lastQualifiedDate;
      if (!lastQualifiedDate) { currentStreak = 1; lastQualifiedDate = eventDate; }
      else if (eventDate > lastQualifiedDate) {
        currentStreak = daysBetween(lastQualifiedDate, eventDate) === 1 ? currentStreak + 1 : 1;
        lastQualifiedDate = eventDate;
      }
      const summary = { currentStreak, longestStreak: Math.max(previous.longestStreak, currentStreak), lastQualifiedDate, revision: previous.revision + 1, updatedAt: this.timestamp(), schemaVersion: '1.0.0' };
      transaction.set(streakRef, summary, { merge: false });
      transaction.create(eventRef, { ownerUid: uid, completionId: eventId, eventDate, createdAt: this.timestamp(), schemaVersion: '1.0.0' });
      transaction.update(completionRef, { streakStatus: 'APPLIED' });
      return { status: 'applied', summary };
    });
  }

  async #recordRewardOutcome(completionRef, rewardStatus, rewardClaimId) {
    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(completionRef);
      if (!snapshot.exists) return;
      transaction.update(completionRef, { rewardStatus: rewardStatus.toUpperCase(), rewardClaimId, lastCompletedAt: this.timestamp() });
    });
  }
}
