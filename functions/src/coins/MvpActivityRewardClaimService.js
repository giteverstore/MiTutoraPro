import { Timestamp } from 'firebase-admin/firestore';
import {
  COIN_ACTIVITY_TYPES,
  COIN_TRANSACTION_TYPES,
  COMPLETION_ASSURANCES,
  activityRewardClaimIdentifier,
  digestIdentifier,
  enumValue,
  requiredIdentifier,
  requiredUid,
} from './CoinModels.js';
import { CoinError, failCoin } from './CoinError.js';
import { coinRewardPolicy, MVP_DAILY_ACTIVITY_COIN_CAP } from './CoinRewardPolicy.js';

const REQUEST_FIELDS = new Set(['activityType', 'activityId', 'activityVersion']);
const claimPath = (uid, id) => `users/${uid}/rewardClaims/${id}`;

function principalUid(principal) {
  if (principal?.authenticated !== true) failCoin('coin/unauthenticated', 'Authentication is required.');
  return requiredUid(principal.uid);
}

function normalizeRequest(input) {
  if (!input || Array.isArray(input) || typeof input !== 'object') failCoin('coin/invalid-request', 'The reward claim is invalid.');
  if (Object.keys(input).some((field) => !REQUEST_FIELDS.has(field))) {
    failCoin('coin/client-authority-rejected', 'Client-controlled reward fields are not accepted.');
  }
  return {
    activityType: enumValue(input.activityType, COIN_ACTIVITY_TYPES, 'activityType'),
    activityId: requiredIdentifier(input.activityId, 'activityId'),
    activityVersion: requiredIdentifier(input.activityVersion, 'activityVersion', 128),
  };
}

const failureStatus = (error) => ({
  'coin/reward-policy-disabled': 'policy_disabled',
  'coin/reward-policy-missing': 'activity_not_rewardable',
  'coin/activity-not-rewardable': 'activity_not_rewardable',
  'coin/daily-reward-cap-reached': 'daily_reward_cap_reached',
}[error.code]);

function platformDate(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export class MvpActivityRewardClaimService {
  constructor({ ledger, resolver, policy = coinRewardPolicy, timestamp = () => Timestamp.now(), now = () => new Date(), dailyCreditCap = MVP_DAILY_ACTIVITY_COIN_CAP }) {
    if (!ledger?.claimActivityReward || !resolver?.resolve) throw new TypeError('MVP reward claims require a ledger and canonical resolver.');
    this.ledger = ledger;
    this.resolver = resolver;
    this.policy = policy;
    this.timestamp = timestamp;
    this.now = now;
    this.dailyCreditCap = dailyCreditCap;
  }

  async claimActivityReward({ principal, request, dailyUsagePath = null }) {
    const uid = principalUid(principal);
    const normalized = normalizeRequest(request);
    const canonical = await this.resolver.resolve(normalized);
    if (!canonical) return Object.freeze({ status: 'activity_not_found' });
    if (canonical.activityType !== normalized.activityType || canonical.activityId !== normalized.activityId) {
      return Object.freeze({ status: 'activity_not_found' });
    }
    if (canonical.activityVersion !== normalized.activityVersion) return Object.freeze({ status: 'version_mismatch' });

    try {
      const reward = this.policy.getActivityRewardPolicy(canonical.activityType, canonical.activityId, canonical.activityVersion);
      const claimId = activityRewardClaimIdentifier(uid, canonical.activityType, canonical.activityId, canonical.activityVersion, reward.policyVersion, canonical.occurrence);
      const idempotencyKey = digestIdentifier('local_reward', [uid, canonical.activityType, canonical.activityId, canonical.activityVersion, reward.policyVersion, canonical.occurrence].join('\u0000'));
      const timestamp = this.timestamp();
      const result = await this.ledger.claimActivityReward({
        uid,
        amount: reward.amount,
        type: COIN_TRANSACTION_TYPES.ACTIVITY_REWARD,
        sourceType: canonical.activityType,
        sourceId: canonical.activityId,
        idempotencyKey,
        policyVersion: reward.policyVersion,
      }, {
        path: claimPath(uid, claimId),
        data: {
          ownerUid: uid,
          activityType: canonical.activityType,
          activityId: canonical.activityId,
          activityVersion: canonical.activityVersion,
          occurrence: canonical.occurrence || null,
          evidenceAssurance: COMPLETION_ASSURANCES.LOCAL_VERIFIED_ACTIVITY,
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
        verifyEligibility: async (transaction) => {
          const current = await this.resolver.resolve(normalized, { transaction });
          if (!current || current.activityType !== canonical.activityType || current.activityId !== canonical.activityId
            || current.activityVersion !== canonical.activityVersion || current.occurrence !== canonical.occurrence) {
            failCoin('coin/activity-not-rewardable', 'Canonical activity eligibility changed during the claim.');
          }
        },
        dailyCredit: {
          path: dailyUsagePath ?? `users/${uid}/activityUsage/${platformDate(this.now())}`,
          cap: this.dailyCreditCap,
        },
      });
      return Object.freeze({ status: result.duplicate ? 'already_claimed' : 'credited', claimId, amount: reward.amount, balance: result.balance, revision: result.revision });
    } catch (error) {
      if (error instanceof CoinError && failureStatus(error)) return Object.freeze({ status: failureStatus(error) });
      throw error;
    }
  }
}
