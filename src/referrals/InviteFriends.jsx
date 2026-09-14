import { Copy } from 'lucide-react';

export function InviteFriends({ profile, onCopy }) {
  return (
    <section className="invite-friends" aria-label="Referral sharing controls">
      <div className="referral-fields">
        <div><span>Referral Code</span><strong>{profile.referralCode}</strong><button type="button" onClick={() => onCopy(profile.referralCode, 'Referral code')}><Copy /> Copy Code</button></div>
        <div><span>Referral Link</span><strong>{profile.referralLink}</strong><button type="button" onClick={() => onCopy(profile.referralLink, 'Referral link')}><Copy /> Copy Link</button></div>
      </div>
    </section>
  );
}
