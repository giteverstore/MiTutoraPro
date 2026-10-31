import { describe, expect, it, vi } from 'vitest';
import { explainCode, publicAIError } from '../../server/ai/explainHandler.js';
import { validateTutorResponse } from '../../server/ai/tutor/tutorResponseSchema.js';

const code = 'i = 0\nwhile i < 5:\n    print(i)';
const policy = { activityType: 'lesson', solutionPolicy: 'hints-only', maximumHintLevel: 1 };
const base = {
  requestType: 'explain-full-code', activityType: 'lesson', language: 'python', code,
  compilerStatus: 'ready', lessonContext: 'Python loops',
};
const structured = (summary, sections = []) => JSON.stringify({
  schemaVersion: '1', policyVersion: 'ai-tutor-v1', operation: 'explain-full-code',
  evidence: { basis: 'static', note: null }, summary, sections,
  codeReferences: [], concepts: [], issues: [], nextStep: { kind: 'none', text: '' },
});
const options = (provider, providerFailureLogger = vi.fn()) => ({
  principal: { uid: 'learner' }, providerFactory: () => provider,
  featureGate: { assertEnabled: vi.fn().mockResolvedValue({ state: 'enabled', version: 'test' }) },
  activityPolicyResolver: { resolve: vi.fn().mockResolvedValue(policy) },
  rateLimiter: { assertAllowed: vi.fn() }, providerFailureLogger,
  pricing: { known: false }, providerTokenConstraints: { inputOverheadTokens: 0, maxInputTokens: 100_000 },
});

describe('AI Tutor multi-turn direct-answer regression', () => {
  it('supports guided, explicit complete, and follow-up responses in one conversation', async () => {
    const requests = [];
    const replies = [
      structured('Check whether i changes inside the loop.'),
      structured('Here is the complete code.', [{ title: 'Complete code', body: 'i = 0\nwhile i < 5:\n    print(i)\n    i += 1' }]),
      structured('The added line increments i until the condition becomes false.'),
    ];
    const provider = {
      getMetadata: () => ({ provider: 'mock', model: 'structured' }),
      explain: vi.fn(async (request) => {
        requests.push(request);
        const text = replies.shift();
        return { text, usage: { prompt_tokens: 80, completion_tokens: 120 }, finishReason: 'stop', responseCharacters: text.length, providerDurationMs: 4 };
      }),
    };
    const first = await explainCode({ ...base, learnerMessage: "Why doesn't this loop stop?", conversation: [] }, options(provider));
    const history1 = [{ question: "Why doesn't this loop stop?", answer: first.summary }];
    const second = await explainCode({ ...base, learnerMessage: 'Just give me the complete code.', conversation: history1 }, options(provider));
    const history2 = [...history1, { question: 'Just give me the complete code.', answer: `${second.summary}\n${second.sections[0].body}` }];
    await expect(explainCode({ ...base, learnerMessage: 'Why does that fix it?', conversation: history2 }, options(provider))).resolves.toMatchObject({ summary: expect.stringContaining('increments i') });
    const secondData = JSON.parse(requests[1].userContent.split('\n').slice(1).join('\n'));
    expect(secondData.previousTurns).toEqual(history1);
    expect(secondData.learnerMessage).toBe('Just give me the complete code.');
    expect(secondData.directAnswerRequested).toBe(true);
    expect(requests[1].maxProviderTokens).toBe(2_400);
  });

  it('retries one truncated response, succeeds once, and settles aggregate usage once', async () => {
    const quotaGuard = {
      assertAllowed: vi.fn().mockResolvedValue({ maximum: { inputTokens: 100_000, outputTokens: 10_000, costMicros: null } }),
      settle: vi.fn().mockResolvedValue(true),
    };
    const good = structured('The loop needs an increment.');
    const provider = {
      getMetadata: () => ({ provider: 'deepinfra', model: 'model' }),
      explain: vi.fn()
        .mockResolvedValueOnce({ text: '{"schemaVersion":"1"', usage: { prompt_tokens: 90, completion_tokens: 700 }, finishReason: 'length', responseCharacters: 20, providerDurationMs: 8, structuredOutputMode: 'json-object' })
        .mockResolvedValueOnce({ text: good, usage: { prompt_tokens: 92, completion_tokens: 120 }, finishReason: 'stop', responseCharacters: good.length, providerDurationMs: 7, structuredOutputMode: 'json-object' }),
    };
    const requestOptions = { ...options(provider), rateLimiter: undefined, quotaGuard };
    await expect(explainCode({ ...base, learnerMessage: 'Why does this loop not stop?' }, requestOptions))
      .resolves.toMatchObject({ summary: 'The loop needs an increment.' });
    expect(provider.explain).toHaveBeenCalledTimes(2);
    expect(provider.explain.mock.calls[0][0].maxProviderTokens).toBe(700);
    expect(provider.explain.mock.calls[1][0].maxProviderTokens).toBe(1_400);
    expect(quotaGuard.settle).toHaveBeenCalledOnce();
    expect(quotaGuard.settle).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      inputTokens: 182, outputTokens: 820, outcome: 'success',
    }));
  });

  it('retries truncation exactly once, then returns the same sanitized failure', async () => {
    const providerFailureLogger = vi.fn();
    const provider = {
      getMetadata: () => ({ provider: 'deepinfra', model: 'model' }),
      explain: vi.fn()
        .mockResolvedValueOnce({ text: '{"schemaVersion":"1"', usage: { prompt_tokens: 90, completion_tokens: 700 }, finishReason: 'length', responseCharacters: 20, providerDurationMs: 8, structuredOutputMode: 'json-object' })
        .mockResolvedValueOnce({ text: '{"schemaVersion":"1"', usage: { prompt_tokens: 90, completion_tokens: 1_400 }, finishReason: 'length', responseCharacters: 20, providerDurationMs: 8, structuredOutputMode: 'json-object' }),
    };
    let error;
    try { await explainCode({ ...base, learnerMessage: 'Why does this loop not stop?' }, options(provider, providerFailureLogger)); } catch (caught) { error = caught; }
    expect(error).toMatchObject({ code: 'ai/provider-response-invalid', validationReason: 'suspected-truncation' });
    expect(publicAIError(error)).toEqual({ status: 502, body: { error: { code: 'ai/provider-response-invalid', message: 'The AI Tutor returned an invalid response.', retryable: true } } });
    expect(provider.explain).toHaveBeenCalledTimes(2);
    expect(providerFailureLogger).toHaveBeenCalledWith(expect.objectContaining({ finishReason: 'length', providerClassification: 'suspected-truncation', outputTokens: 1_400, maxOutputTokens: 1_400, responseCharacters: 20, attemptCount: 2, retryReason: 'truncation', firstFinishReason: 'length', finalFinishReason: 'length', firstOutputTokens: 700, finalOutputTokens: 1_400, structuredOutputMode: 'json-object' }));
    expect(JSON.stringify(providerFailureLogger.mock.calls)).not.toContain(code);
  });

  it('never retries a parsed response with the wrong operation', async () => {
    const wrong = JSON.parse(structured('Wrong operation'));
    wrong.operation = 'explain-selection';
    const provider = {
      getMetadata: () => ({ provider: 'deepinfra', model: 'model' }),
      explain: vi.fn().mockResolvedValue({ text: JSON.stringify(wrong), usage: { prompt_tokens: 90, completion_tokens: 100 }, finishReason: 'stop', responseCharacters: 300, providerDurationMs: 8 }),
    };
    await expect(explainCode({ ...base, learnerMessage: 'Explain this.' }, options(provider)))
      .rejects.toMatchObject({ code: 'ai/provider-response-invalid', validationReason: 'version-or-operation-mismatch' });
    expect(provider.explain).toHaveBeenCalledOnce();
    expect(provider.explain.mock.calls[0][0].responseSchema.schema.properties.operation.enum).toEqual(['explain-full-code']);
  });

  it('accepts one narrow JSON fence and still rejects malformed JSON authoritatively', () => {
    const context = { operation: 'explain-full-code', code, hintLevel: 1, evidence: { basis: 'static' } };
    const valid = structured('A concise valid response.');
    expect(validateTutorResponse(`\`\`\`json\n${valid}\n\`\`\``, context).summary).toBe('A concise valid response.');
    expect(() => validateTutorResponse('{"schemaVersion":"1"', context)).toThrowError(expect.objectContaining({ code: 'ai/provider-response-invalid', validationReason: 'malformed-json-no-object' }));
  });
});
