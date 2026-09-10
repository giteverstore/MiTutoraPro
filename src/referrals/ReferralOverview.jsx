import { BadgeIndianRupee, Gift, UserCheck, Users } from 'lucide-react';

const money = (minor) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(minor / 100);

export function ReferralOverview({ profile }) {
  const items = [
    { label: 'Referral Code', value: profile.referralCode, icon: Gift },
    { label: 'Referred', value: profile.totalReferred, icon: Users },
    { label: 'Qualified', value: profile.qualified, icon: UserCheck },
    { label: 'Calculated rewards', value: money(profile.calculatedRewardsMinor), icon: BadgeIndianRupee },
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
