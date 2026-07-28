import { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { CourseLoaderProvider, useCourseLoader } from './course/CourseLoader';
import { CourseLoadState } from './components/CourseLoadState';
import { AuthFlow } from './components/auth/AuthFlow';
import { UserProvider, useUser } from './auth/UserContext';
import { CompilerProvider } from './compiler/CompilerProvider';
import { MockCompilerAdapter } from './compiler/MockCompilerAdapter';
import { Dashboard } from './dashboard/Dashboard';
import {
  LearningProgressProvider,
  useLearningProgress,
} from './progress/LearningProgressContext';

const compilerAdapter = new MockCompilerAdapter();

export default function App() {
  return (
    <CompilerProvider adapter={compilerAdapter}>
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

  if (!activeCourseId) {
    return <Dashboard onOpenCourse={setActiveCourseId} />;
  }

  return (
    <CourseLoaderProvider courseId={activeCourseId} initialLessonId={user.currentLesson}>
      <LoadedCourseApplication onExitCourse={() => setActiveCourseId(null)} />
    </CourseLoaderProvider>
  );
}

function LoadedCourseApplication({ onExitCourse }) {
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
      initialBookmarks={user.bookmarks}
    >
      <ProgressAwareApplication courseLoader={courseLoader} onExitCourse={onExitCourse} />
    </LearningProgressProvider>
  );
}

function ProgressAwareApplication({ courseLoader, onExitCourse }) {
  const { updateProfile } = useUser();
  const {
    status: progressStatus,
    completedLessons,
    bookmarks,
    setCurrentLesson: setProgressCurrentLesson,
  } = useLearningProgress();

  useEffect(() => {
    if (progressStatus === 'ready' && courseLoader.currentLesson?.id) {
      setProgressCurrentLesson(courseLoader.currentLesson.id);
      updateProfile({
        currentLesson: courseLoader.currentLesson.id,
        completedLessons,
        bookmarks,
      });
    }
  }, [
    courseLoader.currentLesson?.id,
    progressStatus,
    completedLessons,
    bookmarks,
    setProgressCurrentLesson,
    updateProfile,
  ]);

  return <Layout courseLoader={courseLoader} onExitCourse={onExitCourse} />;
}
