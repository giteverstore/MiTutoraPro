import { COIN_ACTIVITY_TYPES, enumValue, positiveInteger, requiredIdentifier } from './CoinModels.js';
import { failCoin } from './CoinError.js';

function key(activityType, activityId, policyVersion) {
  return `${activityType}\u0000${activityId}\u0000${policyVersion}`;
}

function activityKey(activityType, activityId, activityVersion) {
  return `${activityType}\u0000${activityId}\u0000${activityVersion}`;
}

function activityTypeKey(activityType, activityVersion) {
  return `${activityType}\u0000${activityVersion}`;
}

export const MVP_COIN_POLICY_VERSION = 'mvp-v1';
export const MVP_DAILY_ACTIVITY_COIN_CAP = 100;

export class CoinRewardPolicy {
  constructor(entries = []) {
    this.entries = new Map();
    this.activityEntries = new Map();
    this.activityTypeEntries = new Map();
    for (const entry of entries) {
      const normalized = {
        activityType: enumValue(entry.activityType, COIN_ACTIVITY_TYPES, 'activityType'),
        activityId: entry.activityId == null ? null : requiredIdentifier(entry.activityId, 'activityId'),
        policyVersion: requiredIdentifier(entry.policyVersion, 'policyVersion', 128),
        activityVersion: requiredIdentifier(entry.activityVersion ?? entry.policyVersion, 'activityVersion', 128),
        amount: positiveInteger(entry.amount),
        enabled: entry.enabled !== false,
      };
      const frozen = Object.freeze(normalized);
      if (normalized.activityId) {
        if (this.entries.has(key(normalized.activityType, normalized.activityId, normalized.policyVersion))
          || this.activityEntries.has(activityKey(normalized.activityType, normalized.activityId, normalized.activityVersion))) {
          failCoin('coin/reward-policy-conflict', 'Duplicate reward policy scope is not allowed.');
        }
        this.entries.set(key(normalized.activityType, normalized.activityId, normalized.policyVersion), frozen);
        this.activityEntries.set(activityKey(normalized.activityType, normalized.activityId, normalized.activityVersion), frozen);
      } else {
        if (this.activityTypeEntries.has(activityTypeKey(normalized.activityType, normalized.activityVersion))) {
          failCoin('coin/reward-policy-conflict', 'Duplicate reward policy scope is not allowed.');
        }
        this.activityTypeEntries.set(activityTypeKey(normalized.activityType, normalized.activityVersion), frozen);
      }
    }
  }

  getCoinRewardPolicy(activityTypeValue, activityIdValue, policyVersionValue) {
    const activityType = enumValue(activityTypeValue, COIN_ACTIVITY_TYPES, 'activityType');
    const activityId = requiredIdentifier(activityIdValue, 'activityId');
    const policyVersion = requiredIdentifier(policyVersionValue, 'policyVersion', 128);
    const policy = this.entries.get(key(activityType, activityId, policyVersion));
    if (!policy) failCoin('coin/reward-policy-missing', 'No approved coin reward policy is configured for this activity.');
    if (!policy.enabled) failCoin('coin/reward-policy-disabled', 'Coin rewards are not enabled for this activity.');
    return policy;
  }


  getActivityRewardPolicy(activityTypeValue, activityIdValue, activityVersionValue) {
    const activityType = enumValue(activityTypeValue, COIN_ACTIVITY_TYPES, 'activityType');
    const activityId = requiredIdentifier(activityIdValue, 'activityId');
    const activityVersion = requiredIdentifier(activityVersionValue, 'activityVersion', 128);
    const policy = this.activityEntries.get(activityKey(activityType, activityId, activityVersion))
      ?? this.activityTypeEntries.get(activityTypeKey(activityType, activityVersion));
    if (!policy) failCoin('coin/reward-policy-missing', 'No approved coin reward policy is configured for this activity.');
    if (!policy.enabled) failCoin('coin/reward-policy-disabled', 'Coin rewards are not enabled for this activity.');
    return policy;
  }
}

export const coinRewardPolicy = new CoinRewardPolicy([
  { activityType: COIN_ACTIVITY_TYPES.PRACTICE, activityVersion: 'v2', policyVersion: MVP_COIN_POLICY_VERSION, amount: 5, enabled: true },
  { activityType: COIN_ACTIVITY_TYPES.DAILY_CHALLENGE, activityVersion: 'v1', policyVersion: MVP_COIN_POLICY_VERSION, amount: 20, enabled: true },
  { activityType: COIN_ACTIVITY_TYPES.DAILY_LOGIN, activityVersion: 'v1', policyVersion: MVP_COIN_POLICY_VERSION, amount: 1, enabled: true },
]);
