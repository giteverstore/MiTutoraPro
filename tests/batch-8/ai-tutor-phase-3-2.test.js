import { describe, expect, it } from 'vitest';
import { AIServiceError } from '../../server/ai/AIServiceError.js';
import { applyQuotaReservation, applyQuotaSettlement } from '../../server/ai/quota/FirestoreTutorQuotaStore.js';
import { ProcessLocalTutorQuotaStore, TutorQuotaGuard } from '../../server/ai/tutor/tutorQuota.js';
import { createTutorPricingConfiguration } from '../../server/ai/tutor/tutorRuntimeConfig.js';
import { createTutorUsagePlan, estimateCostMicros, usageFitsReservation } from '../../server/ai/tutor/tutorUsage.js';
import {
  inspectProviderRejection,
  MAX_PROVIDER_ERROR_BYTES,
  providerHttpError,
} from '../../server/ai/providerTransport.js';
import { classifyAIError } from '../../server/ai/aiErrorTaxonomy.js';
import { AdversarialEvaluationHarness } from '../../server/ai/evaluation/AdversarialEvaluationHarness.js';
import { assertCompletePhase32EvaluationMatrix, PHASE_32_DETERMINISTIC_CASES, PHASE_32_EVALUATION_MATRIX, PHASE_32_EXACT_MODEL_CASES } from '../../server/ai/evaluation/Phase32EvaluationMatrix.js';

const policy = (overrides = {}) => ({
  burst: { requests: 20, windowMs: 10_000 },
  sustained: { requests: 20, windowMs: 60_000 },
  hourly: { requests: 20, windowMs: 3_600_000 },
  daily: { requests: 20, inputTokens: 100, outputTokens: 50, costMicros: null, ...overrides },
});
const use = (inputTokens, outputTokens, costMicros = null) => ({ inputTokens, outputTokens, costMicros });
const pricing = createTutorPricingConfiguration({
  AI_TUTOR_INPUT_USD_PER_MILLION_TOKENS: '2.500001',
  AI_TUTOR_OUTPUT_USD_PER_MILLION_TOKENS: '4.000003',
});

describe('Phase 3.2 hard quota reservations', () => {
  it('accepts an exact remaining token ceiling and rejects one token above it', () => {
    const accepted = applyQuotaReservation(null, { now: 1, policy: policy(), maximum: use(100, 50) });
    expect(accepted.daily).toMatchObject({ reservedInputTokens: 100, reservedOutputTokens: 50 });
    expect(() => applyQuotaReservation(null, { now: 1, policy: policy(), maximum: use(101, 50) })).toThrowError(expect.objectContaining({ code: 'ai/rate-limited' }));
  });

  it('enforces an exact integer cost ceiling', () => {
    expect(() => applyQuotaReservation(null, { now: 1, policy: policy({ costMicros: 9 }), maximum: use(1, 1, 9) })).not.toThrow();
    expect(() => applyQuotaReservation(null, { now: 1, policy: policy({ costMicros: 8 }), maximum: use(1, 1, 9) })).toThrowError(expect.objectContaining({ code: 'ai/rate-limited' }));
  });

  it('fails closed when a monetary ceiling has no known request cost', () => {
    expect(() => applyQuotaReservation(null, { now: 1, policy: policy({ costMicros: 10 }), maximum: use(1, 1, null) })).toThrowError(expect.objectContaining({ code: 'ai/quota-unavailable' }));
    expect(() => applyQuotaReservation(null, { now: 1, policy: policy(), maximum: use(1, 1, null) })).not.toThrow();
  });

  it('rejects production-style cost configuration when pricing is unavailable', () => {
    expect(() => createTutorPricingConfiguration({ AI_TUTOR_QUOTA_DAILY_COST_MICROS: '100' })).toThrowError(expect.objectContaining({ code: 'ai/not-configured' }));
  });

  it('uses deterministic integer micro-unit arithmetic', () => {
    expect(estimateCostMicros(use(1_000_000, 1_000_000), pricing)).toBe(6_500_004);
    expect(estimateCostMicros(use(1, 1), pricing)).toBe(7);
  });

  it('releases unused capacity and accounts for actual usage below the maximum', () => {
    const maximum = use(80, 40);
    const reserved = applyQuotaReservation(null, { now: 1, policy: policy(), maximum });
    const settled = applyQuotaSettlement(reserved, { estimate: use(20, 10), maximum }, { ...use(15, 7), now: 2 });
    expect(settled.daily).toMatchObject({ inputTokens: 15, outputTokens: 7, reservedInputTokens: 0, reservedOutputTokens: 0 });
  });

  it('accepts actual usage above the estimate when it remains within the maximum', () => {
    expect(usageFitsReservation(use(30, 20), { estimate: use(10, 10), maximum: use(40, 30) })).toBe(true);
    expect(usageFitsReservation(use(41, 20), { estimate: use(10, 10), maximum: use(40, 30) })).toBe(false);
  });

  it('charges the conservative maximum when provider usage is unavailable', () => {
    const maximum = use(80, 40);
    const reserved = applyQuotaReservation(null, { now: 1, policy: policy(), maximum });
    const settled = applyQuotaSettlement(reserved, { estimate: use(20, 10), maximum }, { chargeEstimate: true, now: 2 });
    expect(settled.daily).toMatchObject({ inputTokens: 80, outputTokens: 40, reservedInputTokens: 0, reservedOutputTokens: 0 });
  });

  it('defensively charges the maximum for missing or contradictory provider usage', () => {
    const maximum = use(80, 40, 20);
    const reserved = applyQuotaReservation(null, { now: 1, policy: policy({ costMicros: 20 }), maximum });
    const missingCost = applyQuotaSettlement(reserved, { estimate: use(20, 10, 5), maximum }, { inputTokens: 20, outputTokens: 10, costMicros: null, now: 2 });
    expect(missingCost.daily).toMatchObject({ inputTokens: 80, outputTokens: 40, costMicros: 20 });
  });

  it('atomically caps multiple concurrent reservations at the cumulative ceiling', async () => {
    const guard = new TutorQuotaGuard({
      localStore: new ProcessLocalTutorQuotaStore({ now: () => 1 }), allowProcessLocal: true,
      policy: policy(), identitySalt: 'phase-3-2',
    });
    const results = await Promise.allSettled(Array.from({ length: 5 }, (_, index) => guard.assertAllowed({
      uid: 'same-user', requestId: `concurrent-${index}`, usageEstimate: use(10, 5), usageMaximum: use(25, 10),
    })));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(4);
    const snapshot = guard.localStore.snapshot(guard.identityKey('same-user'));
    expect(snapshot.daily.reservedInputTokens).toBe(100);
    expect(snapshot.daily.reservedOutputTokens).toBe(40);
  });

  it('keeps duplicate reservation and settlement operations idempotent', async () => {
    const store = new ProcessLocalTutorQuotaStore({ now: () => 1 });
    const input = { identityKey: 'hashed', requestId: 'same', policy: policy(), estimate: use(2, 1), maximum: use(10, 5) };
    const first = await store.reserve(input);
    const duplicate = await store.reserve({ ...input, estimate: use(2, 1), maximum: use(10, 5) });
    expect(duplicate).toBe(first);
    await store.settle(first, { ...use(4, 2), now: 2 });
    await store.settle(first, { ...use(99, 49), now: 3 });
    expect(store.snapshot('hashed').daily).toMatchObject({ requests: 1, inputTokens: 4, outputTokens: 2 });
  });

  it.each([
    ['a different identity', { identityKey: 'other-hash' }],
    ['a different estimate', { estimate: use(3, 1) }],
    ['a different maximum', { maximum: use(11, 5) }],
  ])('rejects a duplicate request ID bound to %s', async (_, conflict) => {
    const store = new ProcessLocalTutorQuotaStore({ now: () => 1 });
    const input = { identityKey: 'hashed', requestId: 'same', policy: policy(), estimate: use(2, 1), maximum: use(10, 5) };
    await store.reserve(input);
    await expect(store.reserve({ ...input, ...conflict })).rejects.toMatchObject({
      code: 'ai/idempotency-conflict', status: 409,
    });
    expect(store.snapshot('hashed').daily).toMatchObject({ requests: 1, reservedInputTokens: 10, reservedOutputTokens: 5 });
  });

  it('coalesces concurrent identical reservation IDs without double charging', async () => {
    const store = new ProcessLocalTutorQuotaStore({ now: () => 1 });
    const input = { identityKey: 'hashed', requestId: 'concurrent-same', policy: policy(), estimate: use(2, 1), maximum: use(10, 5) };
    const [first, second] = await Promise.all([store.reserve(input), store.reserve({ ...input })]);
    expect(second).toBe(first);
    expect(store.snapshot('hashed').daily).toMatchObject({ requests: 1, reservedInputTokens: 10, reservedOutputTokens: 5 });
  });

  it('leaves abandoned reservations conservatively reserved', async () => {
    const store = new ProcessLocalTutorQuotaStore({ now: () => 1 });
    await store.reserve({ identityKey: 'hashed', requestId: 'abandoned', policy: policy(), estimate: use(2, 1), maximum: use(70, 30) });
    expect(store.snapshot('hashed').daily).toMatchObject({ reservedInputTokens: 70, reservedOutputTokens: 30 });
  });

  it('resets daily counters at the UTC day boundary without carrying old reservations forward', () => {
    const beforeMidnight = Date.UTC(2026, 7, 28, 23, 59, 59);
    const afterMidnight = Date.UTC(2026, 7, 29, 0, 0, 1);
    const first = applyQuotaReservation(null, { now: beforeMidnight, policy: policy(), maximum: use(70, 30) });
    const nextDay = applyQuotaReservation(first, { now: afterMidnight, policy: policy(), maximum: use(10, 5) });
    expect(nextDay.daily).toMatchObject({
      startedAt: Date.UTC(2026, 7, 29), requests: 1,
      inputTokens: 0, outputTokens: 0,
      reservedInputTokens: 10, reservedOutputTokens: 5,
    });
  });

  it('isolates concurrent quotas for different HMAC identities', async () => {
    const store = new ProcessLocalTutorQuotaStore({ now: () => 1 });
    const strictPolicy = { ...policy(), burst: { requests: 1, windowMs: 10_000 } };
    const [first, second] = await Promise.all([
      store.reserve({ identityKey: 'hash-a', requestId: 'a', policy: strictPolicy, estimate: use(1, 1), maximum: use(1, 1) }),
      store.reserve({ identityKey: 'hash-b', requestId: 'b', policy: strictPolicy, estimate: use(1, 1), maximum: use(1, 1) }),
    ]);
    expect(first.identityKey).toBe('hash-a');
    expect(second.identityKey).toBe('hash-b');
    expect(store.snapshot('hash-a').daily.requests).toBe(1);
    expect(store.snapshot('hash-b').daily.requests).toBe(1);
  });

  it('derives bounded input/output maxima from the exact outbound tutor request', () => {
    const plan = createTutorUsagePlan({
      systemInstruction: 'system', userContent: 'x'.repeat(100), targetResponseTokens: 350, maxProviderTokens: 1_200,
    }, pricing, { maxInputTokens: 200, inputOverheadTokens: 10 });
    expect(plan.maximum).toMatchObject({ inputTokens: 117, outputTokens: 1_200 });
    expect(plan.estimate.inputTokens).toBeLessThan(plan.maximum.inputTokens);
  });

  it('rejects an outbound request above the approved provider/model input maximum', () => {
    expect(() => createTutorUsagePlan({
      systemInstruction: 'system', userContent: 'x'.repeat(100), targetResponseTokens: 350, maxProviderTokens: 1_200,
    }, pricing, { maxInputTokens: 116, inputOverheadTokens: 10 })).toThrowError(expect.objectContaining({ code: 'ai/request-too-large' }));
  });

  it('normalizes quota backend failures without exposing their cause', async () => {
    const guard = new TutorQuotaGuard({
      distributedStore: { reserve: async () => { throw new Error('private datastore detail'); } },
      policy: policy(), identitySalt: 'phase-3-2',
    });
    await expect(guard.assertAllowed({ uid: 'user', usageMaximum: use(1, 1) })).rejects.toEqual(expect.objectContaining({
      code: 'ai/quota-unavailable', publicMessage: 'The AI Tutor is temporarily unavailable.',
    }));
  });
});

describe('Phase 3.2 failure charging policy', () => {
  it.each(['provider-failure', 'timeout', 'cancellation'])('%s consumes its authorized maximum when usage is unavailable', (outcome) => {
    const maximum = use(50, 25);
    const reserved = applyQuotaReservation(null, { now: 1, policy: policy(), maximum });
    const settled = applyQuotaSettlement(reserved, { estimate: use(10, 5), maximum }, { chargeEstimate: true, outcome, now: 2 });
    expect(settled.daily).toMatchObject({ inputTokens: 50, outputTokens: 25 });
  });

  it.each([
    [408, 'ai/provider-timeout', true], [429, 'ai/provider-rate-limited', true],
    [500, 'ai/provider-unavailable', true], [502, 'ai/provider-unavailable', true], [503, 'ai/provider-unavailable', true],
    [400, 'ai/provider-rejected', false], [402, 'ai/provider-rejected', false], [422, 'ai/provider-rejected', false],
  ])('normalizes provider HTTP %i without response details', (status, code, retryable) => {
    const error = providerHttpError(status);
    expect(classifyAIError(error)).toMatchObject({ code, retryable });
    expect(error.publicMessage).not.toContain(String(status));
  });
});

describe('bounded provider rejection observability', () => {
  const rejection = (status, payload) => {
    if (payload === undefined) return { status, body: null };
    const bytes = new TextEncoder().encode(typeof payload === 'string' ? payload : JSON.stringify(payload));
    let consumed = false;
    return {
      status,
      body: {
        getReader: () => ({
          read: async () => consumed ? { done: true } : (consumed = true, { done: false, value: bytes }),
          cancel: async () => {},
          releaseLock: () => {},
        }),
      },
    };
  };

  it.each([
    ['known allowlisted code', 400, { error: { code: 'content_filter' } }, 400, 'provider-content-policy', 'safety-rejected'],
    ['unknown code', 400, { error: { code: 'arbitrary-private-code' } }, 400, 'unknown', 'request-rejected'],
    ['message-only body', 400, { error: { message: 'private provider message' } }, 400, 'unknown', 'request-rejected'],
    ['missing body', 400, undefined, 400, 'unknown', 'request-rejected'],
    ['malformed body', 400, '{not-json', 400, 'unknown', 'request-rejected'],
    ['unexpected nested shape', 400, { error: { nested: { code: 'content_filter' } } }, 400, 'unknown', 'request-rejected'],
    ['array body', 400, [{ error: { code: 'content_filter' } }], 400, 'unknown', 'request-rejected'],
    ['authentication rejection', 401, { error: { code: 'content_filter' } }, 401, 'provider-content-policy', 'authentication-failed'],
    ['authorization rejection', 403, undefined, 403, 'unknown', 'authentication-failed'],
    ['missing model', 404, undefined, 404, 'unknown', 'model-unavailable'],
    ['provider timeout', 408, undefined, 408, 'unknown', 'timeout'],
    ['provider rate limit', 429, undefined, 429, 'unknown', 'rate-limited'],
    ['provider unavailable', 503, undefined, 503, 'unknown', 'transient-provider-error'],
    ['other provider rejection', 422, undefined, 422, 'unknown', 'request-rejected'],
  ])('sanitizes %s', async (_, status, payload, providerStatus, providerCode, providerClassification) => {
    await expect(inspectProviderRejection(rejection(status, payload))).resolves.toEqual({
      providerStatus,
      providerCode,
      providerClassification,
    });
  });

  it('falls back safely for missing and invalid statuses', async () => {
    const body = rejection(400, { error: { code: 'content_filter' } }).body;
    await expect(inspectProviderRejection({ body })).resolves.toEqual({
      providerStatus: null,
      providerCode: 'provider-content-policy',
      providerClassification: 'unknown',
    });
    await expect(inspectProviderRejection({ status: 999, body: null })).resolves.toEqual({
      providerStatus: null,
      providerCode: 'unknown',
      providerClassification: 'unknown',
    });
  });

  it('discards oversized response content without retaining it', async () => {
    const marker = 'private-oversized-provider-detail';
    const diagnostic = await inspectProviderRejection(rejection(400, {
      error: { code: 'content_filter', message: marker.repeat(MAX_PROVIDER_ERROR_BYTES) },
    }));
    expect(diagnostic).toEqual({ providerStatus: 400, providerCode: 'unknown', providerClassification: 'request-rejected' });
    expect(JSON.stringify(diagnostic)).not.toContain(marker);
  });

  it('preserves public taxonomy while attaching only sanitized internal metadata', async () => {
    const marker = 'private-body-detail';
    const diagnostic = await inspectProviderRejection(rejection(400, {
      error: { code: 'content_filter', message: marker },
    }));
    const error = providerHttpError(400, diagnostic);
    expect(classifyAIError(error)).toMatchObject({ code: 'ai/provider-rejected', retryable: false });
    expect(error.providerDiagnostic).toEqual({ providerStatus: 400, providerCode: 'provider-content-policy', providerClassification: 'safety-rejected' });
    expect(JSON.stringify(error)).not.toContain(marker);
    expect(error).not.toHaveProperty('headers');
    expect(error).not.toHaveProperty('body');
  });

  it('records allowlisted diagnostics without changing evaluation rejection accounting', async () => {
    const harness = new AdversarialEvaluationHarness({ now: () => 10 });
    const scenario = { id: 'provider-rejection', category: 'provider-failure', expectedPolicy: 'usable-response', expectAllowed: true };
    const error = providerHttpError(400, { providerCode: 'provider-content-policy' });
    const results = await harness.run([scenario], async () => { throw error; }, { provider: 'huggingface', model: 'approved' });
    expect(results[0]).toMatchObject({
      passed: false,
      classification: 'ai/provider-rejected',
      errorCategory: 'ai/provider-rejected',
      providerStatus: 400,
      providerCode: 'provider-content-policy',
      providerClassification: 'safety-rejected',
    });
    expect(JSON.stringify(results)).not.toContain('Authorization');
  });
});

describe('Phase 3.2 complete adversarial evaluation matrix', () => {
  it('contains unique coverage for every required exact-model and deterministic boundary', () => {
    const coverage = assertCompletePhase32EvaluationMatrix();
    expect(coverage).toEqual({ total: PHASE_32_EVALUATION_MATRIX.length, exactModel: 17, deterministic: PHASE_32_DETERMINISTIC_CASES.length });
    expect(new Set(PHASE_32_EVALUATION_MATRIX.map((item) => item.category))).toEqual(new Set([
      'prompt-injection', 'solution-leakage', 'sensitive-content', 'compiler-evidence', 'response-structure',
      'provider-failure', 'policy-escalation', 'client-bypass', 'feature-flag', 'quota',
    ]));
  });

  it('uses synthetic inputs and semantic release assertions for every exact-model case', () => {
    for (const scenario of PHASE_32_EXACT_MODEL_CASES) {
      expect(scenario.request.code).toEqual(expect.any(String));
      expect(scenario.request).not.toHaveProperty('uid');
      expect(scenario.request).not.toHaveProperty('credential');
      expect(scenario.classify).toEqual(expect.any(Function));
      expect(scenario.assert).toEqual(expect.any(Function));
    }
  });

  it('records response size and classifications without retaining synthetic payloads', async () => {
    const harness = new AdversarialEvaluationHarness({ now: () => 10 });
    const scenario = PHASE_32_EXACT_MODEL_CASES[0];
    const results = await harness.run([scenario], async () => ({ summary: 'Safe conceptual guidance.' }), { provider: 'mock', model: 'approved' });
    expect(results[0]).toMatchObject({ passed: true, responseBytes: expect.any(Number), errorCategory: 'none' });
    expect(JSON.stringify(results)).not.toContain(scenario.request.code);
  });
});
