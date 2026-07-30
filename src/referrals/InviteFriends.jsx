import { Copy, Share2 } from 'lucide-react';

export function InviteFriends({ profile, onCopy, onShare }) {
  return (
    <section className="invite-friends" aria-labelledby="invite-friends-title">
      <header><span>Spread the word</span><h2 id="invite-friends-title">Invite Friends</h2><p>Share MiTutora and earn mock rewards when friends begin learning.</p></header>
      <div className="referral-fields">
        <div><span>Referral Code</span><strong>{profile.referralCode}</strong><button type="button" onClick={() => onCopy(profile.referralCode, 'Referral code')}><Copy /> Copy Code</button></div>
        <div><span>Referral Link</span><strong>{profile.referralLink}</strong><button type="button" onClick={() => onCopy(profile.referralLink, 'Referral link')}><Copy /> Copy Link</button></div>
      </div>
      <button className="button button--primary referral-share-button" type="button" onClick={onShare}><Share2 /> Share Invitation</button>
    </section>
  );
}
