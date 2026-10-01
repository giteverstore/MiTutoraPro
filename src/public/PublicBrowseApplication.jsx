import { Suspense, useEffect, useState } from 'react';
import { CourseLoadState } from '../components/CourseLoadState';
import { lazyNamedExport } from '../routing/lazyRoute';
import { PublicFooter } from './PublicFooter';
import { PublicHeader } from './PublicHeader';
import { LandingPage } from './LandingPage';
import { requestAuthentication } from './publicAuthNavigation';
import '../styles/public-pages.css';

const AuthFlow = lazyNamedExport(() => import('../components/auth/AuthFlow'), 'AuthFlow');
const LibraryPage = lazyNamedExport(() => import('../pages/LibraryPage'), 'LibraryPage');
const PracticePage = lazyNamedExport(() => import('../pages/PracticePage'), 'PracticePage');
const ProjectsPage = lazyNamedExport(() => import('../pages/ProjectsPage'), 'ProjectsPage');
const CourseRoute = lazyNamedExport(() => import('../routing/CourseRoute'), 'CourseRoute');

const privatePaths = new Set(['/challenges', '/bookmarks', '/certificates', '/referrals', '/wallet', '/redeem', '/settings']);
const cleanPath = () => window.location.pathname.replace(/\/+$/, '') || '/';

function PublicFeatureShell({ children, activePath }) {
  return <div className="public-browse-page" data-brand-theme="blue" data-theme="light"><PublicHeader activePath={activePath} /><main className="public-feature-content">{children}</main><PublicFooter /></div>;
}

function ProtectedAuthRoute({ pathname }) {
  useEffect(() => { sessionStorage.setItem('ycoders:auth-return', pathname); }, [pathname]);
  return <Suspense fallback={<CourseLoadState state="loading" />}><AuthFlow /></Suspense>;
}

function PublicNotFound() {
  return <PublicFeatureShell><section className="public-not-found"><h1>Page not found</h1><p>This public page is unavailable.</p><a className="button button--primary" href="/">Return home</a></section></PublicFeatureShell>;
}

export function PublicBrowseApplication() {
  const [pathname, setPathname] = useState(cleanPath);
  useEffect(() => { const update = () => setPathname(cleanPath()); window.addEventListener('popstate', update); return () => window.removeEventListener('popstate', update); }, []);
  const navigate = (next) => { window.history.pushState({ ycoders: true }, '', next); setPathname(next); };
  const requireAuth = (destination) => requestAuthentication(destination, 'login');

  if (pathname === '/') return <LandingPage />;
  const loading = <CourseLoadState state="loading" />;
  if (pathname === '/login') return <Suspense fallback={loading}><AuthFlow initialScreen="sign-in" /></Suspense>;
  if (pathname === '/signup') return <Suspense fallback={loading}><AuthFlow initialScreen="sign-up" /></Suspense>;
  if (pathname === '/library') return <PublicFeatureShell activePath="/library"><Suspense fallback={loading}><LibraryPage anonymous onRequireAuth={requireAuth} onOpenCourse={(courseId) => navigate(`/courses/${courseId}`)} /></Suspense></PublicFeatureShell>;
  if (pathname === '/practice') return <PublicFeatureShell activePath="/practice"><Suspense fallback={loading}><PracticePage anonymous onRequireAuth={requireAuth} onQuestionChange={(questionId) => navigate(questionId ? `/practice/${questionId}` : '/practice')} /></Suspense></PublicFeatureShell>;
  if (pathname === '/projects') return <PublicFeatureShell activePath="/projects"><Suspense fallback={loading}><ProjectsPage browseOnly onRequireAuth={requireAuth} onProjectChange={(projectId) => navigate(projectId ? `/projects/${projectId}` : '/projects')} /></Suspense></PublicFeatureShell>;

  const course = pathname.match(/^\/courses\/([^/]+)$/);
  if (course) return <PublicFeatureShell activePath="/library"><Suspense fallback={loading}><CourseRoute courseId={decodeURIComponent(course[1])} stage="overview" anonymous onExitCourse={() => navigate('/library')} onEnterCourse={() => requireAuth(pathname)} /></Suspense></PublicFeatureShell>;
  const question = pathname.match(/^\/practice\/([^/]+)$/);
  if (question) return <PublicFeatureShell activePath="/practice"><Suspense fallback={loading}><PracticePage anonymous initialQuestionId={decodeURIComponent(question[1])} onRequireAuth={requireAuth} onQuestionChange={(questionId) => navigate(questionId ? `/practice/${questionId}` : '/practice')} /></Suspense></PublicFeatureShell>;
  const project = pathname.match(/^\/projects\/([^/]+)$/);
  if (project) return <PublicFeatureShell activePath="/projects"><Suspense fallback={loading}><ProjectsPage browseOnly initialProjectId={decodeURIComponent(project[1])} onRequireAuth={requireAuth} onProjectChange={(projectId) => navigate(projectId ? `/projects/${projectId}` : '/projects')} /></Suspense></PublicFeatureShell>;
  if (privatePaths.has(pathname) || pathname.startsWith('/challenges/')) return <ProtectedAuthRoute pathname={pathname} />;
  return <PublicNotFound />;
}
