import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { CourseLoaderProvider, useCourseLoader } from './course/CourseLoader';
import { CourseLoadState } from './components/CourseLoadState';
import { AuthFlow } from './components/auth/AuthFlow';
import { UserProvider, useUser } from './auth/UserContext';
import { CompilerProvider } from './compiler/CompilerProvider';
import { createCompilerManager } from './compiler/createCompilerManager';
import { Dashboard } from './dashboard/Dashboard';
import { CourseOverview } from './course-overview/CourseOverview';
import {
  LearningProgressProvider,
  useLearningProgress,
} from './progress/LearningProgressContext';

const compilerManager = createCompilerManager();

export default function App() {
  return (
    <CompilerProvider manager={compilerManager}>
      <UserProvider>
        <UserGate />
      </UserProvider>
    </CompilerProvider>
  );
}

function UserGate() {
  const { user, status, isAuthenticated } = useUser();

  if (status === 'loading') {
    return <CourseLoadState state="loading" />;
  }

  if (!isAuthenticated) {
    return <AuthFlow />;
  }

  return <AuthenticatedApplication user={user} />;
}

function AuthenticatedApplication({ user }) {
  const [activeCourseId, setActiveCourseId] = useState(null);
  const [courseStage, setCourseStage] = useState('overview');

  if (!activeCourseId) {
    return (
      <Dashboard
        onOpenCourse={(courseId) => {
          setActiveCourseId(courseId);
          setCourseStage('overview');
        }}
      />
    );
  }

  return (
    <CourseLoaderProvider courseId={activeCourseId} initialLessonId={user.currentLesson}>
      <LoadedCourseApplication
        stage={courseStage}
        onEnterCourse={() => setCourseStage('learning')}
        onShowOverview={() => setCourseStage('overview')}
        onExitCourse={() => setActiveCourseId(null)}
      />
    </CourseLoaderProvider>
  );
}

function LoadedCourseApplication({
  stage,
  onEnterCourse,
  onShowOverview,
  onExitCourse,
}) {
  const courseLoader = useCourseLoader();
  const { user } = useUser();

  if (courseLoader.isLoading) {
    return <CourseLoadState state="loading" />;
  }

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
      <ProgressProfileSync courseLoader={courseLoader} />
      {stage === 'overview' ? (
        <CourseOverview
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
        />
      )}
    </LearningProgressProvider>
  );
}

function ProgressProfileSync({ courseLoader }) {
  const { updateProfile } = useUser();
  const {
    status: progressStatus,
    currentLesson,
    completedLessons,
    visitedLessons,
    bookmarks,
    sequentialCompletedLessons,
    courseProgress,
  } = useLearningProgress();

  useEffect(() => {
    if (progressStatus === 'ready') {
      updateProfile({
        currentLesson,
        completedLessons,
        visitedLessons,
        bookmarks,
        sequentialCompletedLessons,
        courseProgress,
      });
    }
  }, [
    progressStatus,
    currentLesson,
    completedLessons,
    visitedLessons,
    bookmarks,
    sequentialCompletedLessons,
    courseProgress,
    updateProfile,
  ]);

  return null;
}

function ProgressAwareApplication({ courseLoader, onExitCourse }) {
  const {
    status: progressStatus,
    setCurrentLesson: setProgressCurrentLesson,
    markLessonVisited,
  } = useLearningProgress();

  useEffect(() => {
    if (progressStatus === 'ready' && courseLoader.currentLesson?.id) {
      setProgressCurrentLesson(courseLoader.currentLesson.id);
      markLessonVisited(courseLoader.currentLesson.id);
    }
  }, [
    courseLoader.currentLesson?.id,
    progressStatus,
    markLessonVisited,
    setProgressCurrentLesson,
  ]);

  return <Layout courseLoader={courseLoader} onExitCourse={onExitCourse} />;
}
