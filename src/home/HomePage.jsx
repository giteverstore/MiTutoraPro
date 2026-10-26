import { useEffect, useMemo, useState } from 'react';
import { useUser } from '../auth/UserContext';
import { progressRepository } from '../progress/progressRepository';
import { useLearnerActivity } from '../activity/LearnerActivityContext';
import { loadChallengeCalendarMetadata, selectLatestPublishedChallenge } from '../challenges/challengeContentSource';
import { recentCourseRepository } from './recentCourseRepository';
import { createHomeLearningModel } from './homeLearningModel';
import { loadActiveCourseCatalog, loadPinnedCourseCatalog } from './canonicalCourseCatalog';
import { DailyChallengeCalendar } from './DailyChallengeCalendar';
import { dailyChallengeCompletionDates, kolkataDate, monthDateRange, monthIdentity } from './challengeCalendar';
import { ContinueLearningSection, LearningStatisticsSection, RecentlyViewedSection } from './HomeSections';
import { CoinRedemptionRepository } from '../repositories/firestore/CoinRedemptionRepository';

export function HomePage({ onOpenCourse, onContinueCourse, onBrowseLibrary, onOpenChallenges, onRedeem }) {
  const { user } = useUser();
  const activity = useLearnerActivity();
  const [learnerState, setLearnerState] = useState({ status: 'loading', progress: [] });
  const [challengeCatalog, setChallengeCatalog] = useState({ status: 'loading', items: [] });
  const [unlockedDates, setUnlockedDates] = useState([]);
  const [publishedCatalog, setPublishedCatalog] = useState({ status: 'loading', courses: [] });
  const [pinnedCatalog, setPinnedCatalog] = useState({ status: 'loading', courses: [] });
  const today = kolkataDate();
  const [challengeMonth, setChallengeMonth] = useState(() => monthIdentity(new Date(`${today}T12:00:00+05:30`)));
  const [challengeCompletionCount, setChallengeCompletionCount] = useState(0);
  useEffect(() => {
    let active = true;
    loadActiveCourseCatalog().then(
      (courses) => { if (active) setPublishedCatalog({ status: 'ready', courses }); },
      () => { if (active) setPublishedCatalog({ status: 'error', courses: [] }); },
    );
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (learnerState.status === 'loading' || publishedCatalog.status === 'loading') return undefined;
    let active = true;
    loadPinnedCourseCatalog(learnerState.progress, undefined, publishedCatalog.courses).then(
      (courses) => { if (active) setPinnedCatalog({ status: 'ready', courses }); },
      () => { if (active) setPinnedCatalog({ status: 'error', courses: [] }); },
    );
    return () => { active = false; };
  }, [learnerState.status, learnerState.progress, publishedCatalog.status, publishedCatalog.courses]);

  useEffect(() => {
    let active = true;
    progressRepository.list(user.id).then((progress) => {
      if (!active) return;
      setLearnerState({ status: 'ready', progress });
    }, () => { if (active) setLearnerState({ status: 'error', progress: [] }); });
    return () => { active = false; };
  }, [user.id]);

  useEffect(() => {
    const range = monthDateRange(challengeMonth);
    void activity.loadChallengeRange?.(range.startDate, range.endDate).catch(() => undefined);
  }, [activity.loadChallengeRange, challengeMonth]);

  useEffect(() => {
    let active = true;
    activity.countCompleted?.('DAILY_CHALLENGE').then((count) => { if (active) setChallengeCompletionCount(count); }, () => undefined);
    return () => { active = false; };
  }, [activity.countCompleted]);

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
    challengesCompleted: activity.countCompleted ? challengeCompletionCount : completedChallengeDates.length,
    publishedCourses: publishedCatalog.courses,
    pinnedCourses: pinnedCatalog.courses,
  }), [activity.countCompleted, challengeCompletionCount, completedChallengeDates.length, learnerState.progress, publishedCatalog.courses, pinnedCatalog.courses, user.id]);
  const courseCatalogLoading = publishedCatalog.status === 'loading' || pinnedCatalog.status === 'loading';
  const courseSectionStatus = learnerState.status === 'error' ? 'error' : learnerState.status === 'loading' || courseCatalogLoading ? 'loading' : 'ready';
  const latestChallenge = selectLatestPublishedChallenge(challengeCatalog.items);

  return <div className="home-main" id="home-content">
    <div className="home-intro">
      <h1>Welcome back, {user.name.split(' ')[0]}.</h1>
    </div>
    <div className="home-dashboard-grid">
      <div className="home-dashboard-primary">
        <LearningStatisticsSection statistics={model.statistics} status={learnerState.status} challengeStatus={activity.historyStatus} />
        <ContinueLearningSection courses={model.enrollments} status={courseSectionStatus} onOpenCourse={onContinueCourse} onBrowseLibrary={onBrowseLibrary} />
        <RecentlyViewedSection courses={model.recentlyViewed} status={courseSectionStatus} onOpenCourse={onOpenCourse} />
      </div>
      <DailyChallengeCalendar today={today} challengeDates={challengeCatalog.items.map((item) => item.date)} completedDates={completedChallengeDates} unlockedDates={unlockedDates} supportedDate={latestChallenge?.date ?? null} historyStatus={activity.historyStatus} catalogStatus={challengeCatalog.status} onOpenChallenge={onOpenChallenges} onRedeem={onRedeem} onMonthChange={setChallengeMonth} />
    </div>
  </div>;
}
