import { createHash, timingSafeEqual } from 'node:crypto';
import { AIServiceError } from '../AIServiceError.js';
import { isManagedTutorRuntime } from './tutorRuntimeConfig.js';

function percentage(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : 0;
}

function allowlist(value) {
  return new Set(String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean));
}

function stableBucket(uid, salt) {
  const digest = createHash('sha256').update(String(salt)).update('\0').update(String(uid)).digest();
  return digest.readUInt32BE(0) % 10_000;
}

function includesUid(values, uid) {
  for (const value of values) {
    const left = Buffer.from(value);
    const right = Buffer.from(uid);
    if (left.length === right.length && timingSafeEqual(left, right)) return true;
  }
  return false;
}

export class TutorFeatureGate {
  constructor({ enabled = false, rolloutPercentage = 0, rolloutSalt = '', allowlistedUids = [], version = 'disabled' } = {}) {
    this.enabled = enabled === true;
    this.rolloutPercentage = percentage(rolloutPercentage);
    this.rolloutSalt = String(rolloutSalt);
    this.allowlistedUids = new Set(allowlistedUids);
    this.version = String(version || 'unversioned');
  }

  evaluate({ uid } = {}) {
    if (!this.enabled || typeof uid !== 'string' || !uid) {
      return Object.freeze({ enabled: false, state: 'disabled', bucket: null, version: this.version });
    }
    if (includesUid(this.allowlistedUids, uid)) {
      return Object.freeze({ enabled: true, state: 'allowlisted', bucket: null, version: this.version });
    }
    if (!this.rolloutSalt || this.rolloutPercentage <= 0) {
      return Object.freeze({ enabled: false, state: 'outside-rollout', bucket: null, version: this.version });
    }
    const bucket = stableBucket(uid, this.rolloutSalt);
    return Object.freeze({
      enabled: bucket < Math.round(this.rolloutPercentage * 100),
      state: bucket < Math.round(this.rolloutPercentage * 100) ? 'enabled' : 'outside-rollout',
      bucket,
      version: this.version,
    });
  }

  assertEnabled(input) {
    const decision = this.evaluate(input);
    if (!decision.enabled) {
      const error = new AIServiceError('ai/disabled', 'The AI Tutor is not available right now.', { status: 503 });
      error.featureDecision = decision;
      throw error;
    }
    return decision;
  }
}

export function createTutorFeatureGate(environment = process.env) {
  const enabled = environment.AI_TUTOR_ENABLED === 'true';
  const production = isManagedTutorRuntime(environment);
  const salt = String(environment.AI_TUTOR_ROLLOUT_SALT ?? '');
  if (production && enabled && !salt) {
    throw new AIServiceError('ai/not-configured', 'AI Tutor rollout configuration is unavailable.', { status: 503 });
  }
  return new TutorFeatureGate({
    enabled,
    rolloutPercentage: environment.AI_TUTOR_ROLLOUT_PERCENTAGE,
    rolloutSalt: salt,
    allowlistedUids: allowlist(environment.AI_TUTOR_ALLOWLIST_UIDS),
    version: environment.AI_TUTOR_ROLLOUT_VERSION || 'local',
  });
}

function defaultFeatureGate() {
  try { return createTutorFeatureGate(); }
  catch (configurationError) {
    return Object.freeze({
      assertEnabled() { throw configurationError; },
      evaluate() { return Object.freeze({ enabled: false, state: 'misconfigured', bucket: null, version: 'unknown' }); },
    });
  }
}

export const tutorFeatureGate = defaultFeatureGate();
