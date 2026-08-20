import { useMemo, useState } from 'react';
import { useContentResource } from '../content/hooks/useContentResource';
import { PracticeDetail } from './PracticeDetail';
import { PracticeFilters } from './PracticeFilters';
import { PracticeQuestionCard } from './PracticeQuestionCard';
import { PracticeStatistics } from './PracticeStatistics';
import {
  initiallySolvedQuestionIds,
  practiceStatistics,
} from './practiceData';
import { loadPracticeQuestions } from './practiceContentSource';

const initialFilters = {
  difficulty: 'all',
  topic: 'all',
  search: '',
};

function uniqueValues(items, property) {
  return [...new Set(items.map((item) => item[property]))].sort();
}

export function PracticePage({ initialQuestionId = null }) {
  const { data: loadedQuestions, error, loading } = useContentResource(loadPracticeQuestions);
  const practiceQuestions = loadedQuestions ?? [];
  const [filters, setFilters] = useState(initialFilters);
  const [openQuestionId, setOpenQuestionId] = useState(initialQuestionId);
  const [solvedQuestionIds, setSolvedQuestionIds] = useState(
    () => new Set(initiallySolvedQuestionIds),
  );
  const filterOptions = useMemo(() => ({
    difficulties: uniqueValues(practiceQuestions, 'difficulty'),
    topics: uniqueValues(practiceQuestions, 'topic'),
  }), [practiceQuestions]);
  const visibleQuestions = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return practiceQuestions.filter((question) =>
      (filters.difficulty === 'all' || question.difficulty === filters.difficulty)
      && (filters.topic === 'all' || question.topic === filters.topic)
      && (!query || `${question.title} ${question.summary} ${question.topic}`.toLowerCase().includes(query)));
  }, [filters, practiceQuestions]);
  const openQuestion = practiceQuestions.find(({ id }) => id === openQuestionId) ?? null;

  if (loading || error) {
    return (
      <div className="practice-page">
        <header className="practice-page-heading">
          <h1>Sharpen your coding skills.</h1>
          <p>{error ? error.message : 'Loading practice questions…'}</p>
        </header>
      </div>
    );
  }

  if (openQuestion) {
    return (
      <PracticeDetail
        question={openQuestion}
        solved={solvedQuestionIds.has(openQuestion.id)}
        onBack={() => setOpenQuestionId(null)}
        onComplete={(questionId) => setSolvedQuestionIds((current) => new Set(current).add(questionId))}
      />
    );
  }

  return (
    <div className="practice-page">
      <header className="practice-page-heading">
        <h1>Sharpen your coding skills.</h1>
        <p>Choose a focused problem, write real Python, and validate your output.</p>
      </header>
      <PracticeFilters
        filters={filters}
        options={filterOptions}
        onChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
      />
      <div className="practice-catalog">
        <section className="practice-question-list" aria-labelledby="practice-question-list-title">
          <header><div><span>Question Catalog</span><h2 id="practice-question-list-title">{visibleQuestions.length} questions</h2></div></header>
          <div>
            {visibleQuestions.map((question) => (
              <PracticeQuestionCard
                question={question}
                solved={solvedQuestionIds.has(question.id)}
                onSelect={(nextQuestion) => setOpenQuestionId(nextQuestion.id)}
                key={question.id}
              />
            ))}
            {!visibleQuestions.length ? <p className="practice-no-results">No questions match your filters.</p> : null}
          </div>
        </section>
      </div>
      <PracticeStatistics statistics={practiceStatistics} language={visibleQuestions[0]?.language ?? 'Python'} />
    </div>
  );
}
