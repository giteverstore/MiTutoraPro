import { Award, CalendarCheck2, Coins, Flame, Trophy } from 'lucide-react';

export function RewardSummary({ reward, claimed }) {
  return (
    <section className="challenge-summary-card" aria-labelledby="reward-summary-title">
      <div className="challenge-summary-icon"><Award aria-hidden="true" /></div>
      <div>
        <span>Daily reward</span>
        <h2 id="reward-summary-title">Reward Summary</h2>
        <p>{claimed ? 'Today’s reward has been added to your mock balance.' : 'Verify your solution and claim both rewards.'}</p>
      </div>
      <ul>
        <li><Coins /> <strong>{reward.coins} MI Coins</strong></li>
        <li><Flame /> <strong>+{reward.streakIncrement} Streak</strong></li>
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
        <li><CalendarCheck2 /> <strong>{statistics.completedThisMonth} this month</strong></li>
        <li><Trophy /> <strong>{statistics.longestStreak} day best</strong></li>
      </ul>
    </section>
  );
}
