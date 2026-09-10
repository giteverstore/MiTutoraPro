import { Timestamp } from 'firebase-admin/firestore';
import {
  COIN_ACTIVITY_TYPES,
  COIN_TRANSACTION_TYPES,
  COMPLETION_ASSURANCES,
  claimIdentifier,
  digestIdentifier,
  enumValue,
  requiredEvidenceReference,
  requiredIdentifier,
  requiredUid,
} from './CoinModels.js';
import { failCoin } from './CoinError.js';
import { coinRewardPolicy } from './CoinRewardPolicy.js';

const claimPath = (uid, claimId) => `users/${uid}/rewardClaims/${claimId}`;

function authenticatedUid(principal) {
  if (principal?.authenticated !== true) failCoin('coin/unauthenticated', 'An authenticated server principal is required.');
  return requiredUid(principal.uid);
}

function normalizeActivity(input) {
  return {
    activityType: enumValue(input.activityType, COIN_ACTIVITY_TYPES, 'activityType'),
    activityId: requiredIdentifier(input.activityId, 'activityId'),
    evidenceReference: requiredEvidenceReference(input.evidenceReference),
    evidenceAssurance: enumValue(input.evidenceAssurance, COMPLETION_ASSURANCES, 'evidenceAssurance'),
    policyVersion: requiredIdentifier(input.policyVersion, 'policyVersion', 128),
  };
}

function sameCompletion(current, expected) {
  return current.ownerUid === expected.ownerUid
    && current.activityType === expected.activityType
    && current.activityId === expected.activityId
    && current.evidenceReference === expected.evidenceReference
    && current.evidenceAssurance === expected.evidenceAssurance
    && current.policyVersion === expected.policyVersion;
}

export class RewardClaimService {
  constructor({ db, ledger, policy = coinRewardPolicy, timestamp = () => Timestamp.now() }) {
    if (!db?.doc || !db?.runTransaction) throw new TypeError('RewardClaimService requires Firestore.');
    if (!ledger?.grantCoins) throw new TypeError('RewardClaimService requires CoinLedgerService.');
    this.db = db;
    this.ledger = ledger;
    this.policy = policy;
    this.timestamp = timestamp;
  }

  async recordCompletion({ principal, ...input }) {
    const uid = authenticatedUid(principal);
    const activity = normalizeActivity(input);
    const claimId = claimIdentifier(uid, activity.activityType, activity.activityId);
    const reference = this.db.doc(claimPath(uid, claimId));
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (snapshot.exists) {
        if (!sameCompletion(snapshot.data(), { ownerUid: uid, ...activity })) {
          failCoin('coin/claim-conflict', 'The activity already has different completion evidence.');
        }
        return { claimId, duplicate: true, ...snapshot.data() };
      }
      const timestamp = this.timestamp();
      const claim = {
        ownerUid: uid,
        activityType: activity.activityType,
        activityId: activity.activityId,
        evidenceReference: activity.evidenceReference,
        evidenceAssurance: activity.evidenceAssurance,
        completionStatus: 'COMPLETED',
        rewardStatus: 'NOT_GRANTED',
        rewardTransactionId: null,
        policyVersion: activity.policyVersion,
        createdAt: timestamp,
        completedAt: timestamp,
        rewardedAt: null,
        schemaVersion: '1.0.0',
      };
      transaction.create(reference, claim);
      return { claimId, duplicate: false, ...claim };
    });
  }

  async grantConfiguredReward({ principal, activityType, activityId, policyVersion }) {
    const uid = authenticatedUid(principal);
    const normalizedType = enumValue(activityType, COIN_ACTIVITY_TYPES, 'activityType');
    const normalizedId = requiredIdentifier(activityId, 'activityId');
    const normalizedVersion = requiredIdentifier(policyVersion, 'policyVersion', 128);
    const policy = this.policy.getCoinRewardPolicy(normalizedType, normalizedId, normalizedVersion);
    const claimId = claimIdentifier(uid, normalizedType, normalizedId);
    return this.ledger.grantCoins({
      uid,
      amount: policy.amount,
      type: COIN_TRANSACTION_TYPES.ACTIVITY_REWARD,
      sourceType: normalizedType,
      sourceId: normalizedId,
      idempotencyKey: digestIdentifier('reward', `${uid}\u0000${normalizedType}\u0000${normalizedId}`),
      policyVersion: normalizedVersion,
    }, {
      claim: {
        path: claimPath(uid, claimId),
        activityType: normalizedType,
        activityId: normalizedId,
      },
    });
  }
}
