import { Coins, Gift, UserCheck, Users } from 'lucide-react';

export function ReferralOverview({ profile }) {
  const items = [
    { label: 'Referral Code', value: profile.referralCode, icon: Gift },
    { label: 'Total Invites', value: profile.totalInvites, icon: Users },
    { label: 'Successful Referrals', value: profile.successfulReferrals, icon: UserCheck },
    { label: 'MI Coins Earned', value: profile.coinsEarned, icon: Coins },
  ];
  return (
    <section className="referral-overview" aria-labelledby="referral-overview-title">
      <h2 id="referral-overview-title" className="sr-only">Referral Overview</h2>
      {items.map(({ label, value, icon: Icon }) => (
        <article key={label}><Icon aria-hidden="true" /><span><strong>{value}</strong><small>{label}</small></span></article>
      ))}
    </section>
  );
}
