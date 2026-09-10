import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import {
  TUTOR_SMOKE_AUTHORIZATION_COLLECTION,
  createRequestTutorFeatureGate,
  createTutorSmokeAuthorization,
} from '../../server/ai/tutor/tutorSmokeAuthorization.js';

const SECRET = 'A'.repeat(43);
const OTHER_SECRET = 'B'.repeat(43);
const UID = 'synthetic-production-smoke-user';
const BODY = Object.freeze({ requestType: 'explain-full-code', language: 'python', code: 'value = 1' });
const NOW = 1_800_000_000_000;

function environment(overrides = {}) {
  return {
    VERCEL_ENV: 'production',
    NODE_ENV: 'production',
    AI_TUTOR_RUNTIME_BOUNDARY: 'production',
    FIREBASE_PROJECT_ID: 'mi-tutora-pro',
    AI_TUTOR_QUOTA_DATABASE_ID: 'ai-tutor-quota',
    AI_PROVIDER: 'huggingface',
    AI_MODEL: 'openai/gpt-oss-120b:fastest',
    AI_TUTOR_APPROVED_PROVIDER: 'huggingface',
    AI_TUTOR_APPROVED_MODEL: 'openai/gpt-oss-120b:fastest',
    AI_TUTOR_ENABLED: 'false',
    AI_TUTOR_ROLLOUT_PERCENTAGE: '0',
    AI_TUTOR_ROLLOUT_VERSION: 'production-smoke-test',
    AI_TUTOR_ROLLOUT_SALT: 'rollout-salt-for-tests',
    AI_TUTOR_SMOKE_TEST_SECRET: SECRET,
    AI_TUTOR_SMOKE_TEST_UID: UID,
    ...overrides,
  };
}

function firestore() {
  const records = new Map();
  let tail = Promise.resolve();
  const db = {
    collection(collection) {
      return { doc: (id) => ({ path: `${collection}/${id}` }) };
    },
    runTransaction(callback) {
      const run = tail.then(async () => {
        const writes = [];
        const result = await callback({
          async get(reference) {
            const data = records.get(reference.path);
            return { exists: data !== undefined, data: () => structuredClone(data) };
          },
          update(reference, values) { writes.push(() => records.set(reference.path, { ...records.get(reference.path), ...values })); },
        });
        writes.forEach((write) => write());
        return result;
      });
      tail = run.catch(() => {});
      return run;
    },
  };
  return { db, records };
}

function provision({ env = environment(), body = BODY, now = NOW, expiresAt, nonce } = {}) {
  const database = firestore();
  const authorization = createTutorSmokeAuthorization({
    environment: env,
    uid: UID,
    requestBody: body,
    now,
    expiresAt,
    nonce,
  });
  database.records.set(
    `${TUTOR_SMOKE_AUTHORIZATION_COLLECTION}/${authorization.authorizationId}`,
    structuredClone(authorization.record),
  );
  return { ...database, authorization };
}

function gate({ env = environment(), token = '', db, body = BODY, now = NOW } = {}) {
  const createFirestore = vi.fn(async () => db);
  const featureGate = createRequestTutorFeatureGate(env, {
    request: { headers: token ? { 'x-ai-tutor-smoke-authorization': token } : {}, body },
    createFirestore,
  });
  featureGate.smokeAuthorizer.now = () => now;
  return { featureGate, createFirestore };
}

async function decision(featureGate, { uid = UID, body = BODY } = {}) {
  return featureGate.assertEnabled({ uid, requestBody: body });
}

async function expectDisabled(promise) {
  await expect(promise).rejects.toMatchObject({
    code: 'ai/disabled',
    featureDecision: { enabled: false },
  });
}

describe('Production one-shot AI Tutor smoke authorization', () => {
  it('preserves disabled behavior for an ordinary UID without touching Firestore', async () => {
    const { featureGate, createFirestore } = gate({ env: environment({ AI_TUTOR_SMOKE_TEST_UID: 'another-synthetic-user' }) });
    await expectDisabled(decision(featureGate, { uid: 'ordinary-user' }));
    expect(createFirestore).not.toHaveBeenCalled();
  });

  it('does not let the normal allowlist bypass the disabled kill switch', async () => {
    const { featureGate, createFirestore } = gate({ env: environment({ AI_TUTOR_ALLOWLIST_UIDS: UID }) });
    await expectDisabled(decision(featureGate));
    expect(createFirestore).not.toHaveBeenCalled();
  });

  it('rejects a valid marker presented by the wrong authenticated UID', async () => {
    const current = provision();
    const { featureGate, createFirestore } = gate({ token: current.authorization.token, db: current.db });
    await expectDisabled(decision(featureGate, { uid: 'wrong-user' }));
    expect(createFirestore).not.toHaveBeenCalled();
  });

  it('rejects invalid smoke authentication for the configured UID', async () => {
    const current = provision();
    const { featureGate } = gate({ env: environment({ AI_TUTOR_SMOKE_TEST_SECRET: OTHER_SECRET }), token: current.authorization.token, db: current.db });
    await expectDisabled(decision(featureGate));
  });

  it('does not treat a correctly signed marker as sufficient without its one-shot server record', async () => {
    const current = provision();
    current.records.clear();
    const { featureGate } = gate({ token: current.authorization.token, db: current.db });
    await expectDisabled(decision(featureGate));
  });

  it('rejects an expired authorization without consuming it', async () => {
    const current = provision({ expiresAt: NOW + 1_000 });
    const { featureGate } = gate({ token: current.authorization.token, db: current.db, now: NOW + 1_001 });
    await expectDisabled(decision(featureGate));
    expect([...current.records.values()][0].state).toBe('READY');
  });

  it('allows the configured UID once and atomically rejects replay', async () => {
    const current = provision();
    const first = gate({ token: current.authorization.token, db: current.db });
    await expect(decision(first.featureGate)).resolves.toMatchObject({ enabled: true, state: 'smoke-authorized' });
    const second = gate({ token: current.authorization.token, db: current.db });
    await expectDisabled(decision(second.featureGate));
    expect([...current.records.values()][0]).toMatchObject({ state: 'CONSUMED', consumedAt: NOW });
  });

  it('permits only one winner under concurrent one-shot consumption', async () => {
    const current = provision();
    const first = gate({ token: current.authorization.token, db: current.db });
    const second = gate({ token: current.authorization.token, db: current.db });
    const outcomes = await Promise.allSettled([decision(first.featureGate), decision(second.featureGate)]);
    expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter(({ status }) => status === 'rejected')).toHaveLength(1);
  });

  it('binds the authorization to the exact request body', async () => {
    const current = provision();
    const changed = { ...BODY, code: 'value = 2' };
    const { featureGate, createFirestore } = gate({ token: current.authorization.token, db: current.db, body: changed });
    await expectDisabled(decision(featureGate, { body: changed }));
    expect(createFirestore).not.toHaveBeenCalled();
  });

  it.each([
    ['wrong Firebase project', { FIREBASE_PROJECT_ID: 'another-project' }],
    ['wrong runtime boundary', { AI_TUTOR_RUNTIME_BOUNDARY: 'validation', VERCEL_ENV: 'preview' }],
    ['wrong quota database', { AI_TUTOR_QUOTA_DATABASE_ID: 'another-database' }],
    ['wrong provider', { AI_PROVIDER: 'openai' }],
    ['wrong model', { AI_MODEL: 'another-model' }],
  ])('fails closed for %s', async (_label, overrides) => {
    const current = provision();
    const { featureGate, createFirestore } = gate({ env: environment(overrides), token: current.authorization.token, db: current.db });
    await expectDisabled(decision(featureGate));
    expect(createFirestore).not.toHaveBeenCalled();
  });

  it.each([
    ['missing secret', { AI_TUTOR_SMOKE_TEST_SECRET: '' }, null],
    ['missing UID', { AI_TUTOR_SMOKE_TEST_UID: '' }, null],
    ['malformed authorization', {}, 'not-a-valid-token'],
  ])('fails closed for %s', async (_label, overrides, marker) => {
    const current = provision();
    const { featureGate, createFirestore } = gate({
      env: environment(overrides),
      token: marker ?? current.authorization.token,
      db: current.db,
    });
    await expectDisabled(decision(featureGate));
    expect(createFirestore).not.toHaveBeenCalled();
  });

  it('cannot activate in the validation boundary', async () => {
    const current = provision();
    const validation = environment({
      VERCEL_ENV: 'preview',
      AI_TUTOR_RUNTIME_BOUNDARY: 'validation',
      FIREBASE_PROJECT_ID: 'mi-tutora-ai-val-260904-k7m3',
      AI_TUTOR_QUOTA_DATABASE_ID: 'ai-tutor-quota-validation',
    });
    const { featureGate, createFirestore } = gate({ env: validation, token: current.authorization.token, db: current.db });
    await expectDisabled(decision(featureGate));
    expect(createFirestore).not.toHaveBeenCalled();
  });

  it('uses normal rollout behavior when the feature is enabled, including for the smoke UID', async () => {
    const current = provision();
    const enabled = environment({ AI_TUTOR_ENABLED: 'true', AI_TUTOR_ROLLOUT_PERCENTAGE: '0' });
    const { featureGate, createFirestore } = gate({ env: enabled, token: current.authorization.token, db: current.db });
    await expectDisabled(decision(featureGate));
    expect(createFirestore).not.toHaveBeenCalled();
    expect([...current.records.values()][0].state).toBe('READY');
  });

  it('leaves normal enabled learner rollout behavior unchanged', async () => {
    const enabled = environment({ AI_TUTOR_ENABLED: 'true', AI_TUTOR_ROLLOUT_PERCENTAGE: '100' });
    const { featureGate, createFirestore } = gate({ env: enabled });
    await expect(decision(featureGate, { uid: 'ordinary-user' })).resolves.toMatchObject({ enabled: true, state: 'enabled' });
    expect(createFirestore).not.toHaveBeenCalled();
  });

  it('keeps the smoke credential and marker capability out of the browser client', async () => {
    const client = await readFile('src/ai/AITutorClient.js', 'utf8');
    expect(client).not.toMatch(/AI_TUTOR_SMOKE_TEST_SECRET|AI_TUTOR_SMOKE_TEST_UID|x-ai-tutor-smoke-authorization|tutorSmokeAuthorization/);
    expect(client).toContain("Authorization: `Bearer ${token}`");
  });
});
