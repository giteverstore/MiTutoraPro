import { authService } from '../auth/AuthService';
import { createV2CourseIdentity } from './contentIdentity';
import { V2CourseError } from './V2CourseError';

export function resolveV2CourseAssets(course, identity) {
  const adaptLesson = (lesson) => ({
    ...lesson,
    blocks: (lesson.blocks ?? []).map((block) => {
      if (block.type !== 'image' || block.delivery?.kind !== 'versioned-v2-asset') return block;
      const descriptor = block.delivery;
      if (descriptor.namespace !== 'v2' || descriptor.contentId !== identity.contentId
        || descriptor.publicationVersion !== identity.publicationVersion || !descriptor.assetId) {
        return { ...block, src: null };
      }
      return { ...block, src: null, delivery: { ...descriptor, contentId: identity.contentId, publicationVersion: identity.publicationVersion } };
    }),
  });
  return {
    ...course,
    modules: (course.modules ?? []).map((module) => module.sections?.length
      ? { ...module, sections: module.sections.map((section) => ({ ...section, lessons: (section.lessons ?? []).map(adaptLesson) })) }
      : { ...module, lessons: (module.lessons ?? []).map(adaptLesson) }),
  };
}

async function parseResponse(response) {
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.ok === false) {
    throw new V2CourseError(body?.error?.code ?? 'v2/delivery-failed', body?.error?.message ?? 'The V2 Course could not be loaded.', {
      status: response.status,
      correlationId: body?.error?.correlationId ?? response.headers.get('x-correlation-id'),
    });
  }
  return body?.data ?? body;
}

export class V2CourseRepository {
  constructor({ tokenProvider = () => authService.getIdToken(), fetchImpl = globalThis.fetch } = {}) {
    this.tokenProvider = tokenProvider;
    this.fetch = fetchImpl === globalThis.fetch ? (...args) => globalThis.fetch(...args) : fetchImpl;
  }

  async load(identity, { signal, shadow = false } = {}) {
    const requested = createV2CourseIdentity(identity);
    const token = await this.tokenProvider();
    if (!token) throw new V2CourseError('v2/auth-required', 'Sign in to open this V2 pilot Course.', { status: 401 });
    const suffix = requested.publicationVersion ? `/versions/${requested.publicationVersion}` : '';
    const query = shadow ? '?shadow=true' : '';
    const response = await this.fetch(`/api/v2-pilot/courses/${encodeURIComponent(requested.contentId)}${suffix}${query}`, {
      signal,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    const delivered = await parseResponse(response);
    const resolved = createV2CourseIdentity({ contentId: delivered.contentId, publicationVersion: delivered.publicationVersion });
    if (resolved.contentId !== requested.contentId || (requested.publicationVersion && resolved.publicationVersion !== requested.publicationVersion)) {
      throw new V2CourseError('v2/identity-mismatch', 'The V2 delivery identity did not match the requested Course.', { status: 502 });
    }
    return Object.freeze({ ...delivered, identity: resolved, course: resolveV2CourseAssets(delivered.course, resolved) });
  }
}

export const v2CourseRepository = new V2CourseRepository();
