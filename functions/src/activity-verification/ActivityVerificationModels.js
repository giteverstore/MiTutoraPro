import { createHash } from 'node:crypto';
import { failVerification } from './ActivityVerificationError.js';

export const ACTIVITY_TYPES = Object.freeze({
  PRACTICE: 'PRACTICE',
  DAILY_CHALLENGE: 'DAILY_CHALLENGE',
});

export const VERIFICATION_OUTCOMES = Object.freeze({
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
});

export const REWARD_AVAILABILITY = Object.freeze({
  UNAVAILABLE: 'UNAVAILABLE',
});

const REQUEST_FIELDS = new Set(['activityType', 'activityId', 'contentVersion', 'language', 'sourceCode']);
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const VERSION = /^v[1-9][0-9]*$/;
const SHA256 = /^[a-f0-9]{64}$/;

function boundedIdentifier(value, field, maximum = 256) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized.length > maximum || !IDENTIFIER.test(normalized)) {
    failVerification('activity-verification/invalid-request', `${field} is invalid.`);
  }
  return normalized;
}

export function authenticatedPrincipal(principal) {
  if (principal?.authenticated !== true || typeof principal.uid !== 'string' || !principal.uid
    || principal.uid.length > 128 || principal.uid.includes('/') || /[\u0000-\u001f\u007f]/.test(principal.uid)) {
    failVerification('activity-verification/unauthenticated', 'Authentication is required.', { status: 401 });
  }
  return Object.freeze({ uid: principal.uid });
}

export function verificationLimits(value) {
  const fields = ['maxSourceBytes', 'maxOutputBytes', 'maxTestCount', 'maxTestInputBytes', 'executionTimeoutMs', 'memoryLimitBytes'];
  const normalized = {};
  for (const field of fields) {
    if (!Number.isSafeInteger(value?.[field]) || value[field] <= 0) {
      failVerification('activity-verification/configuration', `A positive ${field} limit is required.`, { status: 500 });
    }
    normalized[field] = value[field];
  }
  return Object.freeze(normalized);
}

export function normalizeVerificationRequest(body, limits) {
  if (!body || Array.isArray(body) || typeof body !== 'object') {
    failVerification('activity-verification/invalid-request', 'The verification request is invalid.');
  }
  const unexpected = Object.keys(body).filter((field) => !REQUEST_FIELDS.has(field));
  if (unexpected.length) {
    failVerification('activity-verification/client-authority-rejected', 'Client-controlled verification or reward fields are not accepted.');
  }
  if (!Object.values(ACTIVITY_TYPES).includes(body.activityType)) {
    failVerification('activity-verification/invalid-activity-type', 'The activity type is unsupported.');
  }
  const activityId = boundedIdentifier(body.activityId, 'activityId');
  const contentVersion = typeof body.contentVersion === 'string' ? body.contentVersion.trim() : '';
  if (!VERSION.test(contentVersion)) {
    failVerification('activity-verification/invalid-version', 'The content version is invalid.');
  }
  const language = boundedIdentifier(body.language, 'language', 32).toLowerCase();
  if (typeof body.sourceCode !== 'string' || !body.sourceCode.trim()) {
    failVerification('activity-verification/source-required', 'Source code is required.');
  }
  if (Buffer.byteLength(body.sourceCode, 'utf8') > limits.maxSourceBytes) {
    failVerification('activity-verification/source-too-large', 'Source code exceeds the verification limit.', { status: 413 });
  }
  return Object.freeze({ activityType: body.activityType, activityId, contentVersion, language, sourceCode: body.sourceCode });
}

export function validateResolvedActivity(activity, request, limits) {
  if (!activity) failVerification('activity-verification/activity-not-found', 'The activity is unavailable.', { status: 404 });
  if (activity.published !== true) failVerification('activity-verification/activity-unpublished', 'The activity is not published.', { status: 404 });
  if (activity.activityType !== request.activityType || activity.id !== request.activityId) {
    failVerification('activity-verification/activity-mismatch', 'The authoritative activity does not match the request.');
  }
  if (activity.version !== request.contentVersion) {
    failVerification('activity-verification/version-mismatch', 'The submitted content version is no longer active.', { status: 409 });
  }
  if (String(activity.language).toLowerCase() !== request.language) {
    failVerification('activity-verification/language-mismatch', 'The submitted language does not match the activity.');
  }
  if (!SHA256.test(activity.contentHash ?? '')) {
    failVerification('activity-verification/content-integrity-unavailable', 'Authoritative content integrity is unavailable.', { status: 503 });
  }
  const tests = activity.verification?.tests;
  if (!Array.isArray(tests) || tests.length === 0 || tests.length > limits.maxTestCount) {
    failVerification('activity-verification/test-definition-unavailable', 'An authoritative bounded test definition is unavailable.', { status: 503 });
  }
  for (const test of tests) {
    if (Buffer.byteLength(JSON.stringify(test), 'utf8') > limits.maxTestInputBytes) {
      failVerification('activity-verification/test-definition-too-large', 'An authoritative test exceeds the verification limit.', { status: 503 });
    }
  }
  return activity;
}

export function assertSandbox(executor, limits) {
  const profile = executor?.securityProfile;
  if (!profile || profile.isolated !== true || profile.hardTimeout !== true
    || profile.networkAccess !== false || profile.filesystemAccess !== false
    || !Number.isSafeInteger(profile.memoryLimitBytes) || profile.memoryLimitBytes > limits.memoryLimitBytes
    || !Number.isSafeInteger(profile.outputLimitBytes) || profile.outputLimitBytes > limits.maxOutputBytes) {
    failVerification('activity-verification/sandbox-unavailable', 'A compliant isolated execution sandbox is unavailable.', { status: 503 });
  }
}

export function evidenceReference(uid, activity) {
  const digest = createHash('sha256')
    .update([uid, activity.activityType, activity.id, activity.version, activity.contentHash].join('\u0000'), 'utf8')
    .digest('hex');
  return `activityVerifications/${digest}`;
}
