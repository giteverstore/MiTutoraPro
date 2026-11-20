import { authService } from '../auth/AuthService';
import { createV2CourseIdentity } from './contentIdentity';
import { V2CourseError } from './V2CourseError';

function richTextValue(node) {
  return (node?.content ?? []).map((child) => child.type === 'hardBreak' ? '\n' : child.text ?? richTextValue(child)).join('');
}

function richTextBlocks(block) {
  const document = block.data?.document;
  if (document?.type !== 'doc') return [];
  return (document.content ?? []).flatMap((node, index) => {
    const id = `${block.id}:rich-${index}`;
    if (node.type === 'heading') return [{ id, type: 'heading', level: node.attrs?.level, text: richTextValue(node) }];
    if (node.type === 'paragraph') return [{ id, type: 'paragraph', content: richTextValue(node), format: 'plain' }];
    if (node.type === 'bulletList' || node.type === 'orderedList') return [{
      id,
      type: 'list',
      style: node.type === 'orderedList' ? 'ordered' : 'unordered',
      items: (node.content ?? []).map(richTextValue),
    }];
    if (node.type === 'blockquote') return [{ id, type: 'paragraph', content: richTextValue(node), format: 'plain' }];
    return [];
  });
}

function adaptV2Block(block, identity) {
  if (block.type === 'richText') return richTextBlocks(block);
  const flattened = { ...block, ...(block.data ?? {}) };
  delete flattened.data;
  if (block.type !== 'image' || flattened.delivery?.kind !== 'versioned-v2-asset') return [flattened];
  const descriptor = flattened.delivery;
  if (descriptor.namespace !== 'v2' || descriptor.contentId !== identity.contentId
    || descriptor.publicationVersion !== identity.publicationVersion || !descriptor.assetId) {
    return [{ ...flattened, src: null }];
  }
  return [{ ...flattened, src: null, delivery: { ...descriptor, contentId: identity.contentId, publicationVersion: identity.publicationVersion } }];
}

export function adaptV2CourseForLearner(course, identity) {
  const adaptLesson = (lesson) => ({
    ...lesson,
    blocks: (lesson.blocks ?? []).flatMap((block) => adaptV2Block(block, identity)),
  });
  const modules = (course.modules ?? []).map((module) => module.sections?.length
    ? { ...module, sections: module.sections.map((section) => ({ ...section, lessons: (section.lessons ?? []).map(adaptLesson) })) }
    : { ...module, lessons: (module.lessons ?? []).map(adaptLesson) });
  const lessons = modules.flatMap((module) => module.sections?.length
    ? module.sections.flatMap((section) => section.lessons ?? [])
    : module.lessons ?? []);
  return {
    ...course,
    id: course.id ?? course.courseId,
    metadata: {
      ...course.metadata,
      level: course.metadata?.level ?? course.difficulty,
      estimatedMinutes: course.metadata?.estimatedMinutes ?? course.estimatedMinutes
        ?? lessons.reduce((total, lesson) => total + (Number(lesson.estimatedMinutes) || 0), 0),
    },
    learningOutcomes: course.learningOutcomes ?? course.outcomes ?? [],
    prerequisites: course.prerequisites ?? course.courseMetadata?.prerequisites ?? [],
    certificationAvailable: false,
    modules,
  };
}

export const resolveV2CourseAssets = adaptV2CourseForLearner;

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
