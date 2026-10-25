import { BadgeIndianRupee } from 'lucide-react';
import { learnerUiIcons } from '../assets/learnerUiIcons';

const money = (minor) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(minor / 100);

export function ReferralOverview({ profile }) {
  const items = [
    { label: 'Referred', value: profile.totalReferred, image: learnerUiIcons.group },
    { label: 'Qualified', value: profile.qualified, image: learnerUiIcons.quality },
    { label: 'Calculated rewards', value: money(profile.calculatedRewardsMinor), Icon: BadgeIndianRupee },
  ];
  return (
    <section className="referral-overview" aria-labelledby="referral-overview-title">
      <h2 id="referral-overview-title" className="sr-only">Referral Overview</h2>
      {items.map(({ label, value, image, Icon }) => (
        <article key={label}>{image ? <img className="learner-ui-icon" src={image} alt="" aria-hidden="true" /> : <Icon aria-hidden="true" />}<span><strong>{value}</strong><small>{label}</small></span></article>
      ))}
    </section>
  );
}
