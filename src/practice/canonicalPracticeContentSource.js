import { adaptCanonicalPractice, CanonicalPublishedRepository } from '../content/repositories/CanonicalPublishedRepository.js';
import { matchesPracticeFilters, PRACTICE_PAGE_SIZE } from './practiceContentSourceCore.js';

export function createCanonicalPracticeContentSource({ repository = new CanonicalPublishedRepository({ contentType: 'PRACTICE' }) } = {}) {
  let catalog;
  const loadCatalog = async () => {
    catalog ??= Promise.all((await repository.list()).map(async (entry, position) => {
      const { document } = await repository.exact(entry.contentId, entry.activeVersion);
      return { ...adaptCanonicalPractice(document), position, published: true };
    })).catch((error) => { catalog = null; throw error; });
    return catalog;
  };
  return {
    source: 'canonical', listCatalog: loadCatalog,
    async listPage({ cursor, filters, pageSize = PRACTICE_PAGE_SIZE } = {}) { const catalog = await loadCatalog(); const all = catalog.filter((question) => matchesPracticeFilters(question, filters)); const offset = Number(cursor?.offset ?? 0); const items = all.slice(offset, offset + pageSize); const next = offset + items.length; return { items, cursor: next < all.length ? { offset: next } : null, hasMore: next < all.length, source: 'canonical', facets: { difficulties: [...new Set(catalog.map((item) => item.difficulty))], topics: [...new Set(catalog.map((item) => item.topic))], languages: [...new Set(catalog.map((item) => String(item.language).toLowerCase()))] } }; },
    async loadQuestion(metadata) { return adaptCanonicalPractice((await repository.exact(metadata.id, metadata.version)).document); },
    async loadQuestionById(questionId) { return adaptCanonicalPractice((await repository.active(questionId)).document); },
    retryQuestion(metadata) { return this.loadQuestion(metadata); },
  };
}
