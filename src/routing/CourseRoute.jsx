import { Suspense, useEffect, useState } from 'react';
import '../styles/routing.css';
import { CourseLoaderProvider, useCourseLoader } from '../course/CourseLoader';
import { CourseLoadState } from '../components/CourseLoadState';
import { CourseOverviewPage } from '../pages/CourseOverviewPage';
import { lazyNamedExport } from './lazyRoute';
import { useUser } from '../auth/UserContext';
import {
  LearningProgressProvider,
  useLearningProgress,
} from '../progress/LearningProgressContext';
import { canonicalLessonIndex, canAccessLesson } from '../access/accessPolicy';
import { useSubscriptionAccess } from '../access/SubscriptionAccessContext';
import { PremiumGate } from '../access/PremiumGate';
import { progressRepository } from '../progress/progressRepository.js';
import { phase5Mark } from '../performance/phase5Mark.js';

const LearningEnginePage = lazyNamedExport(() => import('../pages/LearningEnginePage'), 'LearningEnginePage');

export function CourseRoute({
  courseId,
  initialLessonId,
  stage,
  onEnterCourse,
  onShowOverview,
  onExitCourse,
  onLessonRoute,
  onStartExam,
  anonymous = false,
}) {
  const user = useUser({ optional: true })?.user;
  const [pin, setPin] = useState({ status: anonymous || !user?.id ? 'ready' : 'loading', version: null });
  useEffect(() => { phase5Mark('course:route-mounted', { courseId }); }, [courseId]);
  useEffect(() => {
    let active = true;
    if (anonymous || !user?.id) { setPin({ status: 'ready', version: null }); return () => { active = false; }; }
    setPin({ status: 'loading', version: null });
    phase5Mark('course:pin:start', { courseId });
    progressRepository.load(user.id, courseId).then((record) => {
      phase5Mark('course:pin:end', { courseId, pinned: Number.isSafeInteger(record?.contentVersion) });
      if (active) setPin({ status: 'ready', version: Number.isSafeInteger(record?.contentVersion) ? record.contentVersion : null, storedProgress: record });
    }).catch(() => {
      phase5Mark('course:pin:error', { courseId });
      if (active) setPin({ status: 'ready', version: null });
    });
    return () => { active = false; };
  }, [anonymous, courseId, user?.id]);
  if (pin.status === 'loading') return <CourseLoadState state="loading" />;
  return (
    <CourseLoaderProvider
      key={`${courseId}:${pin.version ?? 'active'}:${initialLessonId ?? 'overview'}`}
      courseId={courseId}
      contentVersion={pin.version}
      initialLessonId={initialLessonId}
    >
      <LoadedCourseApplication
        stage={stage}
        onEnterCourse={onEnterCourse}
        onShowOverview={onShowOverview}
        onExitCourse={onExitCourse}
        onLessonRoute={onLessonRoute}
        onStartExam={onStartExam}
        anonymous={anonymous}
        initialStoredProgress={pin.storedProgress}
      />
    </CourseLoaderProvider>
  );
}

function LoadedCourseApplication({
  stage,
  onEnterCourse,
  onShowOverview,
  onExitCourse,
  onLessonRoute,
  onStartExam,
  anonymous,
  initialStoredProgress,
}) {
  const courseLoader = useCourseLoader();
  const user = useUser({ optional: true })?.user;

  if (courseLoader.isLoading) return <CourseLoadState state="loading" />;
  if (courseLoader.status === 'error') {
    return <CourseLoadState state="error" error={courseLoader.error} />;
  }

  if (anonymous) return <CourseOverviewPage course={courseLoader.currentCourse} anonymous onBack={onExitCourse} onEnterCourse={onEnterCourse} />;

  return (
    <LearningProgressProvider
      course={courseLoader.currentCourse}
      userId={user.id}
      initialLessonId={courseLoader.currentLesson?.id}
      initialCompletedLessons={user.completedLessons}
      initialVisitedLessons={user.visitedLessons}
      initialBookmarks={user.bookmarks}
      initialStoredProgress={initialStoredProgress}
    >
      <ProgressProfileSync />
      {stage === 'overview' ? (
        <CourseOverviewPage
          course={courseLoader.currentCourse}
          onBack={onExitCourse}
          onEnterCourse={onEnterCourse}
          onStartExam={onStartExam}
          onResetCourse={() => {
            courseLoader.selectLesson(
              courseLoader.currentCourse.navigation?.defaultLessonId
                ?? courseLoader.currentCourse.defaultLessonId,
            );
          }}
        />
      ) : (
        <ProgressAwareApplication
          courseLoader={courseLoader}
          onExitCourse={onShowOverview}
          onLessonRoute={onLessonRoute}
        />
      )}
    </LearningProgressProvider>
  );
}

function ProgressProfileSync() {
  const { updateProfile } = useUser();
  const progress = useLearningProgress();

  useEffect(() => {
    if (progress.status !== 'ready') return;
    updateProfile({
      currentLesson: progress.currentLesson,
      completedLessons: progress.completedLessons,
      visitedLessons: progress.visitedLessons,
      bookmarks: progress.bookmarks,
      sequentialCompletedLessons: progress.sequentialCompletedLessons,
      courseProgress: progress.courseProgress,
    });
  }, [
    progress.status,
    progress.currentLesson,
    progress.completedLessons,
    progress.visitedLessons,
    progress.bookmarks,
    progress.sequentialCompletedLessons,
    progress.courseProgress,
    updateProfile,
  ]);

  return null;
}

function ProgressAwareApplication({ courseLoader, onExitCourse, onLessonRoute }) {
  const { tier } = useSubscriptionAccess();
  const {
    status,
    setCurrentLesson,
    markLessonVisited,
  } = useLearningProgress();
  const lessonIndex = canonicalLessonIndex(courseLoader.currentCourse, courseLoader.currentLesson?.id);
  const allowed = canAccessLesson({ tier, lessonIndex });

  useEffect(() => {
    if (allowed && status === 'ready' && courseLoader.currentLesson?.id) {
      setCurrentLesson(courseLoader.currentLesson.id);
      markLessonVisited(courseLoader.currentLesson.id);
    }
  }, [
    courseLoader.currentLesson?.id,
    allowed,
    status,
    markLessonVisited,
    setCurrentLesson,
  ]);

  useEffect(() => {
    if (courseLoader.currentLesson?.id) onLessonRoute(courseLoader.currentLesson.id);
  }, [courseLoader.currentLesson?.id, onLessonRoute]);

  if (!allowed) return <div className="course-premium-gate"><PremiumGate context="lesson" /></div>;
  return <Suspense fallback={<CourseLoadState state="loading" />}>
    <LearningEnginePage courseLoader={courseLoader} onExitCourse={onExitCourse} />
  </Suspense>;
}
