import { AIServiceError } from '../AIServiceError.js';

const DEFAULT_ORIGIN = 'https://admin.ycoders.com';
const TYPES = Object.freeze({ course: 'COURSE', practice: 'PRACTICE', project: 'PROJECT' });

function safeId(value, label) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result || result.length > 160 || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(result)) {
    throw new AIServiceError('ai/activity-invalid', `The requested ${label} is unavailable.`, { status: 400 });
  }
  return result;
}

export class CanonicalTutorContentSource {
  constructor({ fetcher = globalThis.fetch, origin = process.env.ADMIN_PUBLIC_CONTENT_ORIGIN || DEFAULT_ORIGIN } = {}) {
    this.fetcher = fetcher;
    this.origin = new URL(origin).origin;
  }

  async get({ surface, contentId, contentVersion, signal }) {
    const id = safeId(contentId, surface);
    const suffix = contentVersion == null ? '' : `/${contentVersion}`;
    let response;
    try {
      response = await this.fetcher(`${this.origin}/api/admin-content/public/${encodeURIComponent(id)}${suffix}`, { signal });
    } catch (cause) {
      throw new AIServiceError('ai/content-unavailable', 'The learning content required by AI Tutor is unavailable.', { status: 503, cause });
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const code = contentVersion == null ? 'ai/content-unavailable' : 'ai/content-version-invalid';
      const error = new AIServiceError(code, 'The requested learning content is unavailable.', { status: contentVersion == null ? 503 : 409 });
      if (contentVersion == null && response.status === 404 && payload?.error?.code === 'content/not-published') {
        error.contentSourceFailure = 'not-published';
      }
      throw error;
    }
    const document = payload?.document;
    if (!document || document.contentType !== TYPES[surface] || document.contentId !== id || !Number.isSafeInteger(document.version) || document.version < 1) {
      throw new AIServiceError('ai/content-unavailable', 'The learning content required by AI Tutor is unavailable.', { status: 503 });
    }
    if (contentVersion != null && document.version !== contentVersion) {
      throw new AIServiceError('ai/content-version-invalid', 'The requested learning content version is unavailable.', { status: 409 });
    }
    return Object.freeze({ ...document, contentSource: 'admin' });
  }
}
