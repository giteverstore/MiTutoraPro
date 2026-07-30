import { BarChart3, CheckCircle2, Code2, Target } from 'lucide-react';

export function PracticeStatistics({ statistics, language }) {
  const items = [
    { label: 'Solved', value: statistics.solved, icon: CheckCircle2 },
    { label: 'Attempted', value: statistics.attempted, icon: Target },
    { label: 'Success Rate', value: `${statistics.successRate}%`, icon: BarChart3 },
    { label: 'Current Language', value: language === 'all' ? 'Python' : language, icon: Code2 },
  ];
  return (
    <section className="practice-statistics" aria-labelledby="practice-statistics-title">
      <h2 id="practice-statistics-title">Practice Statistics</h2>
      <div>{items.map(({ label, value, icon: Icon }) => <article key={label}><Icon aria-hidden="true" /><span><strong>{value}</strong><small>{label}</small></span></article>)}</div>
    </section>
  );
}
