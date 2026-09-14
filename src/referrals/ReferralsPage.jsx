import { useEffect, useState } from 'react';
import { useUser } from '../auth/UserContext';
import { InviteFriends } from './InviteFriends';
import { ReferralFaq } from './ReferralFaq';
import { referralFaqs } from './referralData';
import { ReferralHistory } from './ReferralHistory';
import { ReferralOverview } from './ReferralOverview';
import { referralService } from './ReferralService';

export function ReferralsPage() {
  const { user } = useUser();
  const [profile, setProfile] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    referralService.getReferralProfile(user.id).then((loaded) => {
      if (active) setProfile(loaded);
    }).catch((error) => {
      if (active) setLoadError(error);
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

  if (!profile) {
    return <div className="referrals-page"><div className="referrals-loading" role={loadError ? 'alert' : 'status'}>{loadError?.message ?? 'Loading referral details…'}</div></div>;
  }

  return (
    <div className="referrals-page">
      <InviteFriends profile={profile} onCopy={copyText} />
      <ReferralOverview profile={profile} />
      <ReferralHistory history={profile.history} />
      <ReferralFaq faqs={referralFaqs} />
      {notice ? <div className="settings-toast" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification">×</button></div> : null}
    </div>
  );
}
