import { CheckCircle2, Circle, TicketCheck } from 'lucide-react';

export function ChallengeHistory({ history, onOpenChallenge, onUsePass, balance = 0, passUses = 0, redemptionReady = false }) {
  return <section className="challenge-history" aria-labelledby="challenge-history-title">
    <header><div><h2 id="challenge-history-title">Challenge History</h2></div></header>
    <div className="challenge-history-list">
      {history.length ? history.map((item) => <article key={item.date}>
        <span className={item.completed ? 'is-complete' : ''}>{item.completed ? <CheckCircle2 /> : <Circle />}</span>
        <time dateTime={item.date}>{item.displayDate}</time>
        <div><strong>{item.title}</strong><small>{item.difficulty}</small></div>
        {item.completed
          ? <button className="button button--secondary" type="button" onClick={() => onOpenChallenge(item.date)}>Review</button>
          : item.unlocked ? <button className="button button--primary" type="button" onClick={() => onOpenChallenge(item.date)}>Start Challenge</button>
            : !redemptionReady ? <span className="challenge-history-status">Missed</span>
            : passUses >= 3 ? <span className="challenge-history-status">Recovery limit reached</span>
              : balance < 150 ? <span className="challenge-history-status">Need more coins</span>
                : <button className="button button--secondary" type="button" onClick={() => onUsePass(item)}><TicketCheck /> Use Challenge Pass</button>}
      </article>) : <p className="challenge-history-empty">No previous challenges are available yet.</p>}
    </div>
  </section>;
}
