import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PracticeDetail } from './PracticeDetail';
import { PracticeFilters } from './PracticeFilters';
import { PracticeQuestionCard } from './PracticeQuestionCard';
import { PracticeStatistics } from './PracticeStatistics';
import { initiallySolvedQuestionIds, practiceStatistics } from './practiceData';
import { practiceContentSource } from './practiceContentSource';

const initialFilters = { difficulty: 'all', topic: 'all', search: '' };
const uniqueValues = (items, property) => [...new Set(items.map((item) => item[property]))].sort();

export function PracticePage({ initialQuestionId = null, onQuestionChange = () => {} }) {
  const [filters, setFilters] = useState(initialFilters);
  const [catalog, setCatalog] = useState({ items: [], cursor: null, hasMore: false, loading: true, error: null, facets: null });
  const [openQuestionId, setOpenQuestionId] = useState(initialQuestionId);
  const [openQuestion, setOpenQuestion] = useState(null);
  const [questionState, setQuestionState] = useState({ loading: false, error: null, retry: 0 });
  const [solvedQuestionIds, setSolvedQuestionIds] = useState(() => new Set(initiallySolvedQuestionIds));
  const catalogRequest = useRef(0);
  const filterOptions = useMemo(() => ({
    difficulties: catalog.facets?.difficulties ?? uniqueValues(catalog.items, 'difficulty'),
    topics: catalog.facets?.topics ?? uniqueValues(catalog.items, 'topic'),
  }), [catalog.facets, catalog.items]);

  const loadPage = useCallback(async ({ append = false } = {}) => {
    const requestId = ++catalogRequest.current;
    setCatalog((current) => ({ ...current, loading: true, error: null }));
    try {
      const page = await practiceContentSource.listPage({ cursor: append ? catalog.cursor : null, filters });
      setCatalog((current) => {
        if (requestId !== catalogRequest.current) return current;
        const combined = append ? [...current.items, ...page.items] : page.items;
        return { items: [...new Map(combined.map((item) => [item.id, item])).values()], cursor: page.cursor, hasMore: page.hasMore, loading: false, error: null, facets: page.facets ?? current.facets };
      });
    } catch (error) { if (requestId === catalogRequest.current) setCatalog((current) => ({ ...current, loading: false, error })); }
  }, [catalog.cursor, filters]);

  useEffect(() => { loadPage(); }, [filters.difficulty, filters.topic, filters.search]);
  useEffect(() => {
    if (!openQuestionId) { setOpenQuestion(null); setQuestionState({ loading: false, error: null, retry: 0 }); return undefined; }
    let active = true;
    const metadata = catalog.items.find(({ id }) => id === openQuestionId);
    setQuestionState((state) => ({ ...state, loading: true, error: null }));
    (metadata ? practiceContentSource.loadQuestion(metadata) : practiceContentSource.loadQuestionById(openQuestionId)).then(
      (question) => { if (active) { setOpenQuestion(question); setQuestionState((state) => ({ ...state, loading: false })); } },
      (error) => { if (active) setQuestionState((state) => ({ ...state, loading: false, error })); },
    );
    return () => { active = false; };
  }, [openQuestionId, questionState.retry]);

  if ((catalog.loading || catalog.error) && !catalog.items.length && !openQuestionId) {
    return <div className="practice-page"><header className="practice-page-heading"><h1>Sharpen your coding skills.</h1><p>{catalog.error ? 'Practice questions could not be loaded. Check your connection and retry.' : 'Loading practice questions…'}</p>{catalog.error ? <button className="button button--secondary" type="button" onClick={() => loadPage()}>Retry</button> : null}</header></div>;
  }
  if (openQuestionId && (questionState.loading || questionState.error)) {
    return <div className="practice-page"><header className="practice-page-heading"><h1>{questionState.error ? 'This question couldn’t be loaded.' : 'Loading question…'}</h1><p>{questionState.error ? 'The catalog remains available. Retry this question or return to Practice.' : 'Verifying and preparing the question content.'}</p>{questionState.error ? <button className="button button--secondary" type="button" onClick={() => setQuestionState((state) => ({ ...state, retry: state.retry + 1 }))}>Retry</button> : null}<button className="button button--ghost" type="button" onClick={() => setOpenQuestionId(null)}>Back to Practice</button></header></div>;
  }
  if (openQuestion) {
    return <PracticeDetail question={openQuestion} solved={solvedQuestionIds.has(openQuestion.id)} onBack={() => { setOpenQuestionId(null); onQuestionChange(null); }} onComplete={(questionId) => setSolvedQuestionIds((current) => new Set(current).add(questionId))} />;
  }

  return (
    <div className="practice-page">
      <header className="practice-page-heading"><h1>Sharpen your coding skills.</h1><p>Choose a focused problem, write real Python, and validate your output.</p></header>
      <PracticeFilters filters={filters} options={filterOptions} onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))} />
      <div className="practice-catalog"><section className="practice-question-list" aria-labelledby="practice-question-list-title"><header><div><span>Question Catalog</span><h2 id="practice-question-list-title">{catalog.items.length} questions</h2></div></header><div>
        {catalog.items.map((question) => <PracticeQuestionCard question={question} solved={solvedQuestionIds.has(question.id)} onSelect={(nextQuestion) => { setOpenQuestionId(nextQuestion.id); onQuestionChange(nextQuestion.id); }} key={question.id} />)}
        {!catalog.items.length ? <p className="practice-no-results">No questions match your filters.</p> : null}
        {catalog.error ? <p className="practice-no-results">More questions couldn’t be loaded. <button type="button" onClick={() => loadPage({ append: true })}>Retry</button></p> : null}
        {catalog.hasMore ? <button className="button button--secondary" type="button" disabled={catalog.loading} onClick={() => loadPage({ append: true })}>{catalog.loading ? 'Loading…' : 'Load more questions'}</button> : null}
      </div></section></div>
      <PracticeStatistics statistics={practiceStatistics} language={catalog.items[0]?.language ?? 'Python'} />
    </div>
  );
}
