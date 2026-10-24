import { AITutorClientError } from '../../ai/AITutorClient.js';
const validOption = (item) => item && typeof item.id === 'string' && item.id && typeof item.label === 'string' && item.label.trim() && typeof item.intent === 'string' && item.intent.trim();
export function validateProjectAIResponse(value, operation) {
  if (!value || value.operation !== operation) return false;
  if (operation === 'project-questions') return Array.isArray(value.questions) && value.questions.length >= 3 && value.questions.length <= 6 && value.questions.every(validOption);
  return typeof value.answer === 'string' && value.answer.trim() && Array.isArray(value.followUps) && value.followUps.length <= 5 && value.followUps.every(validOption);
}
async function defaultTokenProvider() { const { authService } = await import('../../auth/AuthService'); return authService.getIdToken(); }
export class ProjectAIClient {
  constructor({ endpoint = '/api/ai/explain', fetchImpl = globalThis.fetch, tokenProvider = defaultTokenProvider } = {}) { this.endpoint = endpoint; this.fetchImpl = fetchImpl; this.tokenProvider = tokenProvider; }
  async request(operation, payload, { signal } = {}) {
    const token = await this.tokenProvider(); if (!token) throw new AITutorClientError('Sign in to use the AI Mentor.', { code: 'ai/auth-required' });
    let response; try { response = await this.fetchImpl.call(globalThis, this.endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: globalThis.crypto?.randomUUID?.() ?? `mentor-${Date.now()}-${Math.random().toString(36).slice(2)}`, requestType: operation, activityType: 'project', ...payload }), signal }); } catch (error) { if (error.name === 'AbortError') throw error; throw new AITutorClientError('The AI Mentor could not be reached. Check your connection and try again.', { code: 'ai/provider-unavailable', retryable: true }); }
    let body; try { body = await response.json(); } catch { throw new AITutorClientError('The AI Mentor returned an invalid response.', { code: 'ai/provider-response-invalid', retryable: true }); }
    if (!response.ok) throw new AITutorClientError(body?.error?.message || 'The AI Mentor could not complete this request.', { code: body?.error?.code, retryable: body?.error?.retryable === true, status: response.status });
    const limit = response.headers?.get?.('X-AI-Messages-Limit'); body._tutorUsage = limit ? { usedMessages: Number(response.headers.get('X-AI-Messages-Used')) || 0, includedLimit: limit === 'unlimited' ? null : Number(limit), unlimited: limit === 'unlimited' } : null;
    if (!validateProjectAIResponse(body, operation)) throw new AITutorClientError('The AI Mentor returned an invalid response.', { code: 'ai/provider-response-invalid', retryable: true }); return body;
  }
  generateQuestions(context, options) { return this.request('project-questions', { context }, options); }
  answer(context, question, conversation = [], options) { return this.request('project-answer', { context, question, conversation: conversation.slice(-6) }, options); }
  async history(scope, { before, signal } = {}) { const token = await this.tokenProvider(); const query = new URLSearchParams(Object.entries({ ...scope, ...(before ? { before } : {}) }).filter(([, value]) => value != null).map(([key, value]) => [key, String(value)])); const response = await this.fetchImpl.call(globalThis, `/api/ai/history?${query}`, { headers: { Authorization: `Bearer ${token}` }, signal }); const body = await response.json(); if (!response.ok) throw new AITutorClientError(body?.error?.message || 'Tutor history could not be loaded.', { code: body?.error?.code, status: response.status }); return body; }
}
export const projectAIClient = new ProjectAIClient();
