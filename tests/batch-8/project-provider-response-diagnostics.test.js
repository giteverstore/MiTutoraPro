import { describe, expect, it, vi } from 'vitest';
import { AIServiceError } from '../../server/ai/AIServiceError.js';
import { publicAIError } from '../../server/ai/explainHandler.js';
import { explainProjectMentor } from '../../server/ai/project/projectMentorHandler.js';

const body = Object.freeze({
  requestType: 'project-answer',
  context: {
    project: { id: 'bingo', title: 'Bingo', description: 'Game', difficulty: 'Beginner', learningObjectives: [] },
    checkpoint: { id: 'bingo-c1', title: 'Board', objective: 'Build it', requirements: [] },
    languageId: 'javascript', selectionType: 'checkpoint_context', selectedContent: 'Current checkpoint', guideContext: '',
  },
  question: { id: 'hint', label: 'Help me understand this step.', intent: 'hint' },
  conversation: [],
});

const valid = Object.freeze({ operation: 'project-answer', answer: 'Trace the board state.', followUps: [] });

function dependencies(result) {
  const providerFailureLogger = vi.fn();
  return {
    providerFailureLogger,
    options: {
      principal: { uid: 'learner' },
      quotaGuard: {
        assertAllowed: vi.fn().mockResolvedValue({ maximum: { inputTokens: 1_000_000, outputTokens: 1_000_000, costMicros: null } }),
        settle: vi.fn().mockResolvedValue(true),
      },
      featureGate: { assertEnabled: vi.fn().mockResolvedValue({ state: 'enabled' }) },
      providerFactory: () => ({
        getMetadata: () => ({ provider: 'deepinfra', model: 'safe-model-name' }),
        explain: vi.fn().mockResolvedValue(result),
      }),
      providerFailureLogger,
      telemetry: { record: vi.fn() },
      pricing: { known: false },
      providerTokenConstraints: { inputOverheadTokens: 0, maxInputTokens: 1_000_000 },
    },
  };
}

async function rejected(result, reason) {
  const { options, providerFailureLogger } = dependencies(result);
  let error;
  try { await explainProjectMentor(body, options); }
  catch (caught) { error = caught; }
  expect(publicAIError(error)).toEqual({
    status: 502,
    body: { error: { code: 'ai/provider-response-invalid', message: 'The AI Tutor returned an invalid response.', retryable: true } },
  });
  expect(error).toMatchObject({ validationReason: reason });
  expect(providerFailureLogger).toHaveBeenCalledOnce();
  const diagnostic = providerFailureLogger.mock.calls[0][0];
  expect(diagnostic).toMatchObject({
    operation: 'ai-tutor-provider-request', provider: 'deepinfra', model: 'safe-model-name',
    validationReason: reason, schemaValidationSucceeded: false,
  });
  return diagnostic;
}

describe('sanitized Project provider-response diagnostics', () => {
  it.each([
    ['malformed provider envelope', null, 'provider-envelope-invalid'],
    ['assistant text not JSON', { text: 'SECRET learner code is not JSON' }, 'assistant-text-not-json'],
    ['wrong operation', { text: JSON.stringify({ ...valid, operation: 'project-questions' }) }, 'operation-mismatch'],
    ['missing answer', { text: JSON.stringify({ operation: 'project-answer', followUps: [] }) }, 'answer-missing'],
    ['empty answer', { text: JSON.stringify({ ...valid, answer: '   ' }) }, 'answer-empty'],
    ['oversized answer', { text: JSON.stringify({ ...valid, answer: 'x'.repeat(5_001) }) }, 'answer-too-long'],
    ['missing followUps', { text: JSON.stringify({ operation: 'project-answer', answer: 'Hint' }) }, 'followups-missing'],
    ['non-array followUps', { text: JSON.stringify({ ...valid, followUps: {} }) }, 'followups-not-array'],
    ['too many followUps', { text: JSON.stringify({ ...valid, followUps: Array.from({ length: 6 }, (_, id) => ({ id: String(id), label: 'Next', intent: 'hint' })) }) }, 'followups-too-many'],
    ['invalid follow-up', { text: JSON.stringify({ ...valid, followUps: [{ id: '', label: 'Next', intent: 'hint' }] }) }, 'followup-invalid'],
    ['duplicate follow-up IDs', { text: JSON.stringify({ ...valid, followUps: [{ id: 'same', label: 'One', intent: 'hint' }, { id: 'same', label: 'Two', intent: 'hint' }] }) }, 'duplicate-followup-id'],
  ])('reports %s without changing the public contract', async (_label, result, reason) => {
    const diagnostic = await rejected({
      usage: { input_tokens: 10, output_tokens: 10 }, finishReason: 'stop', providerDurationMs: 12,
      responseCharacters: typeof result?.text === 'string' ? result.text.length : 0,
      providerStatus: 200, candidateCount: 1, outputCount: 1, declaredMimeType: 'application/json',
      ...result,
    }, reason);
    expect(diagnostic).toMatchObject({
      providerStatus: 200, finishReason: 'stop', candidateCount: 1, outputCount: 1, declaredMimeType: 'application/json', durationMs: 12,
      providerEnvelopeParsed: reason !== 'provider-envelope-invalid',
      assistantTextJsonParsed: !['provider-envelope-invalid', 'assistant-text-not-json'].includes(reason),
    });
    expect(JSON.stringify(diagnostic)).not.toMatch(/SECRET learner code|Trace the board state|follow-up IDs/i);
  });

  it('accepts the unchanged valid Project answer schema without emitting a failure diagnostic', async () => {
    const { options, providerFailureLogger } = dependencies({
      text: JSON.stringify(valid), usage: { input_tokens: 10, output_tokens: 10 }, finishReason: 'stop', providerDurationMs: 5,
    });
    await expect(explainProjectMentor(body, options)).resolves.toEqual(valid);
    expect(providerFailureLogger).not.toHaveBeenCalled();
  });

  it.each([
    ['project-answer', 'project-questions'],
    ['project-questions', 'project-answer'],
  ])('constrains %s to its exact operation and never retries a %s response', async (requestType, returnedOperation) => {
    const requestBody = requestType === 'project-answer'
      ? body
      : { ...body, requestType, question: undefined };
    const returned = returnedOperation === 'project-answer'
      ? valid
      : { operation: 'project-questions', questions: Array.from({ length: 3 }, (_, index) => ({ id: `q${index}`, label: 'Question', intent: 'hint' })) };
    const explain = vi.fn().mockResolvedValue({
      text: JSON.stringify(returned), usage: { input_tokens: 10, output_tokens: 10 },
      finishReason: 'stop', responseCharacters: 120, providerDurationMs: 5,
    });
    const { options } = dependencies(null);
    options.providerFactory = () => ({
      getMetadata: () => ({ provider: 'deepinfra', model: 'safe-model-name' }),
      explain,
    });
    await expect(explainProjectMentor(requestBody, options)).rejects.toMatchObject({
      code: 'ai/provider-response-invalid', validationReason: 'operation-mismatch',
    });
    expect(explain).toHaveBeenCalledOnce();
    expect(explain.mock.calls[0][0].responseSchema.schema.properties.operation.enum).toEqual([requestType]);
  });

  it.each([
    ['provider refusal', new AIServiceError('ai/provider-refusal', 'Refused.', { status: 422 })],
    ['provider HTTP failure', new AIServiceError('ai/provider-unavailable', 'Unavailable.', { status: 502 })],
  ])('does not retry a %s', async (_label, providerError) => {
    const explain = vi.fn().mockRejectedValue(providerError);
    const { options } = dependencies(null);
    options.providerFactory = () => ({
      getMetadata: () => ({ provider: 'deepinfra', model: 'safe-model-name' }),
      explain,
    });
    await expect(explainProjectMentor(body, options)).rejects.toBe(providerError);
    expect(explain).toHaveBeenCalledOnce();
  });

  it('classifies a provider adapter envelope parse failure without exposing its cause', async () => {
    const { options, providerFailureLogger } = dependencies(null);
    const error = new AIServiceError('ai/provider-response-invalid', 'The AI Tutor returned an invalid response.', {
      status: 502, cause: new Error('SECRET raw provider envelope'),
    });
    options.providerFactory = () => ({
      getMetadata: () => ({ provider: 'deepinfra', model: 'safe-model-name' }),
      explain: vi.fn().mockRejectedValue(error),
    });
    await expect(explainProjectMentor(body, options)).rejects.toMatchObject({
      code: 'ai/provider-response-invalid', validationReason: 'provider-envelope-invalid',
    });
    expect(providerFailureLogger).toHaveBeenCalledWith(expect.objectContaining({
      validationReason: 'provider-envelope-invalid', providerEnvelopeParsed: false,
    }));
    expect(JSON.stringify(providerFailureLogger.mock.calls[0][0])).not.toContain('SECRET');
  });

  it.each([
    ['length', 'length', 'suspected-truncation'],
    ['content_filter', 'content_filter', 'assistant-text-not-json'],
  ])('retains safe %s finish metadata while keeping the same public error', async (finishReason, expected, reason) => {
    const diagnostic = await rejected({
      text: 'not json', usage: { input_tokens: 10, output_tokens: 10 }, finishReason,
      responseCharacters: 8, providerDurationMs: 7,
    }, reason);
    expect(diagnostic.finishReason).toBe(expected);
  });
});
