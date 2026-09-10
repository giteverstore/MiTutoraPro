export class AITutorClient {
  constructor({ endpoint = '/api/ai/explain', fetchImpl = globalThis.fetch, tokenProvider = defaultTokenProvider } = {}) {
    this.endpoint = endpoint;
    this.fetchImpl = fetchImpl;
    this.tokenProvider = tokenProvider;
  }

  async explain(payload, { signal } = {}) {
    let token;
    try {
      token = await withAbort(this.tokenProvider(), signal);
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      throw new AITutorClientError('Your AI Tutor session could not be verified. Sign in again.', { code: 'ai/auth-invalid' });
    }
    if (!token) throw new AITutorClientError('Sign in to use the AI Tutor.', { code: 'ai/auth-required' });
    let response;
    try {
      response = await this.fetchImpl.call(globalThis, this.endpoint, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal,
      });
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      throw new AITutorClientError('The AI Tutor could not be reached. Check your connection and try again.', { code: 'ai/provider-unavailable', retryable: true });
    }
    let body;
    try { body = await response.json(); }
    catch { throw new AITutorClientError('The AI Tutor returned an invalid response.', { code: 'ai/provider-response-invalid', retryable: true }); }
    if (!response.ok) throw new AITutorClientError(body?.error?.message || 'The AI Tutor could not complete this explanation.', {
      code: body?.error?.code,
      retryable: body?.error?.retryable === true,
      status: response.status,
    });
    if (!validateAITutorResponse(body)) {
      throw new AITutorClientError('The AI Tutor returned an invalid response.', { code: 'ai/provider-response-invalid', retryable: true });
    }
    return body;
  }
}

async function defaultTokenProvider() {
  const { authService } = await import('../auth/AuthService');
  return authService.getIdToken();
}

function withAbort(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason ?? new DOMException('cancelled', 'AbortError'));
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException('cancelled', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(
      (value) => { signal.removeEventListener('abort', abort); resolve(value); },
      (error) => { signal.removeEventListener('abort', abort); reject(error); },
    );
  });
}

export const aiTutorClient = new AITutorClient();
import { validateAITutorResponse } from './validateAITutorResponse';

export class AITutorClientError extends Error {
  constructor(message, { code = 'ai/unavailable', retryable = false, status = 0 } = {}) {
    super(message);
    this.name = 'AITutorClientError';
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}
