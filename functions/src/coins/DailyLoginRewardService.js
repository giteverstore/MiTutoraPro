import { Timestamp } from 'firebase-admin/firestore';
import {
  COIN_ACTIVITY_TYPES,
  COIN_TRANSACTION_TYPES,
  COMPLETION_ASSURANCES,
  activityRewardClaimIdentifier,
  digestIdentifier,
  requiredUid,
} from './CoinModels.js';
import { coinRewardPolicy, MVP_COIN_POLICY_VERSION, MVP_DAILY_ACTIVITY_COIN_CAP } from './CoinRewardPolicy.js';
import { failCoin } from './CoinError.js';

export const DAILY_LOGIN_TIMEZONE = 'Asia/Kolkata';
export const DAILY_LOGIN_ACTIVITY_VERSION = 'v1';

export function dailyLoginCalendarDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) failCoin('coin/invalid-date', 'The server date is invalid.');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: DAILY_LOGIN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date).filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export class DailyLoginRewardService {
  constructor({
    ledger,
    policy = coinRewardPolicy,
    now = () => new Date(),
    timestamp = () => Timestamp.now(),
    dailyCreditCap = MVP_DAILY_ACTIVITY_COIN_CAP,
  }) {
    if (!ledger?.claimActivityReward) throw new TypeError('DailyLoginRewardService requires the coin ledger.');
    this.ledger = ledger;
    this.policy = policy;
    this.now = now;
    this.timestamp = timestamp;
    this.dailyCreditCap = dailyCreditCap;
  }

  async claim({ principal, request }) {
    if (principal?.authenticated !== true) failCoin('coin/unauthenticated', 'Authentication is required.');
    const uid = requiredUid(principal.uid);
    if (request == null) request = {};
    if (Array.isArray(request) || typeof request !== 'object' || Object.keys(request).length !== 0) {
      failCoin('coin/client-authority-rejected', 'Daily login reward inputs are server-owned.');
    }

    const calendarDate = dailyLoginCalendarDate(this.now());
    const reward = this.policy.getActivityRewardPolicy(
      COIN_ACTIVITY_TYPES.DAILY_LOGIN,
      calendarDate,
      DAILY_LOGIN_ACTIVITY_VERSION,
    );
    const claimId = activityRewardClaimIdentifier(
      uid,
      COIN_ACTIVITY_TYPES.DAILY_LOGIN,
      calendarDate,
      DAILY_LOGIN_ACTIVITY_VERSION,
      reward.policyVersion,
      calendarDate,
    );
    const idempotencyKey = digestIdentifier('daily_login', [
      uid,
      COIN_ACTIVITY_TYPES.DAILY_LOGIN,
      calendarDate,
      reward.policyVersion,
    ].join('\u0000'));
    const timestamp = this.timestamp();
    const result = await this.ledger.claimActivityReward({
      uid,
      amount: reward.amount,
      type: COIN_TRANSACTION_TYPES.ACTIVITY_REWARD,
      sourceType: COIN_ACTIVITY_TYPES.DAILY_LOGIN,
      sourceId: calendarDate,
      idempotencyKey,
      policyVersion: reward.policyVersion,
    }, {
      path: `users/${uid}/rewardClaims/${claimId}`,
      data: {
        ownerUid: uid,
        activityType: COIN_ACTIVITY_TYPES.DAILY_LOGIN,
        activityId: calendarDate,
        activityVersion: DAILY_LOGIN_ACTIVITY_VERSION,
        occurrence: calendarDate,
        evidenceAssurance: COMPLETION_ASSURANCES.TRUSTED_ACTIVITY,
        completionStatus: 'COMPLETED',
        rewardStatus: 'NOT_GRANTED',
        rewardTransactionId: null,
        policyVersion: reward.policyVersion,
        createdAt: timestamp,
        completedAt: timestamp,
        rewardedAt: null,
        schemaVersion: '1.0.0',
      },
    }, {
      verifyEligibility: async () => {
        if (dailyLoginCalendarDate(this.now()) !== calendarDate) {
          failCoin('coin/activity-not-rewardable', 'The authoritative login day changed during the claim.');
        }
      },
      dailyCredit: {
        path: `users/${uid}/activityUsage/${calendarDate}`,
        cap: this.dailyCreditCap,
        createIfMissing: true,
      },
    });

    return Object.freeze({
      status: result.duplicate ? 'already_claimed' : 'credited',
      rewardAmount: result.duplicate ? 0 : reward.amount,
      balance: result.balance,
      revision: result.revision,
    });
  }
}
