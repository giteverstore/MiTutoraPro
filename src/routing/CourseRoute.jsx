import { useEffect } from 'react';
import { CourseLoaderProvider, useCourseLoader } from '../course/CourseLoader';
import { CourseLoadState } from '../components/CourseLoadState';
import { CourseOverviewPage } from '../pages/CourseOverviewPage';
import { LearningEnginePage } from '../pages/LearningEnginePage';
import { useUser } from '../auth/UserContext';
import {
  LearningProgressProvider,
  useLearningProgress,
} from '../progress/LearningProgressContext';

export function CourseRoute({
  courseId,
  initialLessonId,
  stage,
  onEnterCourse,
  onShowOverview,
  onExitCourse,
  onLessonRoute,
}) {
  return (
    <CourseLoaderProvider
      key={`${courseId}:${initialLessonId ?? 'overview'}`}
      courseId={courseId}
      initialLessonId={initialLessonId}
    >
      <LoadedCourseApplication
        stage={stage}
        onEnterCourse={onEnterCourse}
        onShowOverview={onShowOverview}
        onExitCourse={onExitCourse}
        onLessonRoute={onLessonRoute}
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
}) {
  const courseLoader = useCourseLoader();
  const { user } = useUser();

  if (courseLoader.isLoading) return <CourseLoadState state="loading" />;
  if (courseLoader.status === 'error') {
    return <CourseLoadState state="error" message={courseLoader.error.message} />;
  }

  return (
    <LearningProgressProvider
      course={courseLoader.currentCourse}
      userId={user.id}
      initialLessonId={courseLoader.currentLesson?.id}
      initialCompletedLessons={user.completedLessons}
      initialVisitedLessons={user.visitedLessons}
      initialBookmarks={user.bookmarks}
    >
      <ProgressProfileSync />
      {stage === 'overview' ? (
        <CourseOverviewPage
          course={courseLoader.currentCourse}
          onBack={onExitCourse}
          onEnterCourse={onEnterCourse}
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
  const {
    status,
    setCurrentLesson,
    markLessonVisited,
  } = useLearningProgress();

  useEffect(() => {
    if (status === 'ready' && courseLoader.currentLesson?.id) {
      setCurrentLesson(courseLoader.currentLesson.id);
      markLessonVisited(courseLoader.currentLesson.id);
    }
  }, [
    courseLoader.currentLesson?.id,
    status,
    markLessonVisited,
    setCurrentLesson,
  ]);

  useEffect(() => {
    if (courseLoader.currentLesson?.id) onLessonRoute(courseLoader.currentLesson.id);
  }, [courseLoader.currentLesson?.id, onLessonRoute]);

  return <LearningEnginePage courseLoader={courseLoader} onExitCourse={onExitCourse} />;
}
