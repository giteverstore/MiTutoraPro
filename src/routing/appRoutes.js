const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/i;
const PAGE_PATHS = { home: '/', practice: '/practice', challenges: '/challenges', bookmarks: '/bookmarks', certificates: '/certificates', referrals: '/referrals', settings: '/settings', projects: '/projects' };

const decodeId = (value) => {
  try { const decoded = decodeURIComponent(value ?? ''); return SAFE_ID.test(decoded) ? decoded : null; }
  catch { return null; }
};

export function parseAppRoute(pathname = '/') {
  const path = pathname.replace(/\/+$/, '') || '/';
  const page = Object.entries(PAGE_PATHS).find(([, pagePath]) => pagePath === path);
  if (page) return { kind: 'page', page: page[0] };
  let match = path.match(/^\/practice\/([^/]+)$/);
  if (match) { const questionId = decodeId(match[1]); return questionId ? { kind: 'practice-question', page: 'practice', questionId } : { kind: 'not-found' }; }
  match = path.match(/^\/courses\/([^/]+)(?:\/lesson\/([^/]+))?$/);
  if (match) {
    const courseId = decodeId(match[1]); const lessonId = match[2] ? decodeId(match[2]) : null;
    if (!courseId || (match[2] && !lessonId)) return { kind: 'not-found' };
    return { kind: lessonId ? 'course-lesson' : 'course-overview', courseId, lessonId };
  }
  return { kind: 'not-found' };
}

export function routePath(route) {
  if (route.kind === 'course-overview') return `/courses/${encodeURIComponent(route.courseId)}`;
  if (route.kind === 'course-lesson') return `/courses/${encodeURIComponent(route.courseId)}/lesson/${encodeURIComponent(route.lessonId)}`;
  if (route.kind === 'practice-question') return `/practice/${encodeURIComponent(route.questionId)}`;
  return PAGE_PATHS[route.page] ?? '/';
}

export function routePage(route) {
  if (route.page) return route.page;
  if (route.kind === 'practice-question') return 'practice';
  return 'home';
}

export function writeAppRoute(route, { replace = false } = {}) {
  const next = routePath(route);
  if (window.location.pathname !== next) window.history[replace ? 'replaceState' : 'pushState']({ mitutora: true }, '', next);
}
