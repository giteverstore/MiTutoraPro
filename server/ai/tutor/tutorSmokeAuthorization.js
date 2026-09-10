import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { AIServiceError } from '../AIServiceError.js';
import {
  createTutorProviderConfiguration,
  createTutorQuotaFirestoreConfiguration,
  resolveTutorRuntimeProfile,
} from './tutorRuntimeConfig.js';
import { createTutorFeatureGate } from './tutorFeatureGate.js';

export const TUTOR_SMOKE_AUTHORIZATION_COLLECTION = 'aiTutorSmokeAuthorizations';
export const TUTOR_SMOKE_AUTHORIZATION_HEADER = 'x-ai-tutor-smoke-authorization';
export const TUTOR_SMOKE_AUTHORIZATION_MAX_AGE_MS = 5 * 60 * 1_000;

const TOKEN_VERSION = 1;
const MAX_TOKEN_LENGTH = 4_096;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const PAYLOAD_KEYS = Object.freeze([
  'expiresAt',
  'firebaseProjectId',
  'issuedAt',
  'model',
  'nonce',
  'provider',
  'quotaDatabaseId',
  'requestDigest',
  'runtimeBoundary',
  'uid',
  'version',
]);

function fixedEqual(left, right) {
  const first = Buffer.from(String(left));
  const second = Buffer.from(String(right));
  return first.length === second.length && timingSafeEqual(first, second);
}

function validSecret(secret) {
  if (typeof secret !== 'string' || !BASE64URL.test(secret)) return false;
  try {
    const decoded = Buffer.from(secret, 'base64url');
    return decoded.length >= 32 && decoded.toString('base64url') === secret;
  } catch {
    return false;
  }
}

function requestDigest(body) {
  const serialized = JSON.stringify(body);
  if (typeof serialized !== 'string') throw new TypeError('A JSON request body is required.');
  return createHash('sha256').update(serialized).digest('hex');
}

function tokenSignature(secret, payloadSegment) {
  return createHmac('sha256', secret)
    .update('mi-tutora-ai-smoke-v1\0')
    .update(payloadSegment)
    .digest('base64url');
}

function authorizationId(secret, nonce) {
  return createHmac('sha256', secret)
    .update('mi-tutora-ai-smoke-nonce-v1\0')
    .update(nonce)
    .digest('hex');
}

function authorizationDigest(payloadSegment) {
  return createHash('sha256').update(payloadSegment).digest('hex');
}

function timestampMillis(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toMillis === 'function') return value.toMillis();
  return Number(value);
}

function strictPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  const keys = Object.keys(payload).sort();
  return keys.length === PAYLOAD_KEYS.length
    && keys.every((key, index) => key === PAYLOAD_KEYS[index]);
}

function parseAuthorization(token) {
  if (typeof token !== 'string' || !token || token.length > MAX_TOKEN_LENGTH) return null;
  const segments = token.split('.');
  if (segments.length !== 2 || segments.some((segment) => !BASE64URL.test(segment))) return null;
  const [payloadSegment, signature] = segments;
  try {
    const bytes = Buffer.from(payloadSegment, 'base64url');
    if (bytes.toString('base64url') !== payloadSegment) return null;
    const payload = JSON.parse(bytes.toString('utf8'));
    return strictPayload(payload) ? { payload, payloadSegment, signature } : null;
  } catch {
    return null;
  }
}

function readHeader(request, name) {
  const value = request?.headers?.[name] ?? request?.headers?.[name.toLowerCase()];
  return typeof value === 'string' ? value.trim() : '';
}

function disabled(decision) {
  const error = new AIServiceError('ai/disabled', 'The AI Tutor is not available right now.', { status: 503 });
  error.featureDecision = decision;
  return error;
}

function productionBinding(environment) {
  const profile = resolveTutorRuntimeProfile(environment);
  const quota = createTutorQuotaFirestoreConfiguration(environment);
  const provider = createTutorProviderConfiguration(environment);
  if (profile?.boundary !== 'production'
    || environment.VERCEL_ENV !== 'production'
    || profile.projectId !== 'mi-tutora-pro'
    || quota.projectId !== 'mi-tutora-pro'
    || quota.databaseId !== 'ai-tutor-quota') return null;
  return Object.freeze({ profile, quota, provider });
}

export class FirestoreTutorSmokeAuthorizationStore {
  constructor({ db, collection = TUTOR_SMOKE_AUTHORIZATION_COLLECTION, now = Date.now } = {}) {
    if (!db?.runTransaction) throw new TypeError('A Firestore transaction client is required.');
    this.db = db;
    this.collection = collection;
    this.now = now;
  }

  async consume({ id, digest, expiresAt }) {
    const reference = this.db.collection(this.collection).doc(id);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) return false;
      const record = snapshot.data();
      const now = this.now();
      if (record?.version !== TOKEN_VERSION
        || record.state !== 'READY'
        || !fixedEqual(record.authorizationDigest, digest)
        || timestampMillis(record.expiresAt) !== expiresAt
        || expiresAt <= now) return false;
      transaction.update(reference, { state: 'CONSUMED', consumedAt: now });
      return true;
    });
  }
}

export function createTutorSmokeAuthorization({
  environment,
  uid,
  requestBody,
  nonce = randomBytes(32).toString('base64url'),
  now = Date.now(),
  expiresAt = now + TUTOR_SMOKE_AUTHORIZATION_MAX_AGE_MS,
} = {}) {
  const secret = environment?.AI_TUTOR_SMOKE_TEST_SECRET;
  const configuredUid = environment?.AI_TUTOR_SMOKE_TEST_UID;
  const binding = productionBinding(environment ?? {});
  if (!binding || !validSecret(secret) || !configuredUid || !fixedEqual(uid, configuredUid)
    || !BASE64URL.test(nonce) || Buffer.from(nonce, 'base64url').length < 32
    || !Number.isSafeInteger(now) || !Number.isSafeInteger(expiresAt)
    || expiresAt <= now || expiresAt - now > TUTOR_SMOKE_AUTHORIZATION_MAX_AGE_MS) {
    throw new TypeError('The Production smoke authorization configuration is invalid.');
  }
  const payload = {
    expiresAt,
    firebaseProjectId: binding.quota.projectId,
    issuedAt: now,
    model: binding.provider.model,
    nonce,
    provider: binding.provider.provider,
    quotaDatabaseId: binding.quota.databaseId,
    requestDigest: requestDigest(requestBody),
    runtimeBoundary: binding.profile.boundary,
    uid,
    version: TOKEN_VERSION,
  };
  const payloadSegment = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return Object.freeze({
    token: `${payloadSegment}.${tokenSignature(secret, payloadSegment)}`,
    authorizationId: authorizationId(secret, nonce),
    record: Object.freeze({
      version: TOKEN_VERSION,
      state: 'READY',
      authorizationDigest: authorizationDigest(payloadSegment),
      createdAt: new Date(now),
      expiresAt: new Date(expiresAt),
    }),
  });
}

export class TutorSmokeAuthorizer {
  constructor({ environment, request, createFirestore, now = Date.now } = {}) {
    this.environment = environment ?? {};
    this.request = request;
    this.createFirestore = createFirestore;
    this.now = now;
  }

  async authorize({ uid, requestBody } = {}) {
    try {
      if (this.environment.AI_TUTOR_ENABLED !== 'false'
        || Number(this.environment.AI_TUTOR_ROLLOUT_PERCENTAGE) !== 0) return false;
      const secret = this.environment.AI_TUTOR_SMOKE_TEST_SECRET;
      const configuredUid = this.environment.AI_TUTOR_SMOKE_TEST_UID;
      const binding = productionBinding(this.environment);
      const parsed = parseAuthorization(readHeader(this.request, TUTOR_SMOKE_AUTHORIZATION_HEADER));
      if (!binding || !validSecret(secret) || !configuredUid || !fixedEqual(uid, configuredUid) || !parsed) return false;
      if (!fixedEqual(parsed.signature, tokenSignature(secret, parsed.payloadSegment))) return false;
      const { payload } = parsed;
      const now = this.now();
      if (payload.version !== TOKEN_VERSION
        || !fixedEqual(payload.uid, uid)
        || payload.runtimeBoundary !== binding.profile.boundary
        || payload.firebaseProjectId !== binding.quota.projectId
        || payload.quotaDatabaseId !== binding.quota.databaseId
        || payload.provider !== binding.provider.provider
        || payload.model !== binding.provider.model
        || !Number.isSafeInteger(payload.issuedAt)
        || !Number.isSafeInteger(payload.expiresAt)
        || payload.issuedAt > now
        || payload.expiresAt <= now
        || payload.expiresAt - payload.issuedAt > TUTOR_SMOKE_AUTHORIZATION_MAX_AGE_MS
        || !BASE64URL.test(payload.nonce)
        || Buffer.from(payload.nonce, 'base64url').length < 32
        || !fixedEqual(payload.requestDigest, requestDigest(requestBody))) return false;
      const db = await this.createFirestore?.(this.environment);
      const store = new FirestoreTutorSmokeAuthorizationStore({ db, now: this.now });
      return store.consume({
        id: authorizationId(secret, payload.nonce),
        digest: authorizationDigest(parsed.payloadSegment),
        expiresAt: payload.expiresAt,
      });
    } catch {
      return false;
    }
  }
}

export class TutorRequestFeatureGate {
  constructor({ normalGate, smokeAuthorizer } = {}) {
    this.normalGate = normalGate;
    this.smokeAuthorizer = smokeAuthorizer;
  }

  async assertEnabled(input = {}) {
    const normalDecision = this.normalGate.evaluate(input);
    if (this.normalGate.enabled) {
      if (!normalDecision.enabled) throw disabled(normalDecision);
      return normalDecision;
    }
    if (await this.smokeAuthorizer.authorize(input)) {
      return Object.freeze({ enabled: true, state: 'smoke-authorized', bucket: null, version: this.normalGate.version });
    }
    throw disabled(normalDecision);
  }
}

export function createRequestTutorFeatureGate(environment, { request, createFirestore } = {}) {
  const normalGate = createTutorFeatureGate(environment);
  return new TutorRequestFeatureGate({
    normalGate,
    smokeAuthorizer: new TutorSmokeAuthorizer({ environment, request, createFirestore }),
  });
}
