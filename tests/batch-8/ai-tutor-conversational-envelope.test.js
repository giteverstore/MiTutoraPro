import { describe, expect, it, vi } from 'vitest';
import { explainCode, publicAIError } from '../../server/ai/explainHandler.js';
import { createProviderFailureLog } from '../../server/ai/providerTransport.js';
import {
  createMinimalTutorEnvelope,
  validateTutorResponse,
} from '../../server/ai/tutor/tutorResponseSchema.js';

const activityPolicy = { activityType: 'lesson', solutionPolicy: 'hints-only', maximumHintLevel: 1 };
const context = (learnerMessage) => ({
  operation: 'explain-full-code', language: 'python', code: 'print("hello")',
  learnerMessage, hintLevel: 1, evidence: { basis: 'static' }, assessment: activityPolicy,
});
const fullEnvelope = (summary, overrides = {}) => ({
  schemaVersion: '1', policyVersion: 'ai-tutor-v1', operation: 'explain-full-code',
  evidence: { basis: 'static', note: null }, summary,
  sections: [], codeReferences: [], concepts: [], issues: [],
  nextStep: { kind: 'none', text: '' }, ...overrides,
});

describe('canonical conversational Tutor envelopes', () => {
  it('builds the smallest canonical presentation envelope explicitly', () => {
    expect(createMinimalTutorEnvelope('Hi! What would you like help with?', context('hi'))).toEqual(
      fullEnvelope('Hi! What would you like help with?'),
    );
  });

  it.each([
    ['hi', 'Hi! What would you like help with?'],
    ['Thanks', "You're welcome!"],
    ['Okay', 'Okay!'],
    ['Got it', 'Great!'],
  ])('normalizes missing presentation fields for trusted conversational input %s', (message, summary) => {
    const response = validateTutorResponse(JSON.stringify({ summary }), context(message));
    expect(response).toMatchObject({ summary, evidence: { basis: 'static' }, nextStep: { kind: 'none', text: '' } });
    expect(response.sections).toEqual([]);
    expect(response.codeReferences).toEqual([]);
    expect(response.concepts).toEqual([]);
    expect(response.issues).toEqual([]);
  });

  it('accepts a canonical scoped refusal without inventing evidence or concepts', () => {
    const response = validateTutorResponse(
      JSON.stringify(fullEnvelope('I can help with the current lesson, topic, or code.')),
      context("What's the weather?"),
    );
    expect(response.summary).toContain('current lesson');
    expect(response.sections).toEqual([]);
    expect(response.nextStep).toEqual({ kind: 'none', text: '' });
  });

  it('does not normalize missing fields for educational requests', () => {
    expect(() => validateTutorResponse(JSON.stringify({ summary: 'The length of a collection.' }), context('What does len() do?')))
      .toThrowError(expect.objectContaining({
        validationReason: 'schema-required-field',
        validationDiagnostic: { validationPath: 'schemaVersion', validationRule: 'required', missingField: 'schemaVersion' },
      }));
  });

  it.each([
    ['wrong summary type', { summary: 3 }],
    ['wrong array type', { summary: 'Hi!', sections: {} }],
    ['wrong next-step kind', { summary: 'Hi!', nextStep: { kind: 'continue', text: '' } }],
    ['unknown structure', { ...fullEnvelope('Hi!'), arbitrary: true }],
  ])('continues to reject %s', (_label, candidate) => {
    expect(() => validateTutorResponse(JSON.stringify(candidate), context('hi'))).toThrowError(
      expect.objectContaining({ code: 'ai/provider-response-invalid' }),
    );
  });

  it('continues to reject malformed JSON', () => {
    expect(() => validateTutorResponse('{"summary":', context('hi'))).toThrowError(
      expect.objectContaining({ code: 'ai/provider-response-invalid', validationReason: 'malformed-json-no-object' }),
    );
  });

  it('leaves complete structured educational responses intact', () => {
    const candidate = fullEnvelope('len() returns the number of items.', {
      concepts: [{ name: 'Length', explanation: 'It is the number of contained items.' }],
      nextStep: { kind: 'experiment', text: 'Try len() with two lists.' },
    });
    expect(validateTutorResponse(JSON.stringify(candidate), context('What does len() do?'))).toEqual({
      ...candidate,
      evidence: { basis: 'static' },
    });
  });

  it('keeps greeting, progressive guidance, and an explicit solution in one conversation', async () => {
    const replies = [
      JSON.stringify({ summary: 'Hi! What would you like help with?' }),
      JSON.stringify(fullEnvelope('Check whether the loop variable changes.')),
      JSON.stringify(fullEnvelope('Trace the value of i after each iteration.')),
      JSON.stringify(fullEnvelope('Here is the complete code.', {
        sections: [{ title: 'Complete code', body: 'i = 0\nwhile i < 5:\n    print(i)\n    i += 1' }],
      })),
    ];
    const requests = [];
    const provider = {
      getMetadata: () => ({ provider: 'mock', model: 'structured' }),
      explain: vi.fn(async (request) => {
        requests.push(request);
        const text = replies.shift();
        return { text, usage: { prompt_tokens: 40, completion_tokens: 30 }, finishReason: 'stop', responseCharacters: text.length, providerDurationMs: 2 };
      }),
    };
    const run = (learnerMessage, conversation) => explainCode({
      requestType: 'explain-full-code', language: 'python', code: 'i = 0\nwhile i < 5:\n    print(i)',
      compilerStatus: 'ready', learnerMessage, conversation,
    }, {
      principal: { uid: 'learner' }, providerFactory: () => provider,
      featureGate: { assertEnabled: vi.fn().mockResolvedValue({ state: 'enabled', version: 'test' }) },
      activityPolicyResolver: { resolve: vi.fn().mockResolvedValue(activityPolicy) },
      rateLimiter: { assertAllowed: vi.fn() }, providerFailureLogger: vi.fn(),
      pricing: { known: false }, providerTokenConstraints: { inputOverheadTokens: 0, maxInputTokens: 100_000 },
    });
    const turns = [];
    for (const message of ['hi', "Why doesn't this loop stop?", "I still don't understand.", 'Just give me the complete code.']) {
      const response = await run(message, turns);
      turns.push({ question: message, answer: response.summary });
    }
    expect(turns).toHaveLength(4);
    expect(JSON.parse(requests[3].userContent.split('\n').slice(1).join('\n')).previousTurns).toEqual(turns.slice(0, 3));
    expect(requests[3].maxProviderTokens).toBe(2_400);
  });
});

describe('sanitized structural validation diagnostics', () => {
  it('omits arbitrary diagnostic paths and fields', () => {
    const event = createProviderFailureLog({
      provider: 'deepinfra', model: 'model', durationMs: 2,
      diagnostic: {
        providerClassification: 'schema-validation-failed',
        validationPath: 'prompt.secret', validationRule: 'custom-rule',
        expectedType: 'credential', actualType: 'token', missingField: 'apiKey',
      },
    });
    expect(event).not.toHaveProperty('validationPath');
    expect(event).not.toHaveProperty('validationRule');
    expect(event).not.toHaveProperty('expectedType');
    expect(event).not.toHaveProperty('actualType');
    expect(event).not.toHaveProperty('missingField');
  });

  it('logs only an allowlisted schema path and rule while preserving the public error', async () => {
    const providerFailureLogger = vi.fn();
    const provider = {
      getMetadata: () => ({ provider: 'deepinfra', model: 'zai-org/GLM-5.3-Flash' }),
      explain: vi.fn().mockResolvedValue({
        text: JSON.stringify({ summary: 'Hi!', nextStep: { kind: 'continue', text: '' } }),
        usage: { prompt_tokens: 40, completion_tokens: 30 }, finishReason: 'stop',
        responseCharacters: 70, providerDurationMs: 5,
      }),
    };
    let error;
    try {
      await explainCode({
        requestType: 'explain-full-code', language: 'python', code: 'print("hello")',
        compilerStatus: 'ready', learnerMessage: 'hi',
      }, {
        principal: { uid: 'learner' }, providerFactory: () => provider,
        featureGate: { assertEnabled: vi.fn().mockResolvedValue({ state: 'enabled', version: 'test' }) },
        activityPolicyResolver: { resolve: vi.fn().mockResolvedValue(activityPolicy) },
        rateLimiter: { assertAllowed: vi.fn() }, providerFailureLogger,
        pricing: { known: false }, providerTokenConstraints: { inputOverheadTokens: 0, maxInputTokens: 100_000 },
      });
    } catch (caught) { error = caught; }
    expect(publicAIError(error)).toEqual({
      status: 502,
      body: { error: { code: 'ai/provider-response-invalid', message: 'The AI Tutor returned an invalid response.', retryable: true } },
    });
    expect(providerFailureLogger).toHaveBeenCalledWith(expect.objectContaining({
      providerClassification: 'schema-validation-failed', validationPath: 'nextStep.kind',
      validationRule: 'enum', expectedType: 'string', actualType: 'string',
    }));
    expect(JSON.stringify(providerFailureLogger.mock.calls)).not.toContain('Hi!');
  });
});
