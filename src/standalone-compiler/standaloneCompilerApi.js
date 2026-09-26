import { isStandaloneCompilerHost } from './standaloneCompilerHost.js';

async function authorizationHeader() { try { const { getCurrentUser } = await import('../firebase/auth.js'); const token = await getCurrentUser()?.getIdToken(); return token ? { Authorization: `Bearer ${token}` } : {}; } catch { return {}; } }
async function requestJson(path, options = {}) { const response = await fetch(path, options); const payload = await response.json().catch(() => ({})); if (!response.ok) { const error = new Error(payload.error?.message || 'The request could not be completed.'); error.code = payload.error?.code; error.status = response.status; throw error; } return payload; }
export async function createCompilerShare(payload) { return requestJson('/api/compiler/share', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authorizationHeader()) }, body: JSON.stringify(payload) }); }
export async function loadCompilerShare(shareId) { return requestJson(`/api/compiler/share/${encodeURIComponent(shareId)}`); }
export async function sendCompilerFeedback(payload) { return requestJson('/api/compiler/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authorizationHeader()) }, body: JSON.stringify(payload) }); }
export function publicShareUrl(shareId) { return isStandaloneCompilerHost(window.location.hostname) ? `https://compiler.ycoders.com/share/${shareId}` : `${window.location.origin}/__compiler/share/${shareId}`; }
