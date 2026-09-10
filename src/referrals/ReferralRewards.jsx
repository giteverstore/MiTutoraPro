import { ArrowRight, BadgeIndianRupee, Gift, UserPlus } from 'lucide-react';

export function ReferralRewards({ tier = 'FREE' }) {
  const rate = tier === 'PREMIUM' ? 15 : 10;
  return (
    <section className="referral-rewards" aria-labelledby="referral-rewards-title">
      <header><span>How it works</span><h2 id="referral-rewards-title">Calculated rewards</h2><p>As a {tier} learner, your current referral rate is {rate}% at qualification time.</p></header>
      <div className="referral-flow">
        <article><UserPlus /><span>1</span><h3>Invite a friend</h3><p>Send your unique referral code or link.</p></article>
        <ArrowRight className="referral-flow-arrow" aria-hidden="true" />
        <article><Gift /><span>2</span><h3>They subscribe</h3><p>Your friend completes their first qualifying verified Premium purchase.</p></article>
        <ArrowRight className="referral-flow-arrow" aria-hidden="true" />
        <article><BadgeIndianRupee /><span>3</span><h3>We calculate</h3><p>{rate}% of the canonical purchase amount is recorded as a calculated reward. It is not wallet money.</p></article>
      </div>
    </section>
  );
}
