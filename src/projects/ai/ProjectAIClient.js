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
    let response; try { response = await this.fetchImpl(this.endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ requestType: operation, activityType: 'project', ...payload }), signal }); } catch (error) { if (error.name === 'AbortError') throw error; throw new AITutorClientError('The AI Mentor could not be reached. Check your connection and try again.', { code: 'ai/provider-unavailable', retryable: true }); }
    let body; try { body = await response.json(); } catch { throw new AITutorClientError('The AI Mentor returned an invalid response.', { code: 'ai/provider-response-invalid', retryable: true }); }
    if (!response.ok) throw new AITutorClientError(body?.error?.message || 'The AI Mentor could not complete this request.', { code: body?.error?.code, retryable: body?.error?.retryable === true, status: response.status });
    if (!validateProjectAIResponse(body, operation)) throw new AITutorClientError('The AI Mentor returned an invalid response.', { code: 'ai/provider-response-invalid', retryable: true }); return body;
  }
  generateQuestions(context, options) { return this.request('project-questions', { context }, options); }
  answer(context, question, conversation = [], options) { return this.request('project-answer', { context, question, conversation: conversation.slice(-6) }, options); }
}
export const projectAIClient = new ProjectAIClient();
