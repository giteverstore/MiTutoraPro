import { authService } from '../auth/AuthService';

export function createV2PracticeStateRepository(identity, { fetchImpl = globalThis.fetch, tokenProvider = () => authService.getIdToken() } = {}) {
  const endpoint = `/api/v2-pilot/practice-state/${encodeURIComponent(identity.contentId)}/versions/${identity.publicationVersion}`;
  let authoritativeRevision = 0, queue = Promise.resolve();
  async function request(method, suffix = '', body) { const token = await tokenProvider(); if (!token) throw Object.assign(new Error('Sign in to save Practice state.'), { code: 'v2/auth-required' }); const response = await fetchImpl(`${endpoint}${suffix}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); const value = await response.json().catch(() => null); if (!response.ok) throw Object.assign(new Error(value?.error?.message ?? 'Practice state request failed.'), { code: value?.error?.code, status: response.status }); return value?.data ?? null; }
  return Object.freeze({
    async load() { const state = await request('GET'); authoritativeRevision = Number(state?.revision ?? 0); return state; },
    async save(workspace) { const operation = queue.then(async () => { const saved = await request('PUT', '', { ...workspace, revision: authoritativeRevision }); authoritativeRevision = Number(saved.revision); return saved; }); queue = operation.catch(() => undefined); return operation; },
    async complete(assertion) { await queue; const completed = await request('POST', '/complete', assertion); authoritativeRevision = Math.max(authoritativeRevision, Number(completed?.revision ?? 0)); return completed; },
  });
}
