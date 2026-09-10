import { Award, CalendarCheck2, Coins, Flame, Trophy } from 'lucide-react';

export function RewardSummary({ claimed, rewardStatus, rewardAmount = 0 }) {
  const message = {
    credited: `Completed; +${rewardAmount} coins earned.`,
    already_claimed: 'Completed; this reward was already claimed.',
    daily_reward_cap_reached: 'Completed; daily reward cap reached.',
    unavailable: 'Completed; reward reconciliation is pending.',
  }[rewardStatus] ?? 'Completed; the reward is currently unavailable.';
  return (
    <section className="challenge-summary-card" aria-labelledby="reward-summary-title">
      <div className="challenge-summary-icon"><Award aria-hidden="true" /></div>
      <div>
        <span>Daily reward</span>
        <h2 id="reward-summary-title">Reward Summary</h2>
        <p>{claimed ? message : 'Complete the challenge to save authoritative progress.'}</p>
      </div>
      <ul>
        <li><Coins /> <strong>{rewardStatus === 'credited' ? `+${rewardAmount} coins earned` : 'No coins credited'}</strong></li>
        <li><Flame /> <strong>Server-tracked streak</strong></li>
      </ul>
    </section>
  );
}

export function CurrentStreak({ statistics, completed }) {
  return (
    <section className="challenge-summary-card" aria-labelledby="current-streak-title">
      <div className="challenge-summary-icon"><Flame aria-hidden="true" /></div>
      <div>
        <span>Consistency</span>
        <h2 id="current-streak-title">Current Streak</h2>
        <p>{completed ? 'Today is secured. Keep the chain going tomorrow.' : 'Complete today’s challenge to extend your streak.'}</p>
      </div>
      <ul>
        <li><CalendarCheck2 /> <strong>{statistics.currentStreak} day current</strong></li>
        <li><Trophy /> <strong>{statistics.longestStreak} day best</strong></li>
      </ul>
    </section>
  );
}
