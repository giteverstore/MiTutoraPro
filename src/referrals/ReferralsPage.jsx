import { useEffect, useState } from 'react';
import { useUser } from '../auth/UserContext';
import { InviteFriends } from './InviteFriends';
import { ReferralFaq } from './ReferralFaq';
import { referralFaqs } from './referralData';
import { ReferralHistory } from './ReferralHistory';
import { ReferralOverview } from './ReferralOverview';
import { ReferralRewards } from './ReferralRewards';
import { referralService } from './ReferralService';

export function ReferralsPage() {
  const { user } = useUser();
  const [profile, setProfile] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    referralService.getReferralProfile(user.id).then((loaded) => {
      if (active) setProfile(loaded);
    });
    return () => { active = false; };
  }, [user.id]);

  const copyText = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copied.`);
    } catch {
      setNotice(`Copy unavailable. ${label}: ${value}`);
    }
  };

  const shareInvite = async () => {
    const data = {
      title: 'Learn with me on MiTutora',
      text: `Use my referral code ${profile.referralCode} to start learning on MiTutora.`,
      url: profile.referralLink,
    };
    if (navigator.share) {
      try {
        await navigator.share(data);
        setNotice('Invitation shared.');
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }
    await copyText(profile.referralLink, 'Referral link');
  };

  if (!profile) {
    return <div className="referrals-page"><div className="referrals-loading" role="status">Loading referral details…</div></div>;
  }

  return (
    <div className="referrals-page">
      <header className="referrals-heading">
        <h1>Learning is better together.</h1>
        <p>Invite friends to MiTutora and earn mock MI Coins when they begin their learning journey.</p>
      </header>
      <ReferralOverview profile={profile} />
      <InviteFriends profile={profile} onCopy={copyText} onShare={shareInvite} />
      <ReferralRewards rewards={profile.rewards} />
      <ReferralHistory history={profile.history} />
      <ReferralFaq faqs={referralFaqs} />
      {notice ? <div className="settings-toast" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></div> : null}
    </div>
  );
}
