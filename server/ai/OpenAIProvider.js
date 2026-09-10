import { AIProvider } from './AIProvider.js';
import { AIServiceError } from './AIServiceError.js';
import {
  createProviderSignal,
  DEFAULT_PROVIDER_TIMEOUT_MS,
  providerHttpError,
  providerTransportError,
} from './providerTransport.js';
import { TUTOR_PROVIDER_RESPONSE_SCHEMA } from './tutor/tutorResponseSchema.js';

function extractResponseText(payload) {
  if (typeof payload?.output_text === 'string') return payload.output_text.trim();
  return (payload?.output ?? [])
    .flatMap((item) => item?.content ?? [])
    .filter((item) => item?.type === 'output_text' && typeof item.text === 'string')
    .map((item) => item.text)
    .join('\n')
    .trim();
}

export class OpenAIProvider extends AIProvider {
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
    return { provider: 'openai', model: this.model };
  }

  async explain(tutorRequest, { signal } = {}) {
    const request = createProviderSignal(signal, this.timeoutMs);
    try {
      let response;
      try {
        response = await this.fetchImpl('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.model,
            instructions: tutorRequest.systemInstruction,
            input: tutorRequest.userContent,
            max_output_tokens: tutorRequest.maxProviderTokens,
            store: false,
            text: {
              format: {
                type: 'json_schema',
                ...TUTOR_PROVIDER_RESPONSE_SCHEMA,
              },
            },
          }),
          signal: request.signal,
        });
      } catch (error) {
        throw providerTransportError(error, request, signal);
      }
      if (!response.ok) throw providerHttpError(response.status);
      let payload;
      try {
        payload = await response.json();
      } catch (error) {
        if (request.didTimeOut()) throw providerTransportError(error, request, signal);
        throw new AIServiceError('ai/provider-response-invalid', 'The AI Tutor returned an invalid response.', { status: 502, cause: error });
      }
      const refused = (payload?.output ?? []).some((item) => (item?.content ?? []).some((content) => content?.type === 'refusal'));
      if (refused) {
        throw new AIServiceError('ai/provider-refusal', 'The AI Tutor could not answer that request. Try asking about the code or compiler result.', { status: 422 });
      }
      const text = extractResponseText(payload);
      if (!text) throw new AIServiceError('ai/empty-response', 'The AI Tutor returned an empty response.', { status: 502 });
      return { text, usage: payload?.usage };
    } finally {
      request.cleanup();
    }
  }
}
