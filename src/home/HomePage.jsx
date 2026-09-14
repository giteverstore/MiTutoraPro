import { useEffect, useMemo, useState } from 'react';
import { useUser } from '../auth/UserContext';
import { progressRepository } from '../progress/progressRepository';
import { useLearnerActivity } from '../activity/LearnerActivityContext';
import { loadChallengeCalendarMetadata, selectLatestPublishedChallenge } from '../challenges/challengeContentSource';
import { recentCourseRepository } from './recentCourseRepository';
import { createHomeLearningModel } from './homeLearningModel';
import { DailyChallengeCalendar } from './DailyChallengeCalendar';
import { dailyChallengeCompletionDates, kolkataDate } from './challengeCalendar';
import { ContinueLearningSection, LearningStatisticsSection, RecentlyViewedSection } from './HomeSections';
import { CoinRedemptionRepository } from '../repositories/firestore/CoinRedemptionRepository';

export function HomePage({ onOpenCourse, onContinueCourse, onBrowseLibrary, onOpenChallenges, onRedeem }) {
  const { user } = useUser();
  const activity = useLearnerActivity();
  const [learnerState, setLearnerState] = useState({ status: 'loading', progress: [] });
  const [challengeCatalog, setChallengeCatalog] = useState({ status: 'loading', items: [] });
  const [unlockedDates, setUnlockedDates] = useState([]);

  useEffect(() => {
    let active = true;
    progressRepository.list(user.id).then((progress) => {
      if (!active) return;
      setLearnerState({ status: 'ready', progress });
    }, () => { if (active) setLearnerState({ status: 'error', progress: [] }); });
    return () => { active = false; };
  }, [user.id]);

  useEffect(() => {
    let active = true;
    loadChallengeCalendarMetadata().then(
      (items) => { if (active) setChallengeCatalog({ status: 'ready', items }); },
      () => { if (active) setChallengeCatalog({ status: 'error', items: [] }); },
    );
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const load = () => new CoinRedemptionRepository(user.id).listRedemptions().then((items) => {
      if (active) setUnlockedDates(items.filter((item) => item.type === 'CHALLENGE_PASS' && item.status === 'UNLOCKED').map((item) => item.occurrenceDate));
    }, () => undefined);
    void load(); globalThis.addEventListener?.('mitutora:redemption-updated', load);
    return () => { active = false; globalThis.removeEventListener?.('mitutora:redemption-updated', load); };
  }, [user.id]);

  const completedChallengeDates = dailyChallengeCompletionDates(activity.completions);
  const model = useMemo(() => createHomeLearningModel({
    progressRecords: learnerState.progress,
    recentCourseIds: recentCourseRepository.list(user.id),
    challengesCompleted: completedChallengeDates.length,
  }), [completedChallengeDates.length, learnerState.progress, user.id]);
  const today = kolkataDate();
  const latestChallenge = selectLatestPublishedChallenge(challengeCatalog.items);

  return <div className="home-main" id="home-content">
    <div className="home-intro">
      <h1>Welcome back, {user.name.split(' ')[0]}.</h1>
      <p>Continue your path or choose the next skill you want to build.</p>
    </div>
    <div className="home-dashboard-grid">
      <div className="home-dashboard-primary">
        <LearningStatisticsSection statistics={model.statistics} status={learnerState.status} challengeStatus={activity.historyStatus} />
        <ContinueLearningSection course={model.activeCourse} status={learnerState.status} onOpenCourse={onContinueCourse} onBrowseLibrary={onBrowseLibrary} />
        <RecentlyViewedSection courses={model.recentlyViewed} onOpenCourse={onOpenCourse} />
      </div>
      <DailyChallengeCalendar today={today} challengeDates={challengeCatalog.items.map((item) => item.date)} completedDates={completedChallengeDates} unlockedDates={unlockedDates} supportedDate={latestChallenge?.date ?? null} historyStatus={activity.historyStatus} catalogStatus={challengeCatalog.status} onOpenChallenge={onOpenChallenges} onRedeem={onRedeem} />
    </div>
  </div>;
}
