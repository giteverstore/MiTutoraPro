import { CONTENT_TYPES } from '../../../shared/content/constants.js';
import { normalizeContent } from '../../../shared/content/normalization.js';
import { phase5Mark } from '../../performance/phase5Mark.js';

const defaultFetcher = (...args) => globalThis.fetch(...args);
// Exact published versions are immutable. ACTIVE pointers and catalogs are not.
const exactSessionReads = new Map();
const MAX_EXACT_SESSION_READS = 48;

export class CanonicalPublishedRepositoryError extends Error {
  constructor(code, message) { super(message); this.name = 'CanonicalPublishedRepositoryError'; this.code = code; }
}

export class CanonicalPublishedRepository {
  constructor({ contentType, fetcher = defaultFetcher, endpoint = '/api/admin-content/public' }) {
    if (![CONTENT_TYPES.COURSE, CONTENT_TYPES.PRACTICE, CONTENT_TYPES.CHALLENGE].includes(contentType)) throw new TypeError('Canonical learner repository supports COURSE, PRACTICE, or CHALLENGE.');
    this.contentType = contentType; this.fetcher = fetcher; this.endpoint = endpoint;
  }
  async list() {
    phase5Mark('canonical:catalog:start', { contentType: this.contentType });
    const response = await this.fetcher(`${this.endpoint}?contentType=${this.contentType}`);
    phase5Mark('canonical:catalog:end', { contentType: this.contentType, status: response.status });
    if (!response.ok) throw new CanonicalPublishedRepositoryError('content/catalog-failed', 'Published content catalog could not be loaded.');
    const payload = await response.json().catch(() => ({}));
    return (payload.items ?? []).filter((item) => item?.contentId && Number.isSafeInteger(item.activeVersion));
  }
  async active(contentId) { return this.fetch(contentId); }
  async exactSummary(contentId, contentVersion) {
    const response = await this.fetcher(`${this.endpoint}/${encodeURIComponent(contentId)}/${encodeURIComponent(contentVersion)}/summary`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new CanonicalPublishedRepositoryError(payload.error?.code ?? 'content/delivery-failed', payload.error?.message ?? 'Published content summary could not be loaded.');
    return payload;
  }
  async exact(contentId, contentVersion) {
    if (this.fetcher !== defaultFetcher || !Number.isSafeInteger(contentVersion) || contentVersion < 1) return this.fetch(contentId, contentVersion);
    const key = JSON.stringify([this.endpoint, this.contentType, contentId, contentVersion]);
    if (exactSessionReads.has(key)) {
      phase5Mark('canonical:exact:cache-hit', { contentType: this.contentType, contentId, contentVersion });
      return exactSessionReads.get(key);
    }
    const request = this.fetch(contentId, contentVersion).catch((error) => {
      if (exactSessionReads.get(key) === request) exactSessionReads.delete(key);
      throw error;
    });
    exactSessionReads.set(key, request);
    if (exactSessionReads.size > MAX_EXACT_SESSION_READS) exactSessionReads.delete(exactSessionReads.keys().next().value);
    return request;
  }
  async fetch(contentId, version) {
    const suffix = version == null ? '' : `/${encodeURIComponent(version)}`;
    const operation = version == null ? 'active' : 'exact';
    phase5Mark(`canonical:${operation}:start`, { contentType: this.contentType, contentId, version });
    const response = await this.fetcher(`${this.endpoint}/${encodeURIComponent(contentId)}${suffix}`);
    phase5Mark(`canonical:${operation}:end`, { contentType: this.contentType, contentId, version, status: response.status });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new CanonicalPublishedRepositoryError(payload.error?.code ?? 'content/delivery-failed', payload.error?.message ?? 'Published content could not be loaded.');
    try {
      const document = normalizeContent(payload.document);
      if (document.contentType !== this.contentType) throw new Error('Content type mismatch.');
      return { ...payload, document };
    } catch { throw new CanonicalPublishedRepositoryError('content/artifact-corrupt', 'Published content could not be safely loaded.'); }
  }
}

export function adaptCanonicalCourse(document) {
  const course = document.content;
  const migration = document.metadata?.migration;
  const modules = course.modules.map((module) => {
    const adaptLesson = (lesson) => ({ ...lesson, blocks: lesson.blocks.map((block) => block.type === 'image' && block.assetId && !block.src
      ? { ...block, src: `/api/admin-content/public/assets/${encodeURIComponent(document.contentId)}/${document.version}/${encodeURIComponent(block.assetId)}` }
      : block) });
    return { ...module, initiallyExpanded: module.initiallyExpanded ?? module.order === 1,
      ...(module.sections ? { sections: module.sections.map((section) => ({ ...section, lessons: section.lessons.map(adaptLesson) })) } : { lessons: module.lessons.map(adaptLesson) }) };
  });
  return {
    id: course.courseId, slug: course.slug, title: course.title, description: course.description,
    language: course.language, compilerEnabled: course.language !== 'none', prerequisites: course.prerequisites ?? [],
    status: course.comingSoon ? 'coming-soon' : 'published', comingSoon: course.comingSoon === true, available: course.comingSoon !== true, locale: document.locale === 'en' ? 'en-US' : document.locale,
    publishedVersion: document.version, contentVersion: document.version,
    metadata: { ...(migration?.sourceMetadata ?? {}), version: String(document.version), level: course.difficulty, estimatedMinutes: course.estimatedMinutes, tags: migration?.sourceMetadata?.tags ?? [...(course.language === 'none' ? [] : [course.language]), ...(course.tags ?? [])], updatedAt: document.metadata?.publishedAt ?? migration?.sourceMetadata?.updatedAt },
    navigation: { ...(migration?.sourceNavigation ?? {}), defaultLessonId: course.defaultLessonId ?? course.modules.flatMap((module) => module.sections?.flatMap((section) => section.lessons) ?? module.lessons ?? [])[0]?.id, sequence: migration?.sourceNavigation?.sequence ?? 'module-order', skipLockedLessons: migration?.sourceNavigation?.skipLockedLessons ?? true },
    modules,
  };
}

export function adaptCanonicalPractice(document) {
  const question = document.content;
  const migration = document.metadata?.migration;
  return { ...question, ...(migration?.implementations ? { implementations: migration.implementations } : {}), id: question.questionId, difficulty: question.difficulty.toLowerCase(), version: document.version, activityVersion: `v${document.version}`, expectedOutput: question.verification.expectedOutput, blocks: [...question.blocks, { id: migration?.compiler?.id ?? `${question.questionId}-compiler`, type: 'compiler', language: question.language, starterCode: question.starterCode, stdin: question.stdin, expectedOutput: question.verification.expectedOutput, validator: migration?.compiler?.validator ?? question.verification.comparison ?? 'normalized-lines', ...(migration?.compiler?.runLabel ? { runLabel: migration.compiler.runLabel } : {}), ...(migration?.compiler?.resetLabel ? { resetLabel: migration.compiler.resetLabel } : {}) }] };
}

export function adaptCanonicalChallenge(document) {
  const challenge = document.content;
  return {
    ...challenge, id: challenge.challengeId, contentVersion: document.version,
    blocks: [...challenge.blocks, {
      id: `${challenge.challengeId}-compiler`, type: 'compiler', language: challenge.language,
      starterCode: challenge.starterCode, stdin: challenge.stdin,
      expectedOutput: challenge.verification.expectedOutput,
      validator: challenge.verification.comparison ?? 'normalized-lines',
      runLabel: 'Run Code', resetLabel: 'Reset',
    }],
  };
}
