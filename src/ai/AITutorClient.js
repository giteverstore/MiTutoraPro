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
    const limit = response.headers?.get?.('X-AI-Messages-Limit');
    body._tutorUsage = limit ? { usedMessages: Number(response.headers.get('X-AI-Messages-Used')) || 0, includedLimit: limit === 'unlimited' ? null : Number(limit), unlimited: limit === 'unlimited' } : null;
    return body;
  }

  async history(scope, { before, signal } = {}) {
    const token = await withAbort(this.tokenProvider(), signal); if (!token) throw new AITutorClientError('Sign in to use the AI Tutor.', { code: 'ai/auth-required' });
    const query = new URLSearchParams(Object.entries({ ...scope, ...(before ? { before } : {}) }).filter(([, value]) => value != null).map(([key, value]) => [key, String(value)]));
    const response = await this.fetchImpl.call(globalThis, `/api/ai/history?${query}`, { headers: { Authorization: `Bearer ${token}` }, signal }); const body = await response.json(); if (!response.ok) throw new AITutorClientError(body?.error?.message || 'Tutor history could not be loaded.', { code: body?.error?.code, status: response.status }); return body;
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
