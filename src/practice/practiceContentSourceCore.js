export const PRACTICE_PAGE_SIZE = 24;

export function matchesPracticeFilters(question, filters = {}) {
  const query = String(filters.search ?? '').trim().toLowerCase();
  return (filters.difficulty === 'all' || !filters.difficulty || question.difficulty === filters.difficulty)
    && (filters.topic === 'all' || !filters.topic || question.topic === filters.topic)
    && (!query || `${question.title} ${question.summary} ${question.topic} ${question.category ?? ''} ${(question.skills ?? []).join(' ')}`.toLowerCase().includes(query));
}

export function createPracticeSourceAdapter({ source, firebaseService, localQuestions, fallbackEnabled = false }) {
  let publicationPromise;
  const getPublication = () => {
    publicationPromise ??= firebaseService.getPublication().catch((error) => {
      if (error?.code === 'permission-denied' || error?.code === 'firestore/permission-denied') return null;
      throw error;
    });
    return publicationPromise;
  };
  const localPage = ({ cursor, filters, pageSize = PRACTICE_PAGE_SIZE }) => {
    const matches = localQuestions.filter((question) => matchesPracticeFilters(question, filters));
    const start = Number(cursor?.offset ?? 0);
    const items = matches.slice(start, start + pageSize);
    const nextOffset = start + items.length;
    return {
      items,
      cursor: nextOffset < matches.length ? { offset: nextOffset } : null,
      hasMore: nextOffset < matches.length,
      source: 'local',
      facets: {
        difficulties: [...new Set(localQuestions.map(({ difficulty }) => difficulty))].sort(),
        topics: [...new Set(localQuestions.map(({ topic }) => topic))].sort(),
      },
    };
  };
  const firebasePage = async ({ cursor, filters, pageSize = PRACTICE_PAGE_SIZE }) => {
    const publication = await getPublication();
    const queryFilters = [{ field: 'published', value: true }];
    if (publication?.activeVersion) queryFilters.push({ field: 'version', value: publication.activeVersion });
    if (filters?.difficulty && filters.difficulty !== 'all') queryFilters.push({ field: 'difficulty', value: filters.difficulty });
    if (filters?.topic && filters.topic !== 'all') queryFilters.push({ field: 'topic', value: filters.topic });
    let nextCursor = cursor;
    let hasMore = true;
    const items = [];
    while (items.length < pageSize && hasMore) {
      const page = await firebaseService.listMetadataPage({ query: { filters: queryFilters, orderBy: [{ field: 'position', direction: 'asc' }], limit: pageSize, cursor: nextCursor } });
      if (publication?.integrityRequired && page.items.some((item) => !/^[a-f0-9]{64}$/.test(item.contentHash))) throw new Error('Published Practice metadata is missing required content integrity information.');
      items.push(...page.items.filter((item) => matchesPracticeFilters(item, filters)));
      nextCursor = page.cursor;
      hasMore = page.hasMore;
    }
    return { items: items.slice(0, pageSize), cursor: nextCursor, hasMore, source: 'firebase', facets: publication?.facets ?? null };
  };
  const api = {
    source,
    async listPage(options = {}) {
      if (source === 'local') return localPage(options);
      try { return await firebasePage(options); } catch (error) { if (!fallbackEnabled) throw error; return localPage(options); }
    },
    async loadQuestion(metadata) {
      if (source === 'local') {
        const question = localQuestions.find(({ id }) => id === metadata.id);
        if (!question) throw new Error('The local Practice question could not be found.');
        return question;
      }
      return (await firebaseService.getQuestionFromMetadata(metadata)).content;
    },
    async loadQuestionById(questionId) {
      if (source === 'local') {
        const question = localQuestions.find(({ id }) => id === questionId);
        if (!question) throw new Error('The local Practice question could not be found.');
        return question;
      }
      const [publication, metadata] = await Promise.all([getPublication(), firebaseService.getMetadata(questionId)]);
      if (publication?.activeVersion && metadata.version !== publication.activeVersion) throw new Error('This Practice question is not part of the active publication.');
      if (publication?.integrityRequired && !/^[a-f0-9]{64}$/.test(metadata.contentHash)) throw new Error('Published Practice metadata is missing required content integrity information.');
      return (await firebaseService.getQuestionFromMetadata(metadata)).content;
    },
    retryQuestion(metadata) {
      if (source === 'firebase') firebaseService.invalidateQuestion(metadata);
      return api.loadQuestion(metadata);
    },
  };
  return Object.freeze(api);
}
