import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AITutorClient, AITutorClientError } from '../../src/ai/AITutorClient.js';
import { AITutorPanel } from '../../src/ai/AITutorPanel.jsx';
import { validateAITutorResponse } from '../../src/ai/validateAITutorResponse.js';
import { classifyAIError } from '../../server/ai/aiErrorTaxonomy.js';
import { AdversarialEvaluationHarness } from '../../server/ai/evaluation/AdversarialEvaluationHarness.js';
import { AIServiceError } from '../../server/ai/AIServiceError.js';
import { explainCode, normalizeExplainRequest } from '../../server/ai/explainHandler.js';
import { createSourceSnapshotHash } from '../../server/ai/tutor/sourceSnapshot.js';
import { TutorSensitiveContentInspector } from '../../server/ai/tutor/tutorSensitiveContent.js';
import { parseTutorResponseText } from '../../server/ai/tutor/tutorResponseSchema.js';

const code = 'print("hello")';
const policy = { activityType: 'practice', solutionPolicy: 'hints-only', maximumHintLevel: 1 };
const request = (overrides = {}) => ({ requestType: 'explain-full-code', language: 'python', code, compilerStatus: 'ready', lessonContext: 'Printing', ...overrides });
const valid = (overrides = {}) => ({ schemaVersion: '1', policyVersion: 'ai-tutor-v1', operation: 'explain-full-code', evidence: { basis: 'static', note: 'Static.' }, summary: 'The program prints a value.', sections: [], codeReferences: [], concepts: [], issues: [], nextStep: { kind: 'run', text: 'Run it.' }, ...overrides });
const enabledFeatureGate = { assertEnabled: () => ({ enabled: true, state: 'enabled', bucket: 1, version: 'test' }) };

describe('outbound sensitive-content boundary', () => {
  const inspector = new TutorSensitiveContentInspector();
  it.each([
    ['API key', `api_key = "sk-${'a'.repeat(24)}"`],
    ['bearer', `token = "Bearer ${'a'.repeat(24)}"`],
    ['private key', ['-----BEGIN PRIVATE', ' KEY-----\nabc\n-----END PRIVATE', ' KEY-----'].join('')],
    ['service account', `credentials = '{"private_key":"${['-----BEGIN PRIVATE', ' KEY-----\\nabc\\n-----END PRIVATE', ' KEY-----'].join('')}"}'`],
    ['password', 'password = "correct-horse-battery"'],
    ['database URI', 'url = "postgres://admin:secret-password@db.example/app"'],
    ['JWT', `token = "eyJ${'a'.repeat(12)}.${'b'.repeat(12)}.${'c'.repeat(12)}"`],
    ['comment', `# hf_${'a'.repeat(24)}\nprint(1)`],
  ])('fails closed for a secret in learner code: %s', (_, source) => {
    expect(() => inspector.inspect(normalizeExplainRequest(request({ code: source }), { activityPolicy: policy }))).toThrowError(expect.objectContaining({ code: 'ai/sensitive-content' }));
  });

  it('redacts output and title secrets while preserving the request structure', () => {
    const secret = `ghp_${'a'.repeat(32)}`;
    const context = normalizeExplainRequest(request({ lessonContext: `Token ${secret}`, compilerStatus: 'success', compilerEvidence: { source: code, sourceHash: createSourceSnapshotHash(code), language: 'python', status: 'success', output: `Bearer ${'b'.repeat(24)}` } }), { activityPolicy: policy });
    const safe = inspector.inspect(context);
    expect(safe.lessonContext).toContain('[REDACTED]');
    expect(safe.compilerOutput).toBe('[REDACTED]');
    expect(JSON.stringify(safe)).not.toContain(secret);
    expect(safe).toMatchObject({ operation: context.operation, language: context.language, code: context.code });
  });

  it('allows harmless placeholders and examples', () => {
    const context = normalizeExplainRequest(request({ code: 'api_key = "YOUR_API_KEY"\nprint(api_key)' }), { activityPolicy: policy });
    expect(inspector.inspect(context).code).toContain('YOUR_API_KEY');
  });

  it('blocks multiple secrets before provider construction without exposing them', async () => {
    const providerFactory = vi.fn();
    const secretCode = `token = "hf_${'a'.repeat(24)}"\npassword = "private-password"`;
    await expect(explainCode(request({ code: secretCode }), {
      principal: { uid: 'user' }, featureGate: enabledFeatureGate, quotaGuard: { assertAllowed: vi.fn() }, providerFactory,
      activityPolicyResolver: { resolve: async () => policy },
    })).rejects.toMatchObject({ code: 'ai/sensitive-content' });
    expect(providerFactory).not.toHaveBeenCalled();
  });
});

describe('selection snapshot verification', () => {
  const selectedCode = 'print';
  const snapshot = (overrides = {}) => ({ startOffset: 0, endOffset: 5, sourceHash: createSourceSnapshotHash(code), selectionHash: createSourceSnapshotHash(selectedCode), language: 'python', ...overrides });
  const selectionRequest = (overrides = {}) => request({ requestType: 'explain-selection', selectedCode, selectionSnapshot: snapshot(), ...overrides });

  it('accepts an exact selection and leaves full-code requests unaffected', () => {
    expect(normalizeExplainRequest(selectionRequest(), { activityPolicy: policy }).selection).toMatchObject({ startOffset: 0, endOffset: 5 });
    expect(normalizeExplainRequest(request(), { activityPolicy: policy }).selection).toBeNull();
  });

  it.each([
    ['edited source', { code: `${code} ` }],
    ['coordinates', { selectionSnapshot: snapshot({ startOffset: 1, endOffset: 6 }) }],
    ['selected text', { selectedCode: 'Print' }],
    ['source hash', { selectionSnapshot: snapshot({ sourceHash: createSourceSnapshotHash('forged') }) }],
    ['selection hash', { selectionSnapshot: snapshot({ selectionHash: createSourceSnapshotHash('forged') }) }],
    ['language', { selectionSnapshot: snapshot({ language: 'java' }) }],
    ['bounds', { selectionSnapshot: snapshot({ endOffset: 500 }) }],
  ])('rejects stale or forged %s', (_, override) => {
    expect(() => normalizeExplainRequest(selectionRequest(override), { activityPolicy: policy })).toThrowError(expect.objectContaining({ code: 'ai/stale-selection', status: 409 }));
  });
});

describe('bounded response extraction and client validation', () => {
  it.each([
    ['fenced', `\`\`\`json\n${JSON.stringify(valid())}\n\`\`\``],
    ['quoted braces', `prefix ${JSON.stringify(valid({ summary: 'Uses { and } with an escaped quote: \\".' }))} suffix`],
    ['multiple objects', `{"noise":true}\n${JSON.stringify(valid())}`],
  ])('extracts %s input', (_, source) => expect(parseTutorResponseText(source)).toMatchObject({ schemaVersion: '1' }));

  it.each(['{'.repeat(60_000), '{'.repeat(20) + '"unterminated', 'plain prose', `${'{"x":1}'.repeat(2000)}`])('rejects malformed input without pathological rescanning', (source) => {
    const started = performance.now();
    expect(() => parseTutorResponseText(source)).toThrow();
    expect(performance.now() - started).toBeLessThan(500);
  });

  it('deeply validates the complete client contract', () => {
    expect(validateAITutorResponse(valid())).toBe(true);
    for (const malformed of [null, 3, valid({ schemaVersion: '2' }), valid({ summary: 'x'.repeat(601) }), valid({ sections: [{}] }), valid({ issues: [{ title: 'x', explanation: 'x', hintLevel: 99 }] }), valid({ nextStep: { kind: 'javascript:alert(1)', text: 'x' } })]) {
      expect(validateAITutorResponse(malformed)).toBe(false);
    }
    expect(validateAITutorResponse(valid({ summary: '<img src=x onerror=alert(1)>' }))).toBe(true);
  });
});

describe('error taxonomy, retry UX, and adversarial harness', () => {
  it.each([
    ['ai/auth-required', 401, false], ['ai/stale-selection', 409, false], ['ai/idempotency-conflict', 409, false], ['ai/sensitive-content', 400, false], ['ai/rate-limited', 429, true], ['ai/provider-unavailable', 502, true], ['ai/provider-timeout', 504, true], ['ai/cancelled', 499, false], ['ai/unsafe-response', 422, false],
  ])('classifies %s', (codeValue, status, retryable) => expect(classifyAIError({ code: codeValue })).toMatchObject({ status, retryable }));

  it('shows Retry only for explicitly retryable failures', async () => {
    const retryable = new AITutorClientError('Temporary failure', { code: 'ai/provider-unavailable', retryable: true, status: 502 });
    render(<AITutorPanel accessTier="PREMIUM" language="python" code={code} compilerStatus="ready" client={{ explain: vi.fn().mockRejectedValue(retryable) }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Explain full code' }));
    expect(await screen.findByRole('button', { name: 'Retry explanation' })).toBeVisible();
  });

  it('runs provider-neutral mocked scenarios without recording prompts or responses', async () => {
    const harness = new AdversarialEvaluationHarness();
    const categories = ['prompt-injection', 'solution-leakage', 'assessment-bypass', 'secret-extraction', 'evidence-manipulation', 'malformed-output'];
    const scenarios = ['openai', 'huggingface'].flatMap((provider) => categories.map((category) => ({ id: `${category}-1`, provider, expectedPolicy: 'reject', expectAllowed: false, privatePrompt: 'do not record' })));
    const results = await harness.run(scenarios, async () => { throw new AIServiceError('ai/unsafe-response', 'Unsafe.', { status: 422 }); });
    expect(results[0]).toMatchObject({ provider: 'openai', scenarioId: 'prompt-injection-1', passed: true, classification: 'ai/unsafe-response' });
    expect(results).toHaveLength(12);
    expect(new Set(results.map((result) => result.provider))).toEqual(new Set(['openai', 'huggingface']));
    expect(JSON.stringify(results)).not.toContain('do not record');
  });
});

describe('client boundary', () => {
  it('rejects malformed success JSON before rendering', async () => {
    const client = new AITutorClient({ tokenProvider: async () => 'test-token', fetchImpl: vi.fn().mockResolvedValue({ ok: true, json: async () => valid({ sections: Array(5).fill({ title: 'x', body: 'x' }) }) }) });
    await expect(client.explain(request())).rejects.toThrow('invalid response');
  });
});
