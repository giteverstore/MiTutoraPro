import { createHash } from 'node:crypto';
import { failCoin } from './CoinError.js';

export const COIN_DIRECTIONS = Object.freeze({ CREDIT: 'CREDIT', DEBIT: 'DEBIT' });
export const COIN_TRANSACTION_TYPES = Object.freeze({
  ACTIVITY_REWARD: 'ACTIVITY_REWARD',
  COIN_SPEND: 'COIN_SPEND',
});
export const COIN_TRANSACTION_STATUSES = Object.freeze({ POSTED: 'POSTED', REVERSED: 'REVERSED' });
export const COIN_ACTIVITY_TYPES = Object.freeze({ PRACTICE: 'PRACTICE', DAILY_CHALLENGE: 'DAILY_CHALLENGE', DAILY_LOGIN: 'DAILY_LOGIN' });
export const COIN_SOURCE_TYPES = Object.freeze({
  PRACTICE: 'PRACTICE',
  DAILY_CHALLENGE: 'DAILY_CHALLENGE',
  DAILY_LOGIN: 'DAILY_LOGIN',
  SYSTEM: 'SYSTEM',
});
export const COMPLETION_ASSURANCES = Object.freeze({
  LOCAL_VERIFIED_ACTIVITY: 'LOCAL_VERIFIED_ACTIVITY',
  SERVER_GRADED: 'SERVER_GRADED',
  SERVER_VALIDATED_EXECUTION: 'SERVER_VALIDATED_EXECUTION',
  TRUSTED_ACTIVITY: 'TRUSTED_ACTIVITY',
});

const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export function requiredIdentifier(value, label, maximum = 256) {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.length > maximum || !SAFE_IDENTIFIER.test(normalized)) {
    failCoin('coin/invalid-argument', `${label} must be a valid bounded identifier.`);
  }
  return normalized;
}

export function requiredUid(value) {
  const uid = typeof value === 'string' ? value : '';
  if (!uid || uid.length > 128 || uid.includes('/') || /[\u0000-\u001f\u007f]/.test(uid)) {
    failCoin('coin/invalid-argument', 'uid must be a valid Firebase identity segment.');
  }
  return uid;
}

export function requiredEvidenceReference(value) {
  const normalized = String(value ?? '').trim();
  const segments = normalized.split('/');
  if (!normalized || normalized.length > 512 || segments.some((segment) => !SAFE_IDENTIFIER.test(segment))) {
    failCoin('coin/invalid-argument', 'evidenceReference must be a valid bounded server reference.');
  }
  return normalized;
}

export function positiveInteger(value, label = 'amount') {
  if (!Number.isSafeInteger(value) || value <= 0) {
    failCoin('coin/invalid-amount', `${label} must be a positive safe integer.`);
  }
  return value;
}

export function nonNegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    failCoin('coin/data-integrity', `${label} must be a non-negative safe integer.`);
  }
  return value;
}

export function enumValue(value, allowed, label) {
  if (!Object.values(allowed).includes(value)) {
    failCoin('coin/invalid-argument', `${label} is not supported.`);
  }
  return value;
}

export function digestIdentifier(namespace, value) {
  return `${namespace}_${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

export function mutationFingerprint(mutation) {
  const canonical = [
    mutation.uid,
    mutation.amount,
    mutation.direction,
    mutation.type,
    mutation.sourceType,
    mutation.sourceId,
    mutation.idempotencyKey,
    mutation.policyVersion,
  ].join('\u0000');
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function claimIdentifier(uid, activityType, activityId) {
  return digestIdentifier('claim', `${uid}\u0000${activityType}\u0000${activityId}`);
}

export function activityRewardClaimIdentifier(uid, activityType, activityId, activityVersion, policyVersion, occurrence = '') {
  return digestIdentifier('claim', [uid, activityType, activityId, activityVersion, policyVersion, occurrence].join('\u0000'));
}

export function validateAccount(data) {
  if (!data) return null;
  return {
    availableBalance: nonNegativeInteger(data.availableBalance, 'availableBalance'),
    lifetimeEarned: nonNegativeInteger(data.lifetimeEarned, 'lifetimeEarned'),
    lifetimeSpent: nonNegativeInteger(data.lifetimeSpent, 'lifetimeSpent'),
    revision: nonNegativeInteger(data.revision, 'revision'),
  };
}
