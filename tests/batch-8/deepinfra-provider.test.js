import { describe, expect, it, vi } from 'vitest';
import { DeepInfraProvider } from '../../server/ai/DeepInfraProvider.js';
import { createAIProvider } from '../../server/ai/createAIProvider.js';
import { publicAIError } from '../../server/ai/explainHandler.js';
import { createTutorProviderConfiguration } from '../../server/ai/tutor/tutorRuntimeConfig.js';
import { validateTutorResponse } from '../../server/ai/tutor/tutorResponseSchema.js';

const MODEL = 'zai-org/GLM-5.3-Flash';
const providerRequest = Object.freeze({
  systemInstruction: 'Tutor policy',
  userContent: 'Learner data',
  maxProviderTokens: 1_200,
  responseSchema: Object.freeze({
    name: 'test_response', strict: true,
    schema: { type: 'object', additionalProperties: false, required: ['ok'], properties: { ok: { type: 'boolean' } } },
  }),
});

function rejection(status, headers = new Headers()) {
  return { ok: false, status, headers };
}

describe('DeepInfra AI Tutor provider', () => {
  it('is selected from configuration without exposing its server API key', () => {
    const provider = createAIProvider({ AI_PROVIDER: 'deepinfra', AI_MODEL: MODEL, DEEPINFRA_API_KEY: 'server-only-key' });
    expect(provider).toBeInstanceOf(DeepInfraProvider);
    expect(provider.getMetadata()).toEqual({ provider: 'deepinfra', model: MODEL });
    expect(JSON.stringify(provider.getMetadata())).not.toContain('server-only-key');
  });

  it('fails closed when DEEPINFRA_API_KEY is absent', () => {
    expect(() => createAIProvider({ AI_PROVIDER: 'deepinfra', AI_MODEL: MODEL }))
      .toThrowError(expect.objectContaining({ code: 'ai/not-configured', status: 503 }));
  });

  it('keeps exact managed-runtime provider and model approval', () => {
    const environment = {
      NODE_ENV: 'production', AI_PROVIDER: 'deepinfra', AI_MODEL: MODEL,
      AI_TUTOR_APPROVED_PROVIDER: 'deepinfra', AI_TUTOR_APPROVED_MODEL: MODEL,
    };
    expect(createTutorProviderConfiguration(environment)).toEqual({ provider: 'deepinfra', model: MODEL });
    expect(() => createTutorProviderConfiguration({ ...environment, AI_MODEL: 'zai-org/another-model' }))
      .toThrowError(expect.objectContaining({ code: 'ai/provider-not-approved' }));
  });

  it('uses bounded low-reasoning JSON chat completion and normalizes response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }], usage: { prompt_tokens: 12, completion_tokens: 5 } }),
    });
    const provider = new DeepInfraProvider({ apiKey: 'server-only-key', model: MODEL, fetchImpl });
    await expect(provider.explain(providerRequest)).resolves.toEqual({
      text: '{"ok":true}', usage: { prompt_tokens: 12, completion_tokens: 5 },
      finishReason: 'stop', responseCharacters: 11, providerDurationMs: expect.any(Number), structuredOutputMode: 'json-object',
    });
    const [url, request] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.deepinfra.com/v1/openai/chat/completions');
    expect(request.headers.Authorization).toBe('Bearer server-only-key');
    expect(JSON.parse(request.body)).toEqual({
      model: MODEL,
      messages: [
        { role: 'system', content: `Tutor policy\n\nREQUIRED OUTPUT JSON SCHEMA (trusted; follow exactly):\n${JSON.stringify(providerRequest.responseSchema.schema)}` },
        { role: 'user', content: 'Learner data' },
      ],
      max_tokens: 1_200,
      reasoning_effort: 'low',
      temperature: 0,
      top_p: 1,
      response_format: { type: 'json_object' },
    });
  });

  it.each([
    [400, 'ai/provider-rejected', 502],
    [401, 'ai/provider-auth', 503],
    [403, 'ai/provider-auth', 503],
    [404, 'ai/model-unavailable', 503],
    [408, 'ai/provider-timeout', 504],
    [422, 'ai/provider-rejected', 502],
    [429, 'ai/provider-rate-limited', 429],
    [500, 'ai/provider-unavailable', 502],
    [503, 'ai/provider-unavailable', 502],
  ])('maps DeepInfra HTTP %s through the existing taxonomy', async (status, code, publicStatus) => {
    const provider = new DeepInfraProvider({ apiKey: 'private-key', model: MODEL, fetchImpl: vi.fn().mockResolvedValue(rejection(status)) });
    let error;
    try { await provider.explain(providerRequest); } catch (caught) { error = caught; }
    expect(publicAIError(error)).toMatchObject({ status: publicStatus, body: { error: { code } } });
    expect(JSON.stringify(publicAIError(error))).not.toContain('private-key');
  });

  it('retains only sanitized diagnostics and omits malformed request IDs', async () => {
    const privateMessage = 'provider detail containing learner prompt material';
    const provider = new DeepInfraProvider({
      apiKey: 'server-only-secret', model: MODEL,
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: privateMessage } }), {
        status: 400, headers: { 'Content-Type': 'application/json', 'x-request-id': 'unsafe request id!' },
      })),
    });
    let error;
    try { await provider.explain(providerRequest); } catch (caught) { error = caught; }
    expect(error.providerDiagnostic).toEqual({
      providerStatus: 400,
      providerCode: 'unknown',
      providerClassification: 'request-rejected',
      fetchAborted: false,
    });
    expect(JSON.stringify(publicAIError(error))).not.toContain(privateMessage);
    expect(JSON.stringify(publicAIError(error))).not.toContain('server-only-secret');
  });

  it('maps timeout and network failures through the existing transport taxonomy', async () => {
    const timeoutFetch = vi.fn((_, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }));
    const timed = new DeepInfraProvider({ apiKey: 'key', model: MODEL, fetchImpl: timeoutFetch, timeoutMs: 5 });
    let timeoutError;
    try { await timed.explain(providerRequest); } catch (caught) { timeoutError = caught; }
    expect(timeoutError).toMatchObject({ code: 'ai/provider-timeout', status: 504 });
    expect(timeoutError.providerDiagnostic).toMatchObject({ providerClassification: 'timeout', fetchAborted: true });
    const network = new DeepInfraProvider({ apiKey: 'key', model: MODEL, fetchImpl: vi.fn().mockRejectedValue(new Error('private network detail')) });
    await expect(network.explain(providerRequest)).rejects.toMatchObject({ code: 'ai/provider-unavailable', status: 502 });
  });

  it('rejects malformed, empty, and content-filtered responses', async () => {
    const malformed = new DeepInfraProvider({ apiKey: 'key', model: MODEL, fetchImpl: vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new Error('raw'); } }) });
    await expect(malformed.explain(providerRequest)).rejects.toMatchObject({ code: 'ai/provider-response-invalid' });
    const empty = new DeepInfraProvider({ apiKey: 'key', model: MODEL, fetchImpl: vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) }) });
    await expect(empty.explain(providerRequest)).rejects.toMatchObject({ code: 'ai/empty-response' });
    const filtered = new DeepInfraProvider({ apiKey: 'key', model: MODEL, fetchImpl: vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ finish_reason: 'content_filter' }] }) }) });
    await expect(filtered.explain(providerRequest)).rejects.toMatchObject({ code: 'ai/provider-refusal', status: 422 });
  });

  it('leaves authoritative Tutor schema validation after provider normalization', () => {
    const context = { operation: 'explain-full-code', code: 'print("Hello")', hintLevel: 1, evidence: { basis: 'static' } };
    expect(() => validateTutorResponse('{"ok":true}', context))
      .toThrowError(expect.objectContaining({ code: 'ai/provider-response-invalid' }));
  });
});
