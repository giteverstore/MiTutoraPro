import { AIProvider } from './AIProvider.js';
import { AIServiceError } from './AIServiceError.js';
import {
  createProviderSignal,
  DEFAULT_PROVIDER_TIMEOUT_MS,
  inspectProviderRejection,
  providerHttpError,
  providerTransportError,
} from './providerTransport.js';
import { TUTOR_PROVIDER_RESPONSE_SCHEMA } from './tutor/tutorResponseSchema.js';

const GEMINI_API_ORIGIN = 'https://generativelanguage.googleapis.com';

function modelEndpoint(model) {
  return `${GEMINI_API_ORIGIN}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
}

function responseText(payload) {
  return (payload?.candidates?.[0]?.content?.parts ?? [])
    .filter((part) => typeof part?.text === 'string')
    .map((part) => part.text)
    .join('\n')
    .trim();
}

function providerUsage(payload) {
  const usage = payload?.usageMetadata;
  if (!usage || typeof usage !== 'object') return undefined;
  return {
    input_tokens: usage.promptTokenCount,
    output_tokens: usage.candidatesTokenCount,
  };
}

export class GeminiProvider extends AIProvider {
  constructor({ apiKey, model, fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS } = {}) {
    super();
    if (!apiKey || !model) {
      throw new AIServiceError('ai/not-configured', 'The AI Tutor is not configured yet.', { status: 503 });
    }
    this.apiKey = apiKey;
    this.model = model;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  getMetadata() {
    return { provider: 'gemini', model: this.model };
  }

  async explain(tutorRequest, { signal } = {}) {
    const request = createProviderSignal(signal, this.timeoutMs);
    try {
      let response;
      try {
        response = await this.fetchImpl(modelEndpoint(this.model), {
          method: 'POST',
          headers: { 'x-goog-api-key': this.apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: tutorRequest.systemInstruction }] },
            contents: [{ role: 'user', parts: [{ text: tutorRequest.userContent }] }],
            generationConfig: {
              maxOutputTokens: tutorRequest.maxProviderTokens,
              responseMimeType: 'application/json',
              responseJsonSchema: (tutorRequest.responseSchema ?? TUTOR_PROVIDER_RESPONSE_SCHEMA).schema,
            },
          }),
          signal: request.signal,
        });
      } catch (error) {
        throw providerTransportError(error, request, signal);
      }
      if (!response.ok) {
        throw providerHttpError(response.status, await inspectProviderRejection(response));
      }
      let payload;
      try {
        payload = await response.json();
      } catch (error) {
        if (request.didTimeOut()) throw providerTransportError(error, request, signal);
        throw new AIServiceError('ai/provider-response-invalid', 'The AI Tutor returned an invalid response.', { status: 502, cause: error });
      }
      const finishReason = payload?.candidates?.[0]?.finishReason;
      if (finishReason === 'SAFETY' || finishReason === 'PROHIBITED_CONTENT' || payload?.promptFeedback?.blockReason) {
        throw new AIServiceError('ai/provider-refusal', 'The AI Tutor could not answer that request. Try asking about the code or compiler result.', { status: 422 });
      }
      const text = responseText(payload);
      if (!text) throw new AIServiceError('ai/empty-response', 'The AI Tutor returned an empty response.', { status: 502 });
      return { text, usage: providerUsage(payload) };
    } finally {
      request.cleanup();
    }
  }
}
