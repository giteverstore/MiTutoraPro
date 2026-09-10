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

const HUGGING_FACE_CHAT_COMPLETIONS_URL = 'https://router.huggingface.co/v1/chat/completions';

function extractMessageText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  return content
    .map((item) => typeof item === 'string' ? item : item?.text ?? item?.content ?? '')
    .filter((item) => typeof item === 'string')
    .join('\n')
    .trim();
}

export class HuggingFaceProvider extends AIProvider {
  constructor({ token, model, fetchImpl = globalThis.fetch, timeoutMs = DEFAULT_PROVIDER_TIMEOUT_MS } = {}) {
    super();
    if (!token || !model) {
      throw new AIServiceError('ai/not-configured', 'The AI Tutor is not configured yet.', { status: 503 });
    }
    this.token = token;
    this.model = model;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  getMetadata() {
    return { provider: 'huggingface', model: this.model };
  }

  async explain(tutorRequest, { signal } = {}) {
    const request = createProviderSignal(signal, this.timeoutMs);
    try {
      let response;
      try {
        response = await this.fetchImpl(HUGGING_FACE_CHAT_COMPLETIONS_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: 'system', content: tutorRequest.systemInstruction },
              { role: 'user', content: tutorRequest.userContent },
            ],
            max_tokens: tutorRequest.maxProviderTokens,
            reasoning_effort: 'low',
            response_format: { type: 'json_schema', json_schema: TUTOR_PROVIDER_RESPONSE_SCHEMA },
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
      if (payload?.choices?.[0]?.finish_reason === 'content_filter') {
        throw new AIServiceError('ai/provider-refusal', 'The AI Tutor could not answer that request. Try asking about the code or compiler result.', { status: 422 });
      }
      const text = extractMessageText(payload);
      if (!text) throw new AIServiceError('ai/empty-response', 'The AI Tutor returned an empty response.', { status: 502 });
      return { text, usage: payload?.usage };
    } finally {
      request.cleanup();
    }
  }
}
