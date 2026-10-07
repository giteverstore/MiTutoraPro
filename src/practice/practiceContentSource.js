import { PracticeService } from '../content/services/PracticeService';
import { practiceQuestions as localPracticeQuestions } from './practiceData';
import { resolvePracticeContentSource } from './practiceContentSourceConfig';
import { createPracticeSourceAdapter, matchesPracticeFilters, PRACTICE_PAGE_SIZE } from './practiceContentSourceCore';
import { createCanonicalPracticeContentSource } from './canonicalPracticeContentSource.js';

export { PRACTICE_PAGE_SIZE } from './practiceContentSourceCore';
const environment = import.meta.env ?? {};
const isDevelopmentRuntime = environment.DEV || environment.MODE === 'e2e';
const configuredSource = environment.VITE_PRACTICE_CONTENT_SOURCE;
export const PRACTICE_RUNTIME_SOURCE = resolvePracticeContentSource({ isDevelopment: isDevelopmentRuntime, configuredSource });
const implicitFallbackEnabled = isDevelopmentRuntime && !configuredSource
  && environment.VITE_ENABLE_LOCAL_PRACTICE_FALLBACK === 'true';

export function createPracticeContentSource({ source = PRACTICE_RUNTIME_SOURCE, service = new PracticeService(), localQuestions = localPracticeQuestions, fallbackEnabled = implicitFallbackEnabled } = {}) {
  return createPracticeSourceAdapter({ source, firebaseService: service, localQuestions, fallbackEnabled });
}

export function createPublishedFirstPracticeSource({ canonical = createCanonicalPracticeContentSource(), legacy = createPracticeContentSource() } = {}) {
  let catalogPromise;
  const listCatalog = () => {
    catalogPromise ??= (async () => {
      const published = await canonical.listCatalog().catch(() => []);
      const previous = await legacy.listCatalog().catch((error) => {
        if (published.length) return [];
        throw error;
      });
      const publishedIds = new Set(published.map((question) => question.id));
      return [...published.map((question) => ({ ...question, contentSource: 'canonical' })), ...previous.filter((question) => !publishedIds.has(question.id)).map((question) => ({ ...question, contentSource: 'legacy' }))];
    })().catch((error) => { catalogPromise = undefined; throw error; });
    return catalogPromise;
  };
  const loadQuestion = (metadata) => metadata.contentSource === 'canonical'
    ? canonical.loadQuestion(metadata) : legacy.loadQuestion(metadata);
  return {
    source: 'canonical-with-legacy-fallback', listCatalog,
    async listPage({ cursor, filters, pageSize = PRACTICE_PAGE_SIZE } = {}) {
      const catalog = await listCatalog();
      const matches = catalog.filter((question) => matchesPracticeFilters(question, filters));
      const offset = Number(cursor?.offset ?? 0);
      const items = matches.slice(offset, offset + pageSize);
      const next = offset + items.length;
      return { items, cursor: next < matches.length ? { offset: next } : null, hasMore: next < matches.length, source: 'canonical-with-legacy-fallback', facets: { difficulties: [...new Set(catalog.map((question) => question.difficulty))].sort(), topics: [...new Set(catalog.map((question) => question.topic))].sort(), languages: [...new Set(catalog.map((question) => String(question.language).toLowerCase()))].sort() } };
    },
    loadQuestion,
    async loadQuestionById(id) {
      const metadata = (await listCatalog()).find((question) => question.id === id);
      if (!metadata) throw new Error('The Practice question could not be found.');
      return loadQuestion(metadata);
    },
    retryQuestion: loadQuestion,
  };
}

export const practiceContentSource = createPublishedFirstPracticeSource();
export const loadPracticeQuestions = async () => (await practiceContentSource.listPage()).items;
