import { useEffect, useState } from 'react';
import { AuthFlow } from '../components/auth/AuthFlow';
import { LibraryPage } from '../home/LibraryPage';
import { PracticePage } from '../practice/PracticePage';
import { ProjectsPage } from '../projects/pages/ProjectsPage';
import { CourseRoute } from '../routing/CourseRoute';
import { PublicFooter } from './PublicFooter';
import { PublicHeader } from './PublicHeader';
import { LandingPage } from './LandingPage';
import { requestAuthentication } from './publicAuthNavigation';

const privatePaths = new Set(['/challenges', '/bookmarks', '/certificates', '/referrals', '/wallet', '/redeem', '/settings']);
const cleanPath = () => window.location.pathname.replace(/\/+$/, '') || '/';

function PublicFeatureShell({ children, activePath }) {
  return <div className="public-browse-page" data-brand-theme="blue" data-theme="light"><PublicHeader activePath={activePath} /><main className="public-feature-content">{children}</main><PublicFooter /></div>;
}

function ProtectedAuthRoute({ pathname }) {
  useEffect(() => { sessionStorage.setItem('ycoders:auth-return', pathname); }, [pathname]);
  return <AuthFlow />;
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
  if (pathname === '/login') return <AuthFlow initialScreen="sign-in" />;
  if (pathname === '/signup') return <AuthFlow initialScreen="sign-up" />;
  if (pathname === '/library') return <PublicFeatureShell activePath="/library"><LibraryPage anonymous onRequireAuth={requireAuth} onOpenCourse={(courseId) => navigate(`/courses/${courseId}`)} /></PublicFeatureShell>;
  if (pathname === '/practice') return <PublicFeatureShell activePath="/practice"><PracticePage anonymous onRequireAuth={requireAuth} onQuestionChange={(questionId) => navigate(questionId ? `/practice/${questionId}` : '/practice')} /></PublicFeatureShell>;
  if (pathname === '/projects') return <PublicFeatureShell activePath="/projects"><ProjectsPage browseOnly onRequireAuth={requireAuth} onProjectChange={(projectId) => navigate(projectId ? `/projects/${projectId}` : '/projects')} /></PublicFeatureShell>;

  const course = pathname.match(/^\/courses\/([^/]+)$/);
  if (course) return <PublicFeatureShell activePath="/library"><CourseRoute courseId={decodeURIComponent(course[1])} stage="overview" anonymous onExitCourse={() => navigate('/library')} onEnterCourse={() => requireAuth(pathname)} /></PublicFeatureShell>;
  const question = pathname.match(/^\/practice\/([^/]+)$/);
  if (question) return <PublicFeatureShell activePath="/practice"><PracticePage anonymous initialQuestionId={decodeURIComponent(question[1])} onRequireAuth={requireAuth} onQuestionChange={(questionId) => navigate(questionId ? `/practice/${questionId}` : '/practice')} /></PublicFeatureShell>;
  const project = pathname.match(/^\/projects\/([^/]+)$/);
  if (project) return <PublicFeatureShell activePath="/projects"><ProjectsPage browseOnly initialProjectId={decodeURIComponent(project[1])} onRequireAuth={requireAuth} onProjectChange={(projectId) => navigate(projectId ? `/projects/${projectId}` : '/projects')} /></PublicFeatureShell>;
  if (privatePaths.has(pathname) || pathname.startsWith('/challenges/')) return <ProtectedAuthRoute pathname={pathname} />;
  return <PublicNotFound />;
}
