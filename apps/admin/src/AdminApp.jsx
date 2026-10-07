import { useCallback, useEffect, useState } from 'react';
import { ADMIN_PERMISSIONS, hasAdminPermission } from '../../../shared/admin/adminAuthorization.js';
import { AdminDashboard, AdminNotFound, AdminPlaceholder } from './AdminDashboard.jsx';
import { AdminLogin } from './AdminLogin.jsx';
import { AdminShell } from './AdminShell.jsx';
import { normalizeAdminPath, resolveAdminRoute } from './adminRoutes.js';
import { ContentStudioEditor } from './content-studio/editor/ContentStudioEditor.jsx';
import { ProjectStudio } from './content-studio/projects/ProjectStudio.jsx';
import { CourseStudio } from './content-studio/courses/CourseStudio.jsx';
import { PracticeStudio } from './content-studio/practice/PracticeStudio.jsx';
import { ChallengeStudio } from './content-studio/challenges/ChallengeStudio.jsx';
import { AssetsPage } from './publishing/AssetsPage.jsx';
import { DraftsPage, PublishedPage, VersionsPage } from './publishing/PublishingPages.jsx';
import { adminContentRequest } from './publishing/publishingApi.js';
import { isPreviewContentDisabled } from './publishing/adminContentError.js';

const needsCloudContent = (path) => /^\/content\/(?:projects|courses|practice|challenges)(?:\/|$)|^\/publishing(?:\/|$)|^\/media\/assets$/.test(path);

function PreviewContentDisabled() {
  return <main className="admin-page"><section className="admin-state-card" role="status"><h1>Preview backend content is disabled.</h1><p>This Preview deployment cannot read or modify production Admin content.</p></section></main>;
}

export function AdminAccessDenied({ session, authClient, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false);
  return <main className="admin-state-page"><section className="admin-state-card"><span className="admin-eyebrow">Access denied</span><h1>This account does not have access to Y Coders Admin.</h1><p>You are signed in as <strong>{session.email || session.uid}</strong>, but no authorized Admin role is present.</p><div className="admin-state-actions"><button className="admin-primary-button" type="button" disabled={refreshing} onClick={async () => { setRefreshing(true); try { await onRefresh(); } finally { setRefreshing(false); } }}>{refreshing ? 'Checking…' : 'Check access again'}</button><button className="admin-secondary-button" type="button" onClick={authClient.signOut}>Sign out</button></div></section></main>;
}

export function AdminApplication({ authClient, initialPath, checkContentAccess = adminContentRequest, enableContentGate = typeof __ADMIN_PREVIEW_DEPLOYMENT__ !== 'undefined' && __ADMIN_PREVIEW_DEPLOYMENT__ }) {
  const [authState, setAuthState] = useState({ status: 'loading', session: null, message: '' });
  const [path, setPath] = useState(() => normalizeAdminPath(initialPath ?? window.location.pathname));
  const [versionSelection, setVersionSelection] = useState(() => new URLSearchParams((initialPath?.split('?')[1] ?? window.location.search.slice(1))).get('contentId') ?? '');
  const [editorDirty, setEditorDirty] = useState(false);
  const [contentAccess, setContentAccess] = useState('unknown');

  useEffect(() => authClient.subscribe(
    (session) => setAuthState({ status: session ? 'authenticated' : 'unauthenticated', session, message: '' }),
    () => setAuthState({ status: 'error', session: null, message: 'Admin authentication could not be verified. Reload and try again.' }),
  ), [authClient]);
  useEffect(() => {
    if (initialPath !== undefined) return undefined;
    const onPopState = () => { setPath(normalizeAdminPath(window.location.pathname)); setVersionSelection(new URLSearchParams(window.location.search).get('contentId') ?? ''); };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [initialPath]);
  useEffect(() => {
    if (!enableContentGate || authState.status !== 'authenticated' || !needsCloudContent(path) || contentAccess !== 'unknown') return undefined;
    let active = true;
    checkContentAccess('draft-summaries?limit=1').then(
      () => { if (active) setContentAccess('available'); },
      (error) => { if (active) setContentAccess(isPreviewContentDisabled(error) ? 'preview-disabled' : 'available'); },
    );
    return () => { active = false; };
  }, [authState.status, checkContentAccess, contentAccess, enableContentGate, path]);

  const navigate = useCallback((nextPath) => {
    const normalized = normalizeAdminPath(nextPath);
    if (editorDirty && normalized !== path && !window.confirm('You have unsaved Content Studio changes. Leave this page?')) return;
    if (normalized === '/publishing/versions') setVersionSelection(new URLSearchParams(nextPath.split('?')[1] ?? '').get('contentId') ?? '');
    if (initialPath === undefined) window.history.pushState({ ycodersAdmin: true }, '', nextPath);
    setPath(normalized);
    requestAnimationFrame(() => document.getElementById('admin-main')?.focus());
  }, [editorDirty, initialPath, path]);

  if (authState.status === 'loading') return <main className="admin-state-page" aria-busy="true"><section className="admin-state-card"><span className="admin-loader" aria-hidden="true" /><h1>Checking Admin access</h1><p>Securely verifying your session and role…</p></section></main>;
  if (authState.status === 'error') return <main className="admin-state-page"><section className="admin-state-card" role="alert"><h1>Authentication unavailable</h1><p>{authState.message}</p><button type="button" onClick={() => window.location.reload()}>Reload</button></section></main>;
  if (authState.status === 'unauthenticated') return <AdminLogin authClient={authClient} />;

  const { session } = authState;
  if (!hasAdminPermission(session.role, ADMIN_PERMISSIONS.ADMIN_ACCESS)) {
    return <AdminAccessDenied session={session} authClient={authClient} onRefresh={async () => { const refreshed = await authClient.refreshClaims(); setAuthState({ status: refreshed ? 'authenticated' : 'unauthenticated', session: refreshed, message: '' }); }} />;
  }
  const route = resolveAdminRoute(path);
  let page = !route ? <AdminNotFound onNavigate={navigate} /> : route.path === '/' ? <AdminDashboard onNavigate={navigate} /> : <AdminPlaceholder route={route} />;
  if (route?.path === '/content/editor') page = <ContentStudioEditor readOnly={!hasAdminPermission(session.role, ADMIN_PERMISSIONS.CONTENT_EDIT)} onDirtyChange={setEditorDirty} />;
  if (route?.path === '/content/projects') page = <ProjectStudio path={path} role={session.role} readOnly={!hasAdminPermission(session.role, ADMIN_PERMISSIONS.CONTENT_EDIT)} onNavigate={navigate} onDirtyChange={setEditorDirty} />;
  if (route?.path === '/content/courses') page = <CourseStudio path={path} role={session.role} readOnly={!hasAdminPermission(session.role, ADMIN_PERMISSIONS.CONTENT_EDIT)} onNavigate={navigate} onDirtyChange={setEditorDirty} />;
  if (route?.path === '/content/practice') page = <PracticeStudio path={path} role={session.role} readOnly={!hasAdminPermission(session.role, ADMIN_PERMISSIONS.CONTENT_EDIT)} onNavigate={navigate} onDirtyChange={setEditorDirty} />;
  if (route?.path === '/content/challenges') page = <ChallengeStudio path={path} role={session.role} readOnly={!hasAdminPermission(session.role, ADMIN_PERMISSIONS.CONTENT_EDIT)} onNavigate={navigate} onDirtyChange={setEditorDirty} />;
  if (route?.path === '/media/assets') page = <AssetsPage role={session.role} />;
  if (route?.path === '/publishing/drafts') page = <DraftsPage role={session.role} onNavigate={navigate} />;
  if (route?.path === '/publishing/published') page = <PublishedPage role={session.role} onNavigate={navigate} />;
  if (route?.path === '/publishing/versions') page = <VersionsPage role={session.role} onNavigate={navigate} selectedContentId={versionSelection} />;
  if (enableContentGate && needsCloudContent(path)) {
    if (contentAccess === 'unknown') page = <main className="admin-page" role="status">Checking content access…</main>;
    if (contentAccess === 'preview-disabled') page = <PreviewContentDisabled />;
  }
  return <AdminShell route={route} session={session} onNavigate={navigate} onSignOut={authClient.signOut}>{page}</AdminShell>;
}
