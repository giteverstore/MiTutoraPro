import { BarChart3, CheckCircle2, Gauge, Target } from 'lucide-react';

const difficultyLevels = ['easy', 'medium', 'hard'];

export function PracticeStatistics({ statistics, questions }) {
  const difficultyCounts = difficultyLevels.reduce((counts, difficulty) => ({
    ...counts,
    [difficulty]: questions.filter((question) => question.difficulty === difficulty).length,
  }), {});
  const items = [
    { label: 'Solved', value: statistics.solved, icon: CheckCircle2 },
    { label: 'Attempted', value: statistics.attempted, icon: Target },
    { label: 'Success Rate', value: `${statistics.successRate}%`, icon: BarChart3 },
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
              return <span className={`is-${difficulty}`} tabIndex="0" aria-label={accessibleLabel} data-tooltip={label} key={difficulty}><i aria-hidden="true" />{difficultyCounts[difficulty]}</span>;
            })}</span>
            <small>Questions by Difficulty</small>
          </span>
        </article>
      </div>
    </section>
  );
}
