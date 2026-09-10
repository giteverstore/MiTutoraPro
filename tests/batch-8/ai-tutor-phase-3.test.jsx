import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AITutorPanel } from '../../src/ai/AITutorPanel.jsx';
import { createAIProvider } from '../../server/ai/createAIProvider.js';
import { explainCode } from '../../server/ai/explainHandler.js';
import { AdversarialEvaluationHarness, PHASE_3_SYNTHETIC_EVALUATION_CASES } from '../../server/ai/evaluation/AdversarialEvaluationHarness.js';
import { AIServiceError } from '../../server/ai/AIServiceError.js';
import { InMemoryTutorAlertEvaluator } from '../../server/ai/tutor/tutorAlerts.js';
import { TrustedActivityPolicyResolver } from '../../server/ai/tutor/tutorActivityPolicy.js';
import { TutorFeatureGate, createTutorFeatureGate } from '../../server/ai/tutor/tutorFeatureGate.js';
import { ProcessLocalTutorQuotaStore, TutorQuotaGuard, createDefaultTutorQuotaGuard } from '../../server/ai/tutor/tutorQuota.js';
import { createTutorProviderConfiguration, createTutorProviderTokenConstraints, createTutorQuotaFirestoreConfiguration, createTutorQuotaPolicy, createTutorPricingConfiguration } from '../../server/ai/tutor/tutorRuntimeConfig.js';
import { createOperationalTutorTelemetry, createTutorTelemetryEvent, TutorTelemetry } from '../../server/ai/tutor/tutorTelemetry.js';
import { estimateCostMicros, estimateTutorRequestUsage, normalizeProviderUsage } from '../../server/ai/tutor/tutorUsage.js';
import { FirestoreTutorQuotaStore } from '../../server/ai/quota/FirestoreTutorQuotaStore.js';
import { createTutorQuotaFirestore } from '../../server/ai/quota/createTutorQuotaFirestore.js';
import { resolveFirebaseAdminConfiguration } from '../../server/firebaseAdminApp.js';

const enabledGate = { assertEnabled: () => ({ enabled: true, state: 'enabled', bucket: 1, version: 'test' }) };
const request = { requestType: 'explain-full-code', language: 'python', code: 'print(1)', compilerStatus: 'ready', activityType: 'practice' };
const policy = Object.freeze({ burst: { requests: 2, windowMs: 10_000 }, sustained: { requests: 3, windowMs: 60_000 }, hourly: { requests: 4, windowMs: 3_600_000 }, daily: { requests: 4, inputTokens: 10_000, outputTokens: 10_000, costMicros: 1_000 } });
const zeroPricing = createTutorPricingConfiguration({ AI_TUTOR_INPUT_USD_PER_MILLION_TOKENS: '0', AI_TUTOR_OUTPUT_USD_PER_MILLION_TOKENS: '0' });
const structured = (summary) => JSON.stringify({ schemaVersion: '1', policyVersion: 'ai-tutor-v1', operation: 'explain-full-code', evidence: { basis: 'static', note: null }, summary, sections: [], codeReferences: [], concepts: [], issues: [], nextStep: { kind: 'none', text: '' } });

function fakeFirestore() {
  const records = new Map();
  let queue = Promise.resolve();
  const db = {
    collection: (name) => ({ doc: (id) => ({ path: `${name}/${id}` }) }),
    runTransaction(work) {
      const run = queue.then(async () => {
        const writes = [];
        const transaction = {
          get: async (ref) => ({ exists: records.has(ref.path), data: () => structuredClone(records.get(ref.path)) }),
          set: (ref, value) => writes.push(() => records.set(ref.path, structuredClone(value))),
          create: (ref, value) => writes.push(() => { if (records.has(ref.path)) throw new Error('already exists'); records.set(ref.path, structuredClone(value)); }),
          update: (ref, value) => writes.push(() => records.set(ref.path, { ...records.get(ref.path), ...structuredClone(value) })),
        };
        const result = await work(transaction);
        writes.forEach((write) => write());
        return result;
      });
      queue = run.catch(() => {});
      return run;
    },
  };
  return { db, records };
}

describe('Phase 3 server-controlled feature gate', () => {
  it('is disabled by default and cannot be enabled by request fields', () => {
    const gate = createTutorFeatureGate({});
    expect(gate.evaluate({ uid: 'user', enabled: true, rolloutPercentage: 100 })).toMatchObject({ enabled: false, state: 'disabled' });
  });

  it('uses a stable server-owned rollout bucket and supports an allowlist', () => {
    const gate = new TutorFeatureGate({ enabled: true, rolloutPercentage: 50, rolloutSalt: 'server-secret', allowlistedUids: ['internal-user'], version: 'canary-1' });
    expect(gate.evaluate({ uid: 'user-a' })).toEqual(gate.evaluate({ uid: 'user-a' }));
    expect(gate.evaluate({ uid: 'internal-user' })).toMatchObject({ enabled: true, state: 'allowlisted', version: 'canary-1' });
  });

  it('enforces exact zero and full rollout boundaries and an immediate kill switch', () => {
    const zero = new TutorFeatureGate({ enabled: true, rolloutPercentage: 0, rolloutSalt: 'server-secret' });
    const full = new TutorFeatureGate({ enabled: true, rolloutPercentage: 100, rolloutSalt: 'server-secret' });
    const killed = new TutorFeatureGate({ enabled: false, rolloutPercentage: 100, rolloutSalt: 'server-secret', allowlistedUids: ['internal-user'] });
    expect(zero.evaluate({ uid: 'user' })).toMatchObject({ enabled: false, state: 'outside-rollout' });
    expect(full.evaluate({ uid: 'user' })).toMatchObject({ enabled: true, state: 'enabled' });
    expect(killed.evaluate({ uid: 'internal-user' })).toMatchObject({ enabled: false, state: 'disabled' });
  });

  it('prevents provider construction when disabled', async () => {
    const providerFactory = vi.fn();
    await expect(explainCode(request, {
      principal: { uid: 'verified-user' },
      featureGate: new TutorFeatureGate(),
      quotaGuard: { assertAllowed: vi.fn() },
      providerFactory,
    })).rejects.toMatchObject({ code: 'ai/disabled', status: 503 });
    expect(providerFactory).not.toHaveBeenCalled();
  });

  it('renders a stable unavailable state without offering retry', async () => {
    const error = Object.assign(new Error('The AI Tutor is not available right now.'), { code: 'ai/disabled', retryable: false });
    render(<AITutorPanel accessTier="PREMIUM" language="python" code="print(1)" client={{ explain: vi.fn().mockRejectedValue(error) }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Explain full code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('not available');
    expect(screen.queryByRole('button', { name: 'Retry explanation' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Explain full code' })).toBeDisabled();
  });
});

describe('Phase 3 provider and model locking', () => {
  const production = {
    NODE_ENV: 'production', AI_PROVIDER: 'huggingface', AI_MODEL: 'approved-model',
    AI_TUTOR_APPROVED_PROVIDER: 'huggingface', AI_TUTOR_APPROVED_MODEL: 'approved-model', HF_TOKEN: 'server-token',
  };

  it('accepts an exact approved production provider/model', () => {
    expect(createTutorProviderConfiguration(production)).toEqual({ provider: 'huggingface', model: 'approved-model' });
    expect(createAIProvider(production).model).toBe('approved-model');
  });

  it.each([
    [{ ...production, AI_PROVIDER: '' }],
    [{ ...production, AI_MODEL: '' }],
    [{ ...production, AI_MODEL: 'client-selected-model' }],
    [{ ...production, AI_PROVIDER: 'openai', OPENAI_API_KEY: 'server-token' }],
    [{ ...production, AI_TUTOR_APPROVED_MODEL: '' }],
  ])('fails closed for an unapproved or incomplete production configuration', (environment) => {
      expect(() => createTutorProviderConfiguration(environment)).toThrowError(expect.objectContaining({ status: 503 }));
  });

  it('rejects unsupported providers, missing credentials, and invalid production token constraints', () => {
    expect(() => createTutorProviderConfiguration({ AI_PROVIDER: 'unsupported', AI_MODEL: 'model' })).toThrowError(expect.objectContaining({ code: 'ai/provider-unsupported' }));
    expect(() => createAIProvider({ AI_PROVIDER: 'huggingface', AI_MODEL: 'model' })).toThrowError(expect.objectContaining({ code: 'ai/not-configured' }));
    expect(() => createTutorProviderTokenConstraints({ NODE_ENV: 'production', AI_TUTOR_PROVIDER_MAX_INPUT_TOKENS: '', AI_TUTOR_PROVIDER_INPUT_OVERHEAD_TOKENS: '32' })).toThrowError(expect.objectContaining({ code: 'ai/not-configured' }));
    expect(() => createTutorProviderTokenConstraints({ NODE_ENV: 'production', AI_TUTOR_PROVIDER_MAX_INPUT_TOKENS: '4096', AI_TUTOR_PROVIDER_INPUT_OVERHEAD_TOKENS: '-1' })).toThrowError(expect.objectContaining({ code: 'ai/not-configured' }));
  });
});

describe('Phase 4.6 Firebase Admin production pinning', () => {
  it('requires an explicit production project and accepts workload identity configuration', () => {
    expect(() => resolveFirebaseAdminConfiguration({ NODE_ENV: 'production' })).toThrowError(expect.objectContaining({
      code: 'ai/server-unavailable', status: 503,
    }));
    expect(resolveFirebaseAdminConfiguration({ NODE_ENV: 'production', FIREBASE_PROJECT_ID: 'mi-tutora-pro' })).toEqual({
      projectId: 'mi-tutora-pro', serviceAccount: null,
    });
  });

  it('rejects a service account from a different project without exposing credential fields', () => {
    const serialized = JSON.stringify({ project_id: 'other-project', private_key: 'private-value' });
    let error;
    try {
      resolveFirebaseAdminConfiguration({
        NODE_ENV: 'production', FIREBASE_PROJECT_ID: 'mi-tutora-pro', FIREBASE_SERVICE_ACCOUNT_JSON: serialized,
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ code: 'ai/server-unavailable', publicMessage: 'AI Tutor server configuration is unavailable.' });
    expect(error.publicMessage).not.toContain('other-project');
    expect(error.publicMessage).not.toContain('private-value');
  });

  it('derives the project from a matching serialized service account outside production', () => {
    expect(resolveFirebaseAdminConfiguration({
      FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'local-project' }),
    })).toMatchObject({ projectId: 'local-project', serviceAccount: { project_id: 'local-project' } });
  });
});

describe('Phase 4.7B named quota database isolation', () => {
  const production = {
    NODE_ENV: 'production',
    FIREBASE_PROJECT_ID: 'mi-tutora-pro',
    AI_TUTOR_QUOTA_BACKEND: 'firestore',
    AI_TUTOR_QUOTA_DATABASE_ID: 'ai-tutor-quota',
    AI_TUTOR_QUOTA_IDENTITY_SALT: 'private-test-salt',
  };

  it('constructs the server client with the exact approved project and named database', () => {
    const constructed = [];
    const authClient = { getAccessToken: vi.fn() };
    class FakeFirestoreClient {
      constructor(settings) {
        constructed.push(settings);
        this.settings = settings;
      }
    }
    const client = createTutorQuotaFirestore(production, { FirestoreClient: FakeFirestoreClient, authClient });
    expect(client.settings).toEqual({ projectId: 'mi-tutora-pro', databaseId: 'ai-tutor-quota', authClient });
    expect(constructed).toHaveLength(1);
  });

  it.each([
    [{ ...production, AI_TUTOR_QUOTA_DATABASE_ID: '' }],
    [{ ...production, AI_TUTOR_QUOTA_DATABASE_ID: '(default)' }],
    [{ ...production, AI_TUTOR_QUOTA_DATABASE_ID: 'other-database' }],
    [{ ...production, AI_TUTOR_QUOTA_DATABASE_ID: 'Invalid_Database' }],
    [{ ...production, FIREBASE_PROJECT_ID: 'other-project' }],
  ])('rejects a missing, default, invalid, or unapproved production database binding', (environment) => {
    expect(() => createTutorQuotaFirestoreConfiguration(environment)).toThrowError(expect.objectContaining({
      code: 'ai/not-configured', status: 503,
    }));
  });

  it('allows explicit development database configuration without adding a default fallback', () => {
    expect(createTutorQuotaFirestoreConfiguration({
      FIREBASE_PROJECT_ID: 'local-project', AI_TUTOR_QUOTA_DATABASE_ID: 'local-quota',
    })).toEqual({ projectId: 'local-project', databaseId: 'local-quota' });
    expect(() => createTutorQuotaFirestoreConfiguration({ FIREBASE_PROJECT_ID: 'local-project' }))
      .toThrowError(expect.objectContaining({ code: 'ai/not-configured' }));
  });

  it('injects the named client into the existing database-agnostic quota store', async () => {
    const { db, records } = fakeFirestore();
    const createFirestore = vi.fn(() => db);
    const guard = createDefaultTutorQuotaGuard(production, { createFirestore, policy });
    await expect(guard.assertAllowed({
      uid: 'verified-user', requestId: 'named-database-request',
      usageEstimate: { inputTokens: 1, outputTokens: 1, costMicros: 1 },
    })).resolves.toMatchObject({ requestId: 'named-database-request', state: 'PENDING' });
    expect(createFirestore).toHaveBeenCalledOnce();
    expect(createFirestore).toHaveBeenCalledWith(production);
    expect(records.has('aiTutorQuotas/' + guard.identityKey('verified-user'))).toBe(true);
  });

  it('keeps Firebase Auth project configuration independent from quota database selection', () => {
    expect(resolveFirebaseAdminConfiguration({
      NODE_ENV: 'production', FIREBASE_PROJECT_ID: 'mi-tutora-pro',
    })).toEqual({ projectId: 'mi-tutora-pro', serviceAccount: null });
  });
});

describe('Phase 3 distributed quota contract and accounting', () => {
  it('atomically limits concurrent requests and separates hashed identities', async () => {
    const store = new ProcessLocalTutorQuotaStore({ now: () => 1_000 });
    const guard = new TutorQuotaGuard({ localStore: store, allowProcessLocal: true, policy, identitySalt: 'private-salt' });
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, index) => guard.assertAllowed({ uid: 'same-user', requestId: `request-${index}`, usageEstimate: { inputTokens: 1, outputTokens: 1, costMicros: 1 } })));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(2);
    expect(results.filter((result) => result.status === 'rejected').every((result) => result.reason.code === 'ai/rate-limited')).toBe(true);
    expect(guard.identityKey('same-user')).not.toContain('same-user');
    expect(guard.identityKey('same-user')).not.toBe(guard.identityKey('other-user'));
  });

  it('settles reservations idempotently and records actual token/cost use', async () => {
    const store = new ProcessLocalTutorQuotaStore({ now: () => 1_000 });
    const guard = new TutorQuotaGuard({ localStore: store, allowProcessLocal: true, policy, identitySalt: 'private-salt' });
    const reservation = await guard.assertAllowed({ uid: 'user', requestId: 'one', usageEstimate: { inputTokens: 10, outputTokens: 20, costMicros: 30 } });
    await guard.settle(reservation, { inputTokens: 3, outputTokens: 4, costMicros: 5, outcome: 'success' });
    await guard.settle(reservation, { inputTokens: 99, outputTokens: 99, costMicros: 99, outcome: 'duplicate' });
    expect(store.snapshot(reservation.identityKey).daily).toMatchObject({ requests: 1, inputTokens: 3, outputTokens: 4, costMicros: 5, reservedInputTokens: 0, reservedOutputTokens: 0 });
  });

  it('uses Firestore transactions for atomic distributed reservation and settlement', async () => {
    const { db, records } = fakeFirestore();
    const store = new FirestoreTutorQuotaStore({ db, now: () => 2_000 });
    const reservations = await Promise.allSettled(Array.from({ length: 3 }, (_, index) => store.reserve({ identityKey: 'hashed-user', requestId: `firestore-${index}`, policy, estimate: { inputTokens: 1, outputTokens: 1, costMicros: 1 } })));
    expect(reservations.filter((result) => result.status === 'fulfilled')).toHaveLength(2);
    const reservation = reservations.find((result) => result.status === 'fulfilled').value;
    await store.settle(reservation, { inputTokens: 1, outputTokens: 1, costMicros: 1, outcome: 'success' });
    await store.settle(reservation, { inputTokens: 50, outputTokens: 50, costMicros: 50, outcome: 'duplicate' });
    expect(records.get('aiTutorQuotas/hashed-user').daily).toMatchObject({ requests: 2, inputTokens: 1, outputTokens: 1, reservedInputTokens: 1, reservedOutputTokens: 1 });
    expect(records.get(`aiTutorQuotaReservations/${reservation.requestId}`)).toMatchObject({ state: 'SETTLED', outcome: 'success' });
  });

  it('rejects a conflicting Firestore reservation without changing quota state', async () => {
    const { db, records } = fakeFirestore();
    const store = new FirestoreTutorQuotaStore({ db, now: () => 2_000 });
    const input = { identityKey: 'hashed-user', requestId: 'stable-request', policy, estimate: { inputTokens: 1, outputTokens: 1, costMicros: 1 }, maximum: { inputTokens: 2, outputTokens: 2, costMicros: 2 } };
    const first = await store.reserve(input);
    await expect(store.reserve({ ...input, maximum: { inputTokens: 3, outputTokens: 2, costMicros: 2 } })).rejects.toMatchObject({ code: 'ai/idempotency-conflict', status: 409 });
    expect(records.get('aiTutorQuotaReservations/stable-request')).toEqual(first);
    expect(records.get('aiTutorQuotas/hashed-user').daily).toMatchObject({ requests: 1, reservedInputTokens: 2, reservedOutputTokens: 2 });
  });

  it('rejects settlement when the supplied identity differs from the persisted reservation owner', async () => {
    const { db, records } = fakeFirestore();
    const store = new FirestoreTutorQuotaStore({ db, now: () => 2_000 });
    const reservation = await store.reserve({
      identityKey: 'hashed-user', requestId: 'owned-reservation', policy,
      estimate: { inputTokens: 1, outputTokens: 1, costMicros: 1 },
      maximum: { inputTokens: 2, outputTokens: 2, costMicros: 2 },
    });
    const before = structuredClone(records.get('aiTutorQuotas/hashed-user'));
    await expect(store.settle({ ...reservation, identityKey: 'other-hashed-user' }, {
      inputTokens: 1, outputTokens: 1, costMicros: 1, outcome: 'success',
    })).rejects.toMatchObject({ code: 'ai/idempotency-conflict', status: 409 });
    expect(records.get('aiTutorQuotas/hashed-user')).toEqual(before);
    expect(records.get('aiTutorQuotas/other-hashed-user')).toBeUndefined();
    expect(records.get('aiTutorQuotaReservations/owned-reservation')).toMatchObject({ state: 'PENDING', identityKey: 'hashed-user' });
  });

  it('fails closed in production without an approved backend and explicit limits', async () => {
    const guard = createDefaultTutorQuotaGuard({ NODE_ENV: 'production', AI_TUTOR_QUOTA_BACKEND: '' });
    await expect(guard.assertAllowed({ uid: 'user' })).rejects.toMatchObject({ code: 'ai/quota-unavailable' });
  });

  it('charges malformed requests to request quota without charging provider tokens', async () => {
    const store = new ProcessLocalTutorQuotaStore({ now: () => 1_000 });
    const guard = new TutorQuotaGuard({ localStore: store, allowProcessLocal: true, policy, identitySalt: 'private-salt' });
    await expect(explainCode({}, { principal: { uid: 'user' }, featureGate: enabledGate, quotaGuard: guard })).rejects.toMatchObject({ code: 'ai/invalid-request' });
    expect(store.snapshot(guard.identityKey('user')).daily).toMatchObject({ requests: 1, inputTokens: 0, outputTokens: 0, reservedInputTokens: 0, reservedOutputTokens: 0 });
  });

  it('charges known provider usage even when the response is rejected as unsafe', async () => {
    const store = new ProcessLocalTutorQuotaStore({ now: () => 1_000 });
    const guard = new TutorQuotaGuard({ localStore: store, allowProcessLocal: true, policy, identitySalt: 'private-salt' });
    const provider = { getMetadata: () => ({ provider: 'mock', model: 'locked' }), explain: vi.fn().mockResolvedValue({ text: structured('Here is the complete solution:\ndef solve(values):\n total = sum(values)\n print(total)\n return total'), usage: { prompt_tokens: 5, completion_tokens: 6 } }) };
    await expect(explainCode(request, { principal: { uid: 'user' }, featureGate: enabledGate, quotaGuard: guard, providerFactory: () => provider, pricing: zeroPricing })).rejects.toMatchObject({ code: 'ai/unsafe-response' });
    expect(store.snapshot(guard.identityKey('user')).daily).toMatchObject({ requests: 1, inputTokens: 5, outputTokens: 6, reservedInputTokens: 0, reservedOutputTokens: 0 });
  });

  it('conservatively charges the reservation after an invoked provider fails without usage', async () => {
    const store = new ProcessLocalTutorQuotaStore({ now: () => 1_000 });
    const guard = new TutorQuotaGuard({ localStore: store, allowProcessLocal: true, policy, identitySalt: 'private-salt' });
    const provider = { getMetadata: () => ({ provider: 'mock', model: 'locked' }), explain: vi.fn().mockRejectedValue(new AIServiceError('ai/provider-unavailable', 'Unavailable', { status: 502 })) };
    await expect(explainCode(request, { principal: { uid: 'user' }, featureGate: enabledGate, quotaGuard: guard, providerFactory: () => provider, pricing: zeroPricing })).rejects.toMatchObject({ code: 'ai/provider-unavailable' });
    const daily = store.snapshot(guard.identityKey('user')).daily;
    expect(daily.requests).toBe(1);
    expect(daily.inputTokens).toBeGreaterThan(0);
    expect(daily.outputTokens).toBe(1_200);
    expect(daily.reservedOutputTokens).toBe(0);
  });

  it('requires explicit production quota policy while providing deterministic local defaults', () => {
    expect(createTutorQuotaPolicy({}).daily.requests).toBe(100);
    expect(() => createTutorQuotaPolicy({ NODE_ENV: 'production' })).toThrowError(expect.objectContaining({ code: 'ai/not-configured' }));
  });
});

describe('Phase 3 usage, telemetry, and alert boundaries', () => {
  it('keeps cost unknown without server pricing and calculates configured estimates', () => {
    const unknown = createTutorPricingConfiguration({});
    expect(estimateTutorRequestUsage(request, unknown).costMicros).toBeNull();
    const known = createTutorPricingConfiguration({ AI_TUTOR_INPUT_USD_PER_MILLION_TOKENS: '2', AI_TUTOR_OUTPUT_USD_PER_MILLION_TOKENS: '4' });
    expect(estimateCostMicros({ inputTokens: 100, outputTokens: 50 }, known)).toBe(400);
    expect(normalizeProviderUsage({ inputTokens: 3, outputTokens: 4 }, { inputTokens: 10, outputTokens: 20 }, known)).toMatchObject({ inputTokens: 3, outputTokens: 4, tokenUsageKnown: true, costKnown: true });
  });

  it('strictly allowlists telemetry and excludes identity/content/credentials', () => {
    const event = createTutorTelemetryEvent({ provider: 'test', operation: 'explain-full-code', uid: 'private-user', code: 'private-code', prompt: 'private-prompt', token: 'private-token', success: false });
    expect(event).toMatchObject({ event: 'ai_tutor.request', provider: 'test', operation: 'explain-full-code', success: false });
    expect(JSON.stringify(event)).not.toMatch(/private-user|private-code|private-prompt|private-token/);
  });

  it('keeps telemetry failures out of the tutor result and emits a sanitized pipeline alert', async () => {
    const alerts = [];
    const telemetry = new TutorTelemetry({ sink: { record: () => Promise.reject(new Error('private payload')) }, onFailure: (event) => alerts.push(event) });
    expect(() => telemetry.record({ success: true, code: 'private-code' })).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    expect(alerts).toEqual([{ type: 'telemetry-pipeline-failure', severity: 'high' }]);
  });

  it('generates provider-neutral spike alerts without learner data', () => {
    const emitted = [];
    const evaluator = new InMemoryTutorAlertEvaluator({ sink: { emit: (event) => emitted.push(event) }, now: () => 1_000, policies: { providerTimeouts: { threshold: 2, windowMs: 60_000 }, requestVolume: { threshold: 99 } } });
    evaluator.record({ errorCategory: 'ai/provider-timeout', uid: 'private-user' });
    evaluator.record({ errorCategory: 'ai/provider-timeout', code: 'private-code' });
    expect(emitted).toContainEqual(expect.objectContaining({ type: 'provider-timeout-rate', observed: 2, threshold: 2 }));
    expect(JSON.stringify(emitted)).not.toMatch(/private-user|private-code/);
  });

  it('connects structured telemetry to local alert evaluation without a platform dependency', () => {
    const written = [];
    const telemetry = createOperationalTutorTelemetry({ write: (event) => written.push(event), alertSink: { emit: vi.fn() } });
    expect(() => telemetry.record({ provider: 'test', success: true })).not.toThrow();
    expect(written).toHaveLength(1);
  });
});

describe('Phase 3 safe initial activity and evaluation policy', () => {
  it('keeps even a trusted lesson at Level 1 hints-only', async () => {
    const resolver = new TrustedActivityPolicyResolver({ resolveTrustedContext: async () => ({ activityType: 'lesson' }) });
    await expect(resolver.resolve({ principal: { uid: 'user' }, activityHint: 'lesson' })).resolves.toMatchObject({ activityType: 'lesson', solutionPolicy: 'hints-only', maximumHintLevel: 1 });
  });

  it('records only sanitized controlled-evaluation metadata', async () => {
    const harness = new AdversarialEvaluationHarness({ now: () => 10 });
    const results = await harness.run(PHASE_3_SYNTHETIC_EVALUATION_CASES.slice(0, 2), async () => ({ privateResponse: 'never-record' }), { provider: 'mock-provider', model: 'locked-model', policyVersion: 'ai-tutor-v1' });
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ provider: 'mock-provider', model: 'locked-model', policyVersion: 'ai-tutor-v1', passed: true });
    expect(JSON.stringify(results)).not.toContain('never-record');
  });

  it('does not invoke the provider when quota evaluation fails', async () => {
    const providerFactory = vi.fn();
    await expect(explainCode(request, { principal: { uid: 'user' }, featureGate: enabledGate, quotaGuard: { assertAllowed: vi.fn().mockRejectedValue(new AIServiceError('ai/quota-unavailable', 'Unavailable', { status: 503 })) }, providerFactory })).rejects.toMatchObject({ code: 'ai/quota-unavailable' });
    expect(providerFactory).not.toHaveBeenCalled();
  });
});
