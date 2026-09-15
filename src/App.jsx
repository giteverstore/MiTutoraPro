import { Suspense, useEffect, useState } from 'react';
import { CourseLoadState } from './components/CourseLoadState';
import { UserProvider, useUser } from './auth/UserContext';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/AuthContext';
import { CompilerProvider } from './compiler/CompilerProvider';
import { createCompilerManager } from './compiler/createCompilerManager';
import { UserDataLifecycle } from './user-data/UserDataLifecycle';
import { DomainErrorBoundary } from './errors/ErrorBoundary';
import { parseAppRoute, routePage, writeAppRoute } from './routing/appRoutes';
import { lazyNamedExport } from './routing/lazyRoute';
import { SubscriptionAccessProvider, useSubscriptionAccess } from './access/SubscriptionAccessContext';
import { PremiumFeatureGate } from './access/PremiumFeatureGate';
import { ACCESS_FEATURES, canAccessFeature } from './access/accessPolicy';
import { recentCourseRepository } from './home/recentCourseRepository';
import { LearnerActivityProvider } from './activity/LearnerActivityContext';
import { shouldShowApplicationFooter } from './app-shell/footerPolicy';

const AuthFlow = lazyNamedExport(() => import('./components/auth/AuthFlow'), 'AuthFlow');
const AppShell = lazyNamedExport(() => import('./app-shell/AppShell'), 'AppShell');
const BookmarkProvider = lazyNamedExport(() => import('./bookmarks/BookmarkContext'), 'BookmarkProvider');
const HomePage = lazyNamedExport(() => import('./pages/HomePage'), 'HomePage');
const LibraryPage = lazyNamedExport(() => import('./pages/LibraryPage'), 'LibraryPage');
const PracticePage = lazyNamedExport(() => import('./pages/PracticePage'), 'PracticePage');
const ChallengesPage = lazyNamedExport(() => import('./pages/ChallengesPage'), 'ChallengesPage');
const BookmarksPage = lazyNamedExport(() => import('./pages/BookmarksPage'), 'BookmarksPage');
const CertificatesPage = lazyNamedExport(() => import('./pages/CertificatesPage'), 'CertificatesPage');
const ReferralsPage = lazyNamedExport(() => import('./pages/ReferralsPage'), 'ReferralsPage');
const WalletPage = lazyNamedExport(() => import('./pages/WalletPage'), 'WalletPage');
const RedeemPage = lazyNamedExport(() => import('./coins/RedeemPage'), 'RedeemPage');
const SettingsPage = lazyNamedExport(() => import('./pages/SettingsPage'), 'SettingsPage');
const ProjectsPage = lazyNamedExport(() => import('./pages/ProjectsPage'), 'ProjectsPage');
const ExamExperience = lazyNamedExport(() => import('./exam/pages/ExamExperience'), 'ExamExperience');
const SetupVerificationExperience = lazyNamedExport(
  () => import('./exam/pages/SetupVerificationExperience'),
  'SetupVerificationExperience',
);
const CourseRoute = lazyNamedExport(() => import('./routing/CourseRoute'), 'CourseRoute');
const PublicCertificateVerificationPage = lazyNamedExport(() => import('./certificates/PublicCertificateVerificationPage'), 'PublicCertificateVerificationPage');
const PublicPage = lazyNamedExport(() => import('./public/PublicPages'), 'PublicPage');

const compilerManager = createCompilerManager();
const APPLICATION_PAGES = {
  practice: PracticePage,
  challenges: ChallengesPage,
  bookmarks: BookmarksPage,
  certificates: CertificatesPage,
  referrals: ReferralsPage,
  wallet: WalletPage,
  redeem: RedeemPage,
  settings: SettingsPage,
  projects: ProjectsPage,
};

export default function App() {
  const publicRoute = parseAppRoute(window.location.pathname);
  if (publicRoute.kind === 'certificate-verification') {
    return <Suspense fallback={<CourseLoadState state="loading" />}><PublicCertificateVerificationPage credentialId={publicRoute.credentialId} /></Suspense>;
  }
  if (publicRoute.kind === 'public-page') {
    return <Suspense fallback={<CourseLoadState state="loading" />}><PublicPage pageId={publicRoute.pageId} /></Suspense>;
  }
  return (
    <CompilerProvider manager={compilerManager}>
      <AuthProvider>
        <UserDataLifecycle />
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
    return <Suspense fallback={<CourseLoadState state="loading" />}><AuthFlow /></Suspense>;
  }

  if (!user || user.id !== auth.user.id) return <CourseLoadState state="loading" />;

  return <>
    <Suspense fallback={<CourseLoadState state="loading" />}>
      <BookmarkProvider userId={user.id}>
        <SubscriptionAccessProvider userId={user.id}>
          <LearnerActivityProvider>
            <AuthenticatedApplication user={user} />
          </LearnerActivityProvider>
        </SubscriptionAccessProvider>
      </BookmarkProvider>
    </Suspense>
    {auth.referralNotice ? <div className="settings-toast" role="status">{auth.referralNotice}<button type="button" onClick={auth.clearReferralNotice} aria-label="Dismiss referral notification">×</button></div> : null}
  </>;
}

function AuthenticatedApplication({ user }) {
  const { tier } = useSubscriptionAccess();
  const [initialRoute] = useState(() => parseAppRoute(window.location.pathname));
  const [activeCourseId, setActiveCourseId] = useState(() => initialRoute.courseId ?? null);
  const [courseStage, setCourseStage] = useState(() => initialRoute.kind === 'course-lesson' ? 'learning' : 'overview');
  const [activePage, setActivePage] = useState(() => initialRoute.page ?? 'home');
  const [navigationTarget, setNavigationTarget] = useState(() => initialRoute.questionId
    ? { page: 'practice', questionId: initialRoute.questionId }
    : initialRoute.date ? { page: 'challenges', date: initialRoute.date } : null);
  const [launchLessonId, setLaunchLessonId] = useState(() => initialRoute.lessonId ?? null);
  const [routeNotFound, setRouteNotFound] = useState(() => initialRoute.kind === 'not-found');
  const [examOpen, setExamOpen] = useState(false);
  const [setupVerificationOpen, setSetupVerificationOpen] = useState(false);
  const ActivePage = APPLICATION_PAGES[activePage];

  const applyRoute = (route) => {
    setRouteNotFound(route.kind === 'not-found');
    setActiveCourseId(route.courseId ?? null);
    setCourseStage(route.kind === 'course-lesson' ? 'learning' : 'overview');
    setLaunchLessonId(route.lessonId ?? null);
    setActivePage(routePage(route));
    setNavigationTarget(route.questionId ? { page: 'practice', questionId: route.questionId }
      : route.date ? { page: 'challenges', date: route.date } : null);
  };

  const navigateTo = (route, options) => { writeAppRoute(route, options); applyRoute(route); };

  useEffect(() => {
    const handlePopState = () => applyRoute(parseAppRoute(window.location.pathname));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (activeCourseId && courseStage === 'overview') recentCourseRepository.record(user.id, activeCourseId);
  }, [activeCourseId, courseStage, user.id]);

  const handlePageNavigation = (page) => {
    setNavigationTarget(null);
    setActivePage(page);
    setActiveCourseId(null);
    setRouteNotFound(false);
    writeAppRoute({ kind: 'page', page });
  };

  const openBookmark = (bookmark) => {
    const { target } = bookmark;
    if (target.page === 'course') {
      setLaunchLessonId(target.lessonId);
      setCourseStage('learning');
      setActiveCourseId(target.courseId);
      writeAppRoute({ kind: 'course-lesson', courseId: target.courseId, lessonId: target.lessonId });
      return;
    }
    setNavigationTarget(target);
    setActivePage(target.page);
    writeAppRoute(target.questionId ? { kind: 'practice-question', questionId: target.questionId } : { kind: 'page', page: target.page });
  };

  const openCourseOverview = (courseId) => {
    recentCourseRepository.record(user.id, courseId);
    setLaunchLessonId(null);
    setActiveCourseId(courseId);
    setCourseStage('overview');
    writeAppRoute({ kind: 'course-overview', courseId });
  };

  const continueCourse = (courseId, lessonId) => {
    recentCourseRepository.record(user.id, courseId);
    setLaunchLessonId(lessonId ?? null);
    setActiveCourseId(courseId);
    setCourseStage('learning');
    writeAppRoute(lessonId
      ? { kind: 'course-lesson', courseId, lessonId }
      : { kind: 'course-overview', courseId });
  };

  const openCertificationExam = () => {
    setLaunchLessonId(null);
    setActiveCourseId(null);
    setActivePage('certificates');
    setNavigationTarget(null);
    writeAppRoute({ kind: 'page', page: 'certificates' });
    setExamOpen(true);
  };

  if (examOpen && canAccessFeature({ tier, feature: ACCESS_FEATURES.CERTIFICATES })) {
    return (
      <DomainErrorBoundary
        name="certification-exam"
        title="The certification exam could not continue."
        description="Your other learning data is unaffected. Return to Certificates, then retry when you are ready."
        onLeave={() => setExamOpen(false)}
      >
        <Suspense fallback={<CourseLoadState state="loading" />}>
          <ExamExperience candidateId={user.id} onExit={() => setExamOpen(false)} onViewCertificate={(credentialId) => {
            if (credentialId) window.history.replaceState({ mitutora: true }, '', `/certificates?credential=${encodeURIComponent(credentialId)}`);
            setExamOpen(false);
          }} />
        </Suspense>
      </DomainErrorBoundary>
    );
  }

  if (setupVerificationOpen && canAccessFeature({ tier, feature: ACCESS_FEATURES.CERTIFICATES })) {
    return (
      <DomainErrorBoundary
        name="setup-verification"
        title="Setup verification could not continue."
        description="Close this check and retry without affecting your certification records."
        onLeave={() => setSetupVerificationOpen(false)}
      >
        <Suspense fallback={<CourseLoadState state="loading" />}>
          <SetupVerificationExperience onExit={() => setSetupVerificationOpen(false)} />
        </Suspense>
      </DomainErrorBoundary>
    );
  }

  if (!activeCourseId) {
    const showFooter = shouldShowApplicationFooter({ activeCourseId, activePage, navigationTarget });
    return (
      <AppShell activePage={activePage} onNavigate={handlePageNavigation} showFooter={showFooter}>
        <DomainErrorBoundary
          name={activePage}
          title={`${activePage === 'practice' ? 'Practice' : 'This page'} could not be displayed.`}
          description="Navigation and the rest of ycoders are still available. Try loading this page again."
          resetKeys={[activePage, navigationTarget?.questionId, navigationTarget?.date]}
        >
        <Suspense fallback={<CourseLoadState state="loading" />}>
        {routeNotFound ? (
          <section className="route-not-found" role="status"><h1>Page not found</h1><p>This link is invalid or no longer available.</p><button className="button button--primary" type="button" onClick={() => navigateTo({ kind: 'page', page: 'home' }, { replace: true })}>Return home</button></section>
        ) : activePage === 'home' ? (
          <HomePage
            onOpenCourse={openCourseOverview}
            onContinueCourse={continueCourse}
            onBrowseLibrary={() => handlePageNavigation('library')}
            onOpenChallenges={(date) => navigateTo(date
              ? { kind: 'challenge-daily', page: 'challenges', date }
              : { kind: 'page', page: 'challenges' })}
            onRedeem={() => handlePageNavigation('redeem')}
          />
        ) : activePage === 'library' ? (
          <LibraryPage onOpenCourse={openCourseOverview} />
        ) : activePage === 'practice' ? (
          <PracticePage
            initialQuestionId={navigationTarget?.page === 'practice'
              ? navigationTarget.questionId
              : null}
            key={navigationTarget?.questionId ?? 'practice'}
            onQuestionChange={(questionId) => navigateTo(questionId
              ? { kind: 'practice-question', page: 'practice', questionId }
              : { kind: 'page', page: 'practice' })}
          />
        ) : activePage === 'challenges' ? (
          <ChallengesPage
            occurrenceDate={navigationTarget?.page === 'challenges' ? navigationTarget.date : null}
            onOpenChallenge={(date) => navigateTo({ kind: 'challenge-daily', page: 'challenges', date })}
            onBack={() => navigateTo({ kind: 'page', page: 'challenges' })}
          />
        ) : activePage === 'bookmarks' ? (
          <BookmarksPage onOpenBookmark={openBookmark} />
        ) : activePage === 'certificates' ? (
          <PremiumFeatureGate feature={ACCESS_FEATURES.CERTIFICATES} context="Certificates"><CertificatesPage
            onStartExam={() => setExamOpen(true)}
            onTestSetup={() => setSetupVerificationOpen(true)}
            onContinueCourse={(courseId) => {
              setLaunchLessonId(null);
              setCourseStage('overview');
              setActiveCourseId(courseId);
              writeAppRoute({ kind: 'course-overview', courseId });
            }}
          /></PremiumFeatureGate>
        ) : activePage === 'projects' ? (
          <PremiumFeatureGate feature={ACCESS_FEATURES.PROJECTS} context="Projects"><ProjectsPage /></PremiumFeatureGate>
        ) : <ActivePage />}
        </Suspense>
        </DomainErrorBoundary>
      </AppShell>
    );
  }

  const courseApplication = (
    <DomainErrorBoundary
      name="learning"
      title="The course workspace could not be displayed."
      description="Your saved progress is unaffected. Return to the course list or try loading the workspace again."
      onLeave={() => {
        setLaunchLessonId(null);
        setActiveCourseId(null);
      }}
      resetKeys={[activeCourseId, courseStage]}
    >
      <Suspense fallback={<CourseLoadState state="loading" />}>
      <CourseRoute
        key={`${activeCourseId}:${launchLessonId ?? 'overview'}`}
        courseId={activeCourseId}
        initialLessonId={launchLessonId}
        stage={courseStage}
        onEnterCourse={() => { setCourseStage('learning'); const lessonId = launchLessonId ?? undefined; if (lessonId) writeAppRoute({ kind: 'course-lesson', courseId: activeCourseId, lessonId }); }}
        onShowOverview={() => { setCourseStage('overview'); writeAppRoute({ kind: 'course-overview', courseId: activeCourseId }); }}
        onExitCourse={() => {
          setLaunchLessonId(null);
          setActiveCourseId(null);
          writeAppRoute({ kind: 'page', page: 'home' });
        }}
        onLessonRoute={(lessonId) => writeAppRoute({ kind: 'course-lesson', courseId: activeCourseId, lessonId })}
        onStartExam={activeCourseId === 'python' ? openCertificationExam : undefined}
      />
      </Suspense>
    </DomainErrorBoundary>
  );

  return courseStage === 'overview' ? (
    <AppShell activePage={activePage} onNavigate={handlePageNavigation} pageLabel="Course Overview" showFooter={false}>
      {courseApplication}
    </AppShell>
  ) : courseApplication;
}
