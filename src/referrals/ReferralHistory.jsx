import { CheckCircle2, Clock3, Coins, Mail } from 'lucide-react';

function formatDate(value) {
  if (!value) return 'Not joined';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

const statusIcons = {
  invited: Mail,
  joined: Clock3,
  qualified: CheckCircle2,
};

export function ReferralHistory({ history }) {
  return (
    <section className="referral-history" aria-labelledby="referral-history-title">
      <header><div><span>Your invitations</span><h2 id="referral-history-title">Referral History</h2><p>Track invitation and mock reward status.</p></div><small>{history.length} records</small></header>
      <div className="referral-history-table" role="table" aria-label="Referral history">
        <div className="referral-history-head" role="row"><span role="columnheader">Friend Name</span><span role="columnheader">Join Date</span><span role="columnheader">Status</span><span role="columnheader">Reward Status</span></div>
        {history.map((entry) => {
          const StatusIcon = statusIcons[entry.status];
          return (
            <article role="row" key={entry.id}>
              <strong role="cell">{entry.friendName}</strong>
              <time role="cell">{formatDate(entry.joinDate)}</time>
              <span className={`referral-status is-${entry.status}`} role="cell"><StatusIcon /> {entry.status}</span>
              <span className={`referral-reward-status is-${entry.rewardStatus}`} role="cell"><Coins /> {entry.rewardStatus === 'earned' ? `+${entry.rewardCoins} earned` : 'Pending'}</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
