import { auth } from '../../../../src/firebase/auth.js';
import { AdminContentRequestError } from './adminContentError.js';

export async function adminContentRequest(path, { method = 'GET', body, binary = false } = {}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Sign in to Admin again, then retry.');
  const response = await fetch(`/api/admin-content/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (binary && response.ok) return response.blob();
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new AdminContentRequestError(response, result, 'The request could not be completed. Retry.');
  return result;
}

export async function loadAllPages(resource) {
  const items = [];
  let cursor = null;
  do {
    const page = await adminContentRequest(`${resource}?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
    items.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return items;
}

export const editorPath = (type, id) => {
  const domain = { PROJECT: 'projects', COURSE: 'courses', PRACTICE: 'practice', CHALLENGE: 'challenges' }[type];
  return domain ? `/content/${domain}/${encodeURIComponent(id)}/edit` : null;
};

export const formatDate = (value) => value ? new Date(value).toLocaleString() : '—';
