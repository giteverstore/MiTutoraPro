import { useEffect, useState } from 'react';
import { LearningEnginePage } from './pages/LearningEnginePage';
import { CourseLoaderProvider, useCourseLoader } from './course/CourseLoader';
import { CourseLoadState } from './components/CourseLoadState';
import { AuthFlow } from './components/auth/AuthFlow';
import { UserProvider, useUser } from './auth/UserContext';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/AuthContext';
import { CompilerProvider } from './compiler/CompilerProvider';
import { createCompilerManager } from './compiler/createCompilerManager';
import { HomePage } from './pages/HomePage';
import { CourseOverviewPage } from './pages/CourseOverviewPage';
import { PracticePage } from './pages/PracticePage';
import { ChallengesPage } from './pages/ChallengesPage';
import { BookmarksPage } from './pages/BookmarksPage';
import { CertificatesPage } from './pages/CertificatesPage';
import { ReferralsPage } from './pages/ReferralsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AppShell } from './app-shell/AppShell';
import { BookmarkProvider } from './bookmarks/BookmarkContext';
import {
  LearningProgressProvider,
  useLearningProgress,
} from './progress/LearningProgressContext';

const compilerManager = createCompilerManager();
const APPLICATION_PAGES = {
  practice: PracticePage,
  challenges: ChallengesPage,
  bookmarks: BookmarksPage,
  certificates: CertificatesPage,
  referrals: ReferralsPage,
  settings: SettingsPage,
};

export default function App() {
  return (
    <CompilerProvider manager={compilerManager}>
      <AuthProvider>
        <UserProvider>
          <UserGate />
        </UserProvider>
      </AuthProvider>
    </CompilerProvider>
  );
}

function UserGate() {
  const auth = useAuth();
  const {
    user,
    status,
    isAuthenticated: hasLocalProfile,
    signIn: restoreLocalProfile,
    signOut: clearLocalSession,
    createProfile,
    updateProfile,
  } = useUser();
  const [isSynchronizingProfile, setIsSynchronizingProfile] = useState(false);

  useEffect(() => {
    if (auth.loading || status === 'loading') return;
    let active = true;

    const synchronizeProfile = async () => {
      if (!auth.isAuthenticated) {
        if (hasLocalProfile) await clearLocalSession();
        return;
      }
      if (user?.id === auth.user.id) return;

      setIsSynchronizingProfile(true);
      if (user?.email?.toLowerCase() === auth.user.email.toLowerCase()) {
        updateProfile({
          id: auth.user.id,
          email: auth.user.email,
          name: user.name || auth.user.name,
          avatar: user.avatar || auth.user.avatar,
        });
      } else {
        const restored = await restoreLocalProfile({ email: auth.user.email });
        if (!restored.success) {
          await createProfile({
            id: auth.user.id,
            name: auth.user.name,
            email: auth.user.email,
            avatar: auth.user.avatar,
          });
        }
      }
      if (active) setIsSynchronizingProfile(false);
    };

    synchronizeProfile();
    return () => { active = false; };
  }, [
    auth.isAuthenticated,
    auth.loading,
    auth.user,
    clearLocalSession,
    createProfile,
    hasLocalProfile,
    restoreLocalProfile,
    status,
    updateProfile,
    user,
  ]);

  if (auth.loading || status === 'loading' || isSynchronizingProfile) {
    return <CourseLoadState state="loading" />;
  }

  if (!auth.isAuthenticated) {
    return <AuthFlow />;
  }

  if (!user || user.id !== auth.user.id) return <CourseLoadState state="loading" />;

  return (
    <BookmarkProvider userId={user.id}>
      <AuthenticatedApplication user={user} />
    </BookmarkProvider>
  );
}

function AuthenticatedApplication({ user }) {
  const [activeCourseId, setActiveCourseId] = useState(null);
  const [courseStage, setCourseStage] = useState('overview');
  const [activePage, setActivePage] = useState('home');
  const [navigationTarget, setNavigationTarget] = useState(null);
  const [launchLessonId, setLaunchLessonId] = useState(null);
  const ActivePage = APPLICATION_PAGES[activePage];

  const handlePageNavigation = (page) => {
    setNavigationTarget(null);
    setActivePage(page);
  };

  const openBookmark = (bookmark) => {
    const { target } = bookmark;
    if (target.page === 'course') {
      setLaunchLessonId(target.lessonId);
      setCourseStage('learning');
      setActiveCourseId(target.courseId);
      return;
    }
    setNavigationTarget(target);
    setActivePage(target.page);
  };

  if (!activeCourseId) {
    return (
      <AppShell activePage={activePage} onNavigate={handlePageNavigation}>
        {activePage === 'home' ? (
          <HomePage
            onOpenCourse={(courseId) => {
              setLaunchLessonId(null);
              setActiveCourseId(courseId);
              setCourseStage('overview');
            }}
          />
        ) : activePage === 'practice' ? (
          <PracticePage
            initialQuestionId={navigationTarget?.page === 'practice'
              ? navigationTarget.questionId
              : null}
            key={navigationTarget?.questionId ?? 'practice'}
          />
        ) : activePage === 'bookmarks' ? (
          <BookmarksPage onOpenBookmark={openBookmark} />
        ) : activePage === 'certificates' ? (
          <CertificatesPage
            onContinueCourse={(courseId) => {
              setLaunchLessonId(null);
              setCourseStage('overview');
              setActiveCourseId(courseId);
            }}
          />
        ) : <ActivePage />}
      </AppShell>
    );
  }

  return (
    <CourseLoaderProvider
      courseId={activeCourseId}
      initialLessonId={launchLessonId ?? user.currentLesson}
    >
      <LoadedCourseApplication
        stage={courseStage}
        onEnterCourse={() => setCourseStage('learning')}
        onShowOverview={() => setCourseStage('overview')}
        onExitCourse={() => {
          setLaunchLessonId(null);
          setActiveCourseId(null);
        }}
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

  return <LearningEnginePage courseLoader={courseLoader} onExitCourse={onExitCourse} />;
}
