import { BarChart3, CheckCircle2, Gauge, Target } from 'lucide-react';

export const practiceDifficultyLevels = ['easy', 'medium', 'hard'];

export function countSolvedPracticeDifficulties(completedQuestionIds, questions) {
  const metadataById = new Map(questions.map((question) => [question.id, question]));
  const unresolvedIds = [];
  const counts = [...completedQuestionIds].reduce((currentCounts, questionId) => {
    const question = metadataById.get(questionId);
    if (!question) {
      unresolvedIds.push(questionId);
      return currentCounts;
    }
    if (!practiceDifficultyLevels.includes(question.difficulty)) {
      throw new Error(`Unsupported Practice difficulty: ${question.difficulty}`);
    }
    return { ...currentCounts, [question.difficulty]: currentCounts[question.difficulty] + 1 };
  }, Object.fromEntries(practiceDifficultyLevels.map((difficulty) => [difficulty, 0])));
  return { counts, unresolvedIds };
}

export function PracticeStatistics({ completedQuestionIds = new Set(), questions, catalogStatus = 'ready' }) {
  const solvedDifficulties = catalogStatus === 'ready' ? countSolvedPracticeDifficulties(completedQuestionIds, questions) : null;
  const difficultyCounts = solvedDifficulties && solvedDifficulties.unresolvedIds.length === 0 ? solvedDifficulties.counts : null;
  const solved = completedQuestionIds.size;
  // The canonical activity store records verified completions, not failed local
  // compiler runs. Until an authoritative attempt ledger exists, a recorded
  // Practice attempt is therefore the same durable event as a solved question.
  const attempted = solved;
  const successRate = attempted ? Math.round((solved / attempted) * 100) : 0;
  const items = [
    { label: 'Solved', value: solved, icon: CheckCircle2 },
    { label: 'Attempted', value: attempted, icon: Target },
    { label: 'Success Rate', value: `${successRate}%`, icon: BarChart3 },
  ];
  return (
    <section className="practice-statistics" aria-labelledby="practice-statistics-title">
      <h2 id="practice-statistics-title">Practice Statistics</h2>
      <div>
        {items.map(({ label, value, icon: Icon }) => <article key={label}><Icon aria-hidden="true" /><span><strong>{value}</strong><small>{label}</small></span></article>)}
        <article className="practice-difficulty-summary">
          <Gauge aria-hidden="true" />
          <span className="practice-difficulty-content">
            <span className="practice-difficulty-counts">{practiceDifficultyLevels.map((difficulty) => {
              const label = `${difficulty[0].toUpperCase()}${difficulty.slice(1)}`;
              const count = difficultyCounts?.[difficulty];
              const pendingLabel = catalogStatus === 'loading' ? 'loading' : 'unavailable';
              const accessibleLabel = count == null ? `${label} — ${pendingLabel}` : `${label} — ${count} ${count === 1 ? 'question' : 'questions'}`;
              return <span className={`is-${difficulty}`} aria-label={accessibleLabel} key={difficulty}><i aria-hidden="true" /><strong>{count ?? '—'}</strong><small>{label}</small></span>;
            })}</span>
            <small>Solved by Difficulty</small>
          </span>
        </article>
      </div>
    </section>
  );
}
