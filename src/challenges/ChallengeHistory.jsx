import { CheckCircle2, Circle, Coins } from 'lucide-react';

export function ChallengeHistory({ history }) {
  return (
    <section className="challenge-history" aria-labelledby="challenge-history-title">
      <header>
        <div><span>Previous days</span><h2 id="challenge-history-title">Challenge History</h2></div>
        <small>Mock history</small>
      </header>
      <div className="challenge-history-list">
        {history.map((item) => (
          <article key={item.id}>
            <span className={item.completed ? 'is-complete' : ''}>{item.completed ? <CheckCircle2 /> : <Circle />}</span>
            <time>{item.date}</time>
            <div><strong>{item.title}</strong><small>{item.difficulty}</small></div>
            <span className="challenge-history-reward"><Coins /> {item.completed ? `+${item.reward}` : '—'}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
