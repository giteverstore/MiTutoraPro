import { BarChart3, CheckCircle2, Gauge, Target } from 'lucide-react';

const difficultyLevels = ['easy', 'medium', 'hard'];

export function PracticeStatistics({ completedQuestionIds = new Set(), questions }) {
  const difficultyCounts = difficultyLevels.reduce((counts, difficulty) => ({
    ...counts,
    [difficulty]: questions.filter((question) => question.difficulty === difficulty).length,
  }), {});
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
            <span className="practice-difficulty-counts">{difficultyLevels.map((difficulty) => {
              const label = `${difficulty[0].toUpperCase()}${difficulty.slice(1)}`;
              const accessibleLabel = `${label} — ${difficultyCounts[difficulty]} ${difficultyCounts[difficulty] === 1 ? 'question' : 'questions'}`;
              return <span className={`is-${difficulty}`} aria-label={accessibleLabel} key={difficulty}><i aria-hidden="true" /><strong>{difficultyCounts[difficulty]}</strong><small>{label}</small></span>;
            })}</span>
            <small>Questions by Difficulty</small>
          </span>
        </article>
      </div>
    </section>
  );
}
