import { Coins, Flame } from 'lucide-react';

export function ChallengeHero({ challenge, streak, completed }) {
  const currentDay = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  return (
    <section className={`challenge-hero ${completed ? 'is-completed' : ''}`} aria-labelledby="challenge-hero-title">
      <div>
        <h1 id="challenge-hero-title">{completed ? 'Challenge complete.' : 'Your daily challenge is ready.'}</h1>
        <p>{completed ? 'Reward claimed. Come back tomorrow to keep your streak moving.' : challenge.motivation}</p>
        <time dateTime={new Date().toISOString().slice(0, 10)}>{currentDay}</time>
      </div>
      <div className="challenge-hero-metrics">
        <article><Flame aria-hidden="true" /><span><strong>{streak} days</strong><small>Current Streak</small></span></article>
        <article><Coins aria-hidden="true" /><span><strong>{challenge.reward.coins} MI Coins</strong><small>Today’s Reward</small></span></article>
      </div>
    </section>
  );
}
