function formatDate(value) {
  if (!value) return 'Not joined';
  const date = typeof value?.seconds === 'number' ? new Date(value.seconds * 1000) : new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

const money = (minor) => minor == null ? 'Not calculated' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(minor / 100);

export function ReferralHistory({ history }) {
  return (
    <section className="referral-history" aria-labelledby="referral-history-title">
      <header><div><h2 id="referral-history-title">Referral History</h2></div></header>
      <div className="referral-history-table" role="table" aria-label="Referral history">
        <div className="referral-history-head" role="row"><span role="columnheader">Referral</span><span role="columnheader">Attributed</span><span role="columnheader">Status</span><span role="columnheader">Calculated reward</span></div>
        {history.map((entry) => {
          return (
            <article role="row" key={entry.id}>
              <strong role="cell">Referral {entry.id.slice(0, 8)}</strong>
              <time role="cell">{formatDate(entry.attributedAt?.toDate?.() ?? entry.attributedAt)}</time>
              <span className="referral-status" role="cell">{entry.status === 'QUALIFIED' ? 'Qualified' : 'Attributed'}</span>
              <span className="referral-reward-status" role="cell">{money(entry.calculatedRewardMinor)}</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
