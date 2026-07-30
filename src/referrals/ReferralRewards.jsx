import { ArrowRight, Coins, Gift, UserPlus } from 'lucide-react';

export function ReferralRewards({ rewards }) {
  return (
    <section className="referral-rewards" aria-labelledby="referral-rewards-title">
      <header><span>How it works</span><h2 id="referral-rewards-title">Rewards</h2><p>Both learners receive a reward after the referral qualifies.</p></header>
      <div className="referral-flow">
        <article><UserPlus /><span>1</span><h3>Invite a friend</h3><p>Send your unique referral code or link.</p></article>
        <ArrowRight className="referral-flow-arrow" aria-hidden="true" />
        <article><Gift /><span>2</span><h3>They start learning</h3><p>{rewards.qualification}</p></article>
        <ArrowRight className="referral-flow-arrow" aria-hidden="true" />
        <article><Coins /><span>3</span><h3>You both earn</h3><p>{rewards.referrerCoins} coins for you and {rewards.referredUserCoins} coins for your friend.</p></article>
      </div>
      <div className="referral-reward-values">
        <div><span>Referrer receives</span><strong>{rewards.referrerCoins} MI Coins</strong></div>
        <div><span>Referred learner receives</span><strong>{rewards.referredUserCoins} MI Coins</strong></div>
      </div>
    </section>
  );
}
