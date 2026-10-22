import { describe, expect, it, vi } from 'vitest';
import { GeminiProvider } from '../../server/ai/GeminiProvider.js';
import { createAIProvider } from '../../server/ai/createAIProvider.js';
import { publicAIError } from '../../server/ai/explainHandler.js';
import { createTutorProviderConfiguration } from '../../server/ai/tutor/tutorRuntimeConfig.js';
import { validateTutorResponse } from '../../server/ai/tutor/tutorResponseSchema.js';

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

describe('Gemini AI Tutor provider', () => {
  it('is selected from configuration without exposing its server API key', () => {
    const provider = createAIProvider({ AI_PROVIDER: 'gemini', AI_MODEL: 'gemini-3.8-flash', GEMINI_API_KEY: 'server-only-key' });
    expect(provider).toBeInstanceOf(GeminiProvider);
    expect(provider.getMetadata()).toEqual({ provider: 'gemini', model: 'gemini-3.8-flash' });
    expect(JSON.stringify(provider.getMetadata())).not.toContain('server-only-key');
  });

  it('fails closed when GEMINI_API_KEY is absent', () => {
    expect(() => createAIProvider({ AI_PROVIDER: 'gemini', AI_MODEL: 'gemini-3.8-flash' }))
      .toThrowError(expect.objectContaining({ code: 'ai/not-configured', status: 503 }));
  });

  it('keeps exact managed-runtime provider and model approval', () => {
    const environment = {
      NODE_ENV: 'production', AI_PROVIDER: 'gemini', AI_MODEL: 'gemini-3.8-flash',
      AI_TUTOR_APPROVED_PROVIDER: 'gemini', AI_TUTOR_APPROVED_MODEL: 'gemini-3.8-flash',
    };
    expect(createTutorProviderConfiguration(environment)).toEqual({ provider: 'gemini', model: 'gemini-3.8-flash' });
    expect(() => createTutorProviderConfiguration({ ...environment, AI_MODEL: 'gemini-other-model' }))
      .toThrowError(expect.objectContaining({ code: 'ai/provider-not-approved' }));
  });

  it('uses bounded structured generateContent and normalizes text and usage', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '{"ok":true}' }] }, finishReason: 'STOP' }],
        usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 5 },
      }),
    });
    const provider = new GeminiProvider({ apiKey: 'server-only-key', model: 'gemini-3.8-flash', fetchImpl });
    await expect(provider.explain(providerRequest)).resolves.toEqual({
      text: '{"ok":true}', usage: { input_tokens: 12, output_tokens: 5 },
    });
    const [url, request] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent');
    expect(request.headers['x-goog-api-key']).toBe('server-only-key');
    expect(JSON.parse(request.body)).toEqual({
      systemInstruction: { parts: [{ text: 'Tutor policy' }] },
      contents: [{ role: 'user', parts: [{ text: 'Learner data' }] }],
      generationConfig: {
        maxOutputTokens: 1_200,
        responseMimeType: 'application/json',
        responseJsonSchema: providerRequest.responseSchema.schema,
      },
    });
  });

  it.each([
    [400, 'ai/provider-rejected', 502],
    [401, 'ai/provider-auth', 503],
    [403, 'ai/provider-auth', 503],
    [404, 'ai/model-unavailable', 503],
    [429, 'ai/provider-rate-limited', 429],
    [500, 'ai/provider-unavailable', 502],
    [503, 'ai/provider-unavailable', 502],
  ])('maps Gemini HTTP %s without exposing provider details', async (status, code, publicStatus) => {
    const provider = new GeminiProvider({ apiKey: 'private-key', model: 'gemini-3.8-flash', fetchImpl: vi.fn().mockResolvedValue(rejection(status)) });
    let error;
    try { await provider.explain(providerRequest); } catch (caught) { error = caught; }
    expect(publicAIError(error)).toMatchObject({ status: publicStatus, body: { error: { code } } });
    expect(JSON.stringify(publicAIError(error))).not.toContain('private-key');
  });

  it('retains only sanitized diagnostics and never exposes Gemini error text or credentials', async () => {
    const apiKey = 'server-only-gemini-secret';
    const privateMessage = 'provider detail containing learner prompt material';
    const provider = new GeminiProvider({
      apiKey,
      model: 'gemini-3.8-flash',
      fetchImpl: vi.fn().mockResolvedValue(new Response(JSON.stringify({
        error: { code: 400, status: 'INVALID_ARGUMENT', message: privateMessage },
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'x-request-id': 'gemini_request-123' },
      })),
    });
    let error;
    try { await provider.explain(providerRequest); } catch (caught) { error = caught; }
    expect(error.providerDiagnostic).toEqual({
      providerStatus: 400,
      providerCode: 'unknown',
      providerClassification: 'request-rejected',
      providerRequestId: 'gemini_request-123',
    });
    const publicError = publicAIError(error);
    expect(publicError).toMatchObject({ status: 502, body: { error: { code: 'ai/provider-rejected' } } });
    expect(JSON.stringify(publicError)).not.toContain(privateMessage);
    expect(JSON.stringify(publicError)).not.toContain(apiKey);
    expect(JSON.stringify(publicError)).not.toContain('gemini_request-123');
  });

  it('maps timeout and network failure through the existing transport taxonomy', async () => {
    const timeoutFetch = vi.fn((_, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }));
    const timed = new GeminiProvider({ apiKey: 'private-key', model: 'gemini-3.8-flash', fetchImpl: timeoutFetch, timeoutMs: 5 });
    await expect(timed.explain(providerRequest)).rejects.toMatchObject({ code: 'ai/provider-timeout', status: 504 });
    const network = new GeminiProvider({ apiKey: 'private-key', model: 'gemini-3.8-flash', fetchImpl: vi.fn().mockRejectedValue(new Error('private network detail')) });
    await expect(network.explain(providerRequest)).rejects.toMatchObject({ code: 'ai/provider-unavailable', status: 502 });
  });

  it('rejects malformed and empty model responses', async () => {
    const malformed = new GeminiProvider({ apiKey: 'key', model: 'model', fetchImpl: vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new Error('raw'); } }) });
    await expect(malformed.explain(providerRequest)).rejects.toMatchObject({ code: 'ai/provider-response-invalid' });
    const empty = new GeminiProvider({ apiKey: 'key', model: 'model', fetchImpl: vi.fn().mockResolvedValue({ ok: true, json: async () => ({ candidates: [] }) }) });
    await expect(empty.explain(providerRequest)).rejects.toMatchObject({ code: 'ai/empty-response' });
  });

  it('leaves authoritative Tutor schema validation after provider normalization', () => {
    const context = {
      operation: 'explain-full-code', code: 'print("Hello")', hintLevel: 1,
      evidence: { basis: 'static' },
    };
    expect(() => validateTutorResponse('{"ok":true}', context)).toThrowError(expect.objectContaining({ code: 'ai/provider-response-invalid' }));
  });

  it('maps Gemini safety blocking to the existing refusal error', async () => {
    const provider = new GeminiProvider({
      apiKey: 'key', model: 'model',
      fetchImpl: vi.fn().mockResolvedValue({ ok: true, json: async () => ({ promptFeedback: { blockReason: 'SAFETY' } }) }),
    });
    await expect(provider.explain(providerRequest)).rejects.toMatchObject({ code: 'ai/provider-refusal', status: 422 });
  });
});
