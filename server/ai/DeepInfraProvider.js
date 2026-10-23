import { AIProvider } from './AIProvider.js';
import { AIServiceError } from './AIServiceError.js';
import {
  createProviderSignal,
  DEFAULT_PROVIDER_TIMEOUT_MS,
  inspectProviderRejection,
  providerHttpError,
  providerTransportError,
} from './providerTransport.js';

const DEEPINFRA_CHAT_COMPLETIONS_URL = 'https://api.deepinfra.com/v1/openai/chat/completions';

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

const SAFE_FINISH_REASONS = new Set(['stop', 'length', 'content_filter', 'tool_calls']);
function safeFinishReason(value) {
  return typeof value === 'string' && SAFE_FINISH_REASONS.has(value) ? value : 'unknown';
}

function attachTiming(error, request, startedAt, diagnostic) {
  if (!error || typeof error !== 'object') return error;
  error.providerDurationMs = Date.now() - startedAt;
  if (diagnostic) {
    error.providerDiagnostic = Object.freeze({
      ...diagnostic,
      fetchAborted: request.signal.aborted,
    });
  }
  return error;
}

export class DeepInfraProvider extends AIProvider {
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
    return { provider: 'deepinfra', model: this.model };
  }

  async explain(tutorRequest, { signal } = {}) {
    const request = createProviderSignal(signal, this.timeoutMs);
    const startedAt = Date.now();
    try {
      let response;
      try {
        response = await this.fetchImpl(DEEPINFRA_CHAT_COMPLETIONS_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: 'system', content: tutorRequest.systemInstruction },
              { role: 'user', content: tutorRequest.userContent },
            ],
            max_tokens: tutorRequest.maxProviderTokens,
            reasoning_effort: 'low',
            response_format: { type: 'json_object' },
          }),
          signal: request.signal,
        });
      } catch (error) {
        const transportError = providerTransportError(error, request, signal);
        if (transportError === error) throw error;
        throw attachTiming(transportError, request, startedAt, {
          providerCode: 'unknown',
          providerClassification: request.didTimeOut() ? 'timeout' : 'unknown',
        });
      }
      if (!response.ok) {
        const diagnostic = await inspectProviderRejection(response);
        throw attachTiming(providerHttpError(response.status, diagnostic), request, startedAt, diagnostic);
      }
      let payload;
      try {
        payload = await response.json();
      } catch (error) {
        if (request.didTimeOut()) throw providerTransportError(error, request, signal);
        const invalid = new AIServiceError('ai/provider-response-invalid', 'The AI Tutor returned an invalid response.', { status: 502, cause: error });
        invalid.validationReason = 'provider-payload-invalid';
        throw attachTiming(invalid, request, startedAt, {
          providerClassification: 'invalid-json', finishReason: 'unknown', maxOutputTokens: tutorRequest.maxProviderTokens,
          jsonParseSucceeded: false, schemaValidationSucceeded: false, responseCharacters: 0,
        });
      }
      if (payload?.choices?.[0]?.finish_reason === 'content_filter') {
        throw new AIServiceError('ai/provider-refusal', 'The AI Tutor could not answer that request. Try asking about the code or compiler result.', { status: 422 });
      }
      const text = extractMessageText(payload);
      if (!text) {
        const empty = new AIServiceError('ai/empty-response', 'The AI Tutor returned an empty response.', { status: 502 });
        const finishReason = safeFinishReason(payload?.choices?.[0]?.finish_reason);
        throw attachTiming(empty, request, startedAt, {
          providerClassification: finishReason === 'length' ? 'suspected-truncation' : 'schema-validation-failed',
          finishReason, maxOutputTokens: tutorRequest.maxProviderTokens,
          jsonParseSucceeded: true, schemaValidationSucceeded: false, responseCharacters: 0,
        });
      }
      return {
        text,
        usage: payload?.usage,
        finishReason: safeFinishReason(payload?.choices?.[0]?.finish_reason),
        responseCharacters: text.length,
        providerDurationMs: Date.now() - startedAt,
      };
    } finally {
      request.cleanup();
    }
  }
}
