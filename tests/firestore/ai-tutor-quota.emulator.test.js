import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AIServiceError } from '../../server/ai/AIServiceError.js';
import { Firestore } from '@google-cloud/firestore';
import { explainCode } from '../../server/ai/explainHandler.js';
import { createTutorQuotaFirestore } from '../../server/ai/quota/createTutorQuotaFirestore.js';
import { FirestoreTutorQuotaStore } from '../../server/ai/quota/FirestoreTutorQuotaStore.js';
import { TutorQuotaGuard } from '../../server/ai/tutor/tutorQuota.js';
import { createTutorPricingConfiguration } from '../../server/ai/tutor/tutorRuntimeConfig.js';

const PROJECT_ID = 'demo-local-ai-tutor-quota';
const DATABASE_ID = 'local-ai-tutor-quota';
const QUOTA_COLLECTION = 'aiTutorQuotaEmulatorTestQuotas';
const RESERVATION_COLLECTION = 'aiTutorQuotaEmulatorTestReservations';
const IDENTITY_SALT = 'synthetic-emulator-only-salt';
const DAY = 24 * 60 * 60 * 1_000;
const RETENTION = 7 * DAY;
const baseTime = Date.UTC(2026, 0, 15, 12);

const use = (inputTokens, outputTokens, costMicros = null) => ({ inputTokens, outputTokens, costMicros });
const policy = ({ burst = 20, sustained = 20, hourly = 20, daily = 20, input = 1_000, output = 1_000, cost = 1_000 } = {}) => ({
  burst: { requests: burst, windowMs: 10_000 },
  sustained: { requests: sustained, windowMs: 60_000 },
  hourly: { requests: hourly, windowMs: 3_600_000 },
  daily: { requests: daily, inputTokens: input, outputTokens: output, costMicros: cost },
});
const enabledGate = { assertEnabled: () => ({ enabled: true, state: 'enabled', bucket: 1, version: 'emulator-test' }) };
const activityPolicyResolver = { resolve: async () => ({ activityType: 'lesson', solutionPolicy: 'hints-only', maximumHintLevel: 1 }) };
const request = { requestType: 'explain-full-code', language: 'python', code: 'value = 1\nprint(value)', compilerStatus: 'ready', activityType: 'lesson' };
const pricing = createTutorPricingConfiguration({ AI_TUTOR_INPUT_USD_PER_MILLION_TOKENS: '0', AI_TUTOR_OUTPUT_USD_PER_MILLION_TOKENS: '0' });
const providerTokenConstraints = { maxInputTokens: 128_000, inputOverheadTokens: 8 };
const structuredResponse = JSON.stringify({
  schemaVersion: '1', policyVersion: 'ai-tutor-v1', operation: 'explain-full-code',
  evidence: { basis: 'static', note: null }, summary: 'Trace how the assigned value reaches the output.',
  sections: [], codeReferences: [], concepts: [], issues: [], nextStep: { kind: 'none', text: '' },
});

let db;
let clock = baseTime;
let constructedFirestoreOptions;

function store() {
  return new FirestoreTutorQuotaStore({
    db,
    collection: QUOTA_COLLECTION,
    reservationCollection: RESERVATION_COLLECTION,
    now: () => clock,
  });
}

function guard(currentPolicy = policy(), currentStore = store()) {
  return new TutorQuotaGuard({ distributedStore: currentStore, policy: currentPolicy, identitySalt: IDENTITY_SALT });
}

async function clearCollection(name) {
  const snapshot = await db.collection(name).get();
  if (snapshot.empty) return;
  const batch = db.batch();
  snapshot.docs.forEach((document) => batch.delete(document.ref));
  await batch.commit();
}

async function reset() {
  await clearCollection(RESERVATION_COLLECTION);
  await clearCollection(QUOTA_COLLECTION);
  clock = baseTime;
}

async function quotaSnapshot(identityKey) {
  return (await db.collection(QUOTA_COLLECTION).doc(identityKey).get()).data();
}

async function reservationSnapshot(requestId) {
  return (await db.collection(RESERVATION_COLLECTION).doc(requestId).get()).data();
}

async function reserve(currentGuard, uid, requestId, maximum = use(10, 5, 2), estimate = use(3, 2, 1)) {
  return currentGuard.assertAllowed({ uid, requestId, usageEstimate: estimate, usageMaximum: maximum });
}

beforeAll(async () => {
  if (process.env.AI_TUTOR_QUOTA_EMULATOR_TEST !== 'true' || !process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('Quota emulator isolation marker is missing.');
  }
  expect(process.env.FIREBASE_PROJECT_ID).toBe(PROJECT_ID);
  expect(process.env.AI_TUTOR_QUOTA_DATABASE_ID).toBe(DATABASE_ID);
  expect(process.env.FIREBASE_PROJECT_ID).not.toBe('mi-tutora-pro');
  expect(process.env.AI_TUTOR_QUOTA_DATABASE_ID).not.toBe('ai-tutor-quota');
  expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toBeUndefined();
  expect(process.env.FIREBASE_SERVICE_ACCOUNT_JSON).toBeUndefined();
  class EmulatorFirestore extends Firestore {
    constructor(options) {
      constructedFirestoreOptions = options;
      super(options);
    }
  }
  db = createTutorQuotaFirestore(process.env, { FirestoreClient: EmulatorFirestore });
  await reset();
});

afterAll(async () => {
  if (!db) return;
  await reset();
  await db.terminate();
});

describe.sequential('AI Tutor Firestore emulator quota persistence', () => {
  it('uses only the explicit synthetic project and named emulator database', async () => {
    expect(constructedFirestoreOptions).toMatchObject({ projectId: PROJECT_ID, databaseId: DATABASE_ID });
    expect(constructedFirestoreOptions.authClient).toBeUndefined();
  });

  it('creates one pending reservation with one exact quota charge and TTL metadata', async () => {
    await reset();
    const currentGuard = guard();
    const reservation = await reserve(currentGuard, 'synthetic-principal-a', 'first');
    const quota = await quotaSnapshot(reservation.identityKey);
    const persisted = await reservationSnapshot('first');
    expect(persisted).toMatchObject({ state: 'PENDING', identityKey: reservation.identityKey, maximum: use(10, 5, 2) });
    expect(persisted.expiresAt.toDate().getTime()).toBe(baseTime + RETENTION);
    expect(quota).toMatchObject({
      burst: { requests: 1 }, sustained: { requests: 1 }, hourly: { requests: 1 },
      daily: { requests: 1, reservedInputTokens: 10, reservedOutputTokens: 5, reservedCostMicros: 2 },
    });
  });

  it('keeps identical retries idempotent and rejects changed identity, estimate, or maximum without corruption', async () => {
    await reset();
    const currentGuard = guard();
    const first = await reserve(currentGuard, 'synthetic-principal-a', 'stable');
    const duplicate = await reserve(currentGuard, 'synthetic-principal-a', 'stable');
    expect(duplicate).toMatchObject({
      requestId: first.requestId, identityKey: first.identityKey, state: first.state,
      estimate: first.estimate, maximum: first.maximum,
    });
    await expect(reserve(currentGuard, 'synthetic-principal-b', 'stable')).rejects.toMatchObject({ code: 'ai/idempotency-conflict' });
    await expect(reserve(currentGuard, 'synthetic-principal-a', 'stable', use(10, 5, 2), use(4, 2, 1))).rejects.toMatchObject({ code: 'ai/idempotency-conflict' });
    await expect(reserve(currentGuard, 'synthetic-principal-a', 'stable', use(11, 5, 2))).rejects.toMatchObject({ code: 'ai/idempotency-conflict' });
    expect(await quotaSnapshot(first.identityKey)).toMatchObject({ daily: { requests: 1, reservedInputTokens: 10 } });
  });

  it('enforces and resets burst, sustained, hourly, and UTC-daily request windows', async () => {
    const scenarios = [
      { name: 'burst', selected: policy({ burst: 2 }), advance: 10_000 },
      { name: 'sustained', selected: policy({ burst: 10, sustained: 2 }), advance: 60_000 },
      { name: 'hourly', selected: policy({ burst: 10, sustained: 10, hourly: 2 }), advance: 3_600_000 },
      { name: 'daily', selected: policy({ burst: 10, sustained: 10, hourly: 10, daily: 2 }), advance: 12 * 60 * 60 * 1_000 },
    ];
    for (const scenario of scenarios) {
      await reset();
      const currentGuard = guard(scenario.selected);
      await reserve(currentGuard, 'synthetic-principal-a', `${scenario.name}-1`, use(1, 1, 0));
      await reserve(currentGuard, 'synthetic-principal-a', `${scenario.name}-2`, use(1, 1, 0));
      const provider = vi.fn();
      await expect(reserve(currentGuard, 'synthetic-principal-a', `${scenario.name}-3`, use(1, 1, 0))).rejects.toMatchObject({ code: 'ai/rate-limited' });
      expect(provider).not.toHaveBeenCalled();
      clock += scenario.advance;
      await expect(reserve(currentGuard, 'synthetic-principal-a', `${scenario.name}-reset`, use(1, 1, 0))).resolves.toMatchObject({ state: 'PENDING' });
    }
  });

  it('enforces token and cost capacity without over-allocation', async () => {
    await reset();
    const currentGuard = guard(policy({ input: 10, output: 5, cost: 3 }));
    await reserve(currentGuard, 'synthetic-principal-a', 'capacity', use(10, 5, 3));
    await expect(reserve(currentGuard, 'synthetic-principal-a', 'over-token', use(1, 0, 0))).rejects.toMatchObject({ code: 'ai/rate-limited' });
    await expect(reserve(currentGuard, 'synthetic-principal-a', 'over-cost', use(0, 0, 1))).rejects.toMatchObject({ code: 'ai/rate-limited' });
  });

  it('settles atomically, releases reserved capacity, preserves requests, and ignores repeated settlement', async () => {
    await reset();
    const currentStore = store();
    const reservation = await reserve(guard(policy(), currentStore), 'synthetic-principal-a', 'settle');
    await currentStore.settle(reservation, { inputTokens: 4, outputTokens: 2, costMicros: 1, outcome: 'success' });
    const settledQuota = await quotaSnapshot(reservation.identityKey);
    expect(settledQuota.daily).toMatchObject({ requests: 1, inputTokens: 4, outputTokens: 2, costMicros: 1, reservedInputTokens: 0, reservedOutputTokens: 0, reservedCostMicros: 0 });
    expect(await reservationSnapshot('settle')).toMatchObject({ state: 'SETTLED', outcome: 'success' });
    await currentStore.settle(reservation, { inputTokens: 9, outputTokens: 4, costMicros: 2, outcome: 'duplicate' });
    expect(await quotaSnapshot(reservation.identityKey)).toEqual(settledQuota);
  });

  it.each([
    ['provider failure', new AIServiceError('ai/provider-unavailable', 'Unavailable', { status: 502 }), 'ai/provider-unavailable'],
    ['cancellation', new DOMException('cancelled', 'AbortError'), 'ai/cancelled'],
  ])('conservatively settles a reservation after %s', async (_, providerError, expectedCode) => {
    await reset();
    const currentGuard = guard(policy({ input: 100_000, output: 10_000, cost: 10_000 }));
    const provider = { getMetadata: () => ({ provider: 'mock', model: 'synthetic' }), explain: vi.fn().mockRejectedValue(providerError) };
    await expect(explainCode(request, {
      principal: { uid: 'synthetic-principal-a' }, featureGate: enabledGate, quotaGuard: currentGuard,
      providerFactory: () => provider, activityPolicyResolver, pricing, providerTokenConstraints,
    })).rejects.toMatchObject({ code: expectedCode });
    const snapshot = await db.collection(QUOTA_COLLECTION).get();
    expect(snapshot.docs[0].data().daily).toMatchObject({ requests: 1, reservedInputTokens: 0, reservedOutputTokens: 0 });
    expect(snapshot.docs[0].data().daily.inputTokens).toBeGreaterThan(0);
    const reservations = await db.collection(RESERVATION_COLLECTION).get();
    expect(reservations.docs[0].data()).toMatchObject({ state: 'SETTLED', outcome: expectedCode });
  });

  it('keeps a reservation conservative and reports settlement failure through telemetry', async () => {
    await reset();
    const persistentStore = store();
    const failingStore = { reserve: (input) => persistentStore.reserve(input), settle: async () => { throw new Error('synthetic settlement failure'); } };
    const events = [];
    const response = await explainCode(request, {
      principal: { uid: 'synthetic-principal-a' }, featureGate: enabledGate, quotaGuard: guard(policy({ input: 100_000, output: 10_000, cost: 10_000 }), failingStore),
      providerFactory: () => ({ getMetadata: () => ({ provider: 'mock', model: 'synthetic' }), explain: vi.fn().mockResolvedValue({ text: structuredResponse, usage: { input_tokens: 2, output_tokens: 2 } }) }),
      activityPolicyResolver, pricing, providerTokenConstraints, telemetry: { record: (event) => events.push(event) },
    });
    expect(response.summary).toContain('assigned value');
    expect(events.at(-1)).toMatchObject({ success: true, quotaDecision: 'settlement-failed' });
    const reservations = await db.collection(RESERVATION_COLLECTION).get();
    expect(reservations.docs[0].data().state).toBe('PENDING');
    const quotas = await db.collection(QUOTA_COLLECTION).get();
    expect(quotas.docs[0].data().daily.reservedInputTokens).toBeGreaterThan(0);
  });

  it('fails closed before provider invocation when reservation persistence fails', async () => {
    await reset();
    const provider = vi.fn();
    const currentGuard = guard(policy(), { reserve: async () => { throw new Error('synthetic persistence failure'); }, settle: vi.fn() });
    await expect(currentGuard.assertAllowed({ uid: 'synthetic-principal-a', requestId: 'failure', usageMaximum: use(1, 1, 0) })).rejects.toMatchObject({ code: 'ai/quota-unavailable' });
    expect(provider).not.toHaveBeenCalled();
    expect((await db.collection(QUOTA_COLLECTION).get()).empty).toBe(true);
    expect((await db.collection(RESERVATION_COLLECTION).get()).empty).toBe(true);
  });

  it('prevents oversubscription during concurrent different reservations', async () => {
    await reset();
    const currentGuard = guard(policy({ burst: 4, sustained: 4, hourly: 4, daily: 4, input: 40, output: 20, cost: 8 }));
    const results = await Promise.allSettled(Array.from({ length: 10 }, (_, index) => reserve(currentGuard, 'synthetic-principal-a', `concurrent-${index}`)));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(4);
    expect(results.filter((result) => result.status === 'rejected').every((result) => result.reason.code === 'ai/rate-limited')).toBe(true);
    const identityKey = currentGuard.identityKey('synthetic-principal-a');
    expect(await quotaSnapshot(identityKey)).toMatchObject({ daily: { requests: 4, reservedInputTokens: 40, reservedOutputTokens: 20, reservedCostMicros: 8 } });
  });

  it('converges concurrent identical reservations without double consumption', async () => {
    await reset();
    const currentGuard = guard();
    const results = await Promise.all(Array.from({ length: 6 }, () => reserve(currentGuard, 'synthetic-principal-a', 'same-concurrent')));
    expect(new Set(results.map((result) => result.requestId))).toEqual(new Set(['same-concurrent']));
    expect(await quotaSnapshot(results[0].identityKey)).toMatchObject({ daily: { requests: 1, reservedInputTokens: 10 } });
    expect((await db.collection(RESERVATION_COLLECTION).get()).size).toBe(1);
  });

  it('rejects concurrent conflicting duplicates without corrupting quota state', async () => {
    await reset();
    const currentGuard = guard();
    const attempts = [
      reserve(currentGuard, 'synthetic-principal-a', 'conflicting', use(10, 5, 2), use(3, 2, 1)),
      reserve(currentGuard, 'synthetic-principal-b', 'conflicting', use(10, 5, 2), use(3, 2, 1)),
      reserve(currentGuard, 'synthetic-principal-a', 'conflicting', use(11, 5, 2), use(3, 2, 1)),
    ];
    const results = await Promise.allSettled(attempts);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected').every((result) => result.reason.code === 'ai/idempotency-conflict')).toBe(true);
    expect((await db.collection(RESERVATION_COLLECTION).get()).size).toBe(1);
    expect((await db.collection(QUOTA_COLLECTION).get()).size).toBe(1);
  });

  it('isolates identities and persists only HMAC-derived identity keys', async () => {
    await reset();
    const currentGuard = guard();
    const first = await reserve(currentGuard, 'synthetic-principal-a', 'identity-a');
    const second = await reserve(currentGuard, 'synthetic-principal-b', 'identity-b');
    expect(first.identityKey).not.toBe(second.identityKey);
    const quotas = await db.collection(QUOTA_COLLECTION).get();
    expect(quotas.size).toBe(2);
    expect(quotas.docs.map((document) => document.id).sort()).toEqual([first.identityKey, second.identityKey].sort());
    expect(JSON.stringify(quotas.docs.map((document) => document.data()))).not.toContain('synthetic-principal');
    const reservations = await db.collection(RESERVATION_COLLECTION).get();
    expect(JSON.stringify(reservations.docs.map((document) => document.data()))).not.toContain('synthetic-principal');
  });

  it('derives identity from the authenticated principal rather than request payload fields', async () => {
    await reset();
    const currentGuard = guard(policy({ input: 100_000, output: 10_000, cost: 10_000 }));
    const provider = { getMetadata: () => ({ provider: 'mock', model: 'synthetic' }), explain: vi.fn().mockResolvedValue({ text: structuredResponse, usage: { input_tokens: 2, output_tokens: 2 } }) };
    await explainCode({ ...request, uid: 'payload-selected-identity', identityKey: 'payload-selected-key' }, {
      principal: { uid: 'synthetic-principal-a' }, featureGate: enabledGate, quotaGuard: currentGuard,
      providerFactory: () => provider, activityPolicyResolver, pricing, providerTokenConstraints,
    });
    const quotas = await db.collection(QUOTA_COLLECTION).get();
    expect(quotas.docs.map((document) => document.id)).toEqual([currentGuard.identityKey('synthetic-principal-a')]);
  });

  it('fails closed when settlement identity differs from the persisted reservation identity', async () => {
    await reset();
    const currentStore = store();
    const reservation = await reserve(guard(policy(), currentStore), 'synthetic-principal-a', 'settlement-owner');
    const before = await quotaSnapshot(reservation.identityKey);
    await expect(currentStore.settle({ ...reservation, identityKey: guard().identityKey('synthetic-principal-b') }, { inputTokens: 1, outputTokens: 1, costMicros: 1 })).rejects.toMatchObject({ code: 'ai/idempotency-conflict' });
    expect(await quotaSnapshot(reservation.identityKey)).toEqual(before);
    expect(await reservationSnapshot('settlement-owner')).toMatchObject({ state: 'PENDING', identityKey: reservation.identityKey });
  });

  it('keeps abandoned reservations pending with conservative capacity until reset/TTL', async () => {
    await reset();
    const currentGuard = guard();
    const reservation = await reserve(currentGuard, 'synthetic-principal-a', 'abandoned');
    expect(await quotaSnapshot(reservation.identityKey)).toMatchObject({ daily: { requests: 1, reservedInputTokens: 10, reservedOutputTokens: 5 } });
    expect(await reservationSnapshot('abandoned')).toMatchObject({ state: 'PENDING' });
  });
});
