const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/i;
const PAGE_PATHS = { home: '/', library: '/library', practice: '/practice', challenges: '/challenges', redeem: '/redeem', bookmarks: '/bookmarks', certificates: '/certificates', referrals: '/referrals', wallet: '/wallet', settings: '/settings', projects: '/projects' };
const PUBLIC_PAGE_PATHS = { privacy: '/privacy', terms: '/terms', refund: '/refund-policy', about: '/about', contact: '/contact' };

const decodeId = (value) => {
  try { const decoded = decodeURIComponent(value ?? ''); return SAFE_ID.test(decoded) ? decoded : null; }
  catch { return null; }
};

const isCanonicalDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export function parseAppRoute(pathname = '/') {
  const path = pathname.replace(/\/+$/, '') || '/';
  const publicPage = Object.entries(PUBLIC_PAGE_PATHS).find(([, pagePath]) => pagePath === path);
  if (publicPage) return { kind: 'public-page', pageId: publicPage[0] };
  const page = Object.entries(PAGE_PATHS).find(([, pagePath]) => pagePath === path);
  if (page) return { kind: 'page', page: page[0] };
  let match = path.match(/^\/practice\/([^/]+)$/);
  if (match) { const questionId = decodeId(match[1]); return questionId ? { kind: 'practice-question', page: 'practice', questionId } : { kind: 'not-found' }; }
  match = path.match(/^\/challenges\/daily\/(\d{4}-\d{2}-\d{2})$/);
  if (match) return isCanonicalDate(match[1])
    ? { kind: 'challenge-daily', page: 'challenges', date: match[1] }
    : { kind: 'not-found' };
  match = path.match(/^\/courses\/([^/]+)(?:\/lesson\/([^/]+))?$/);
  if (match) {
    const courseId = decodeId(match[1]); const lessonId = match[2] ? decodeId(match[2]) : null;
    if (!courseId || (match[2] && !lessonId)) return { kind: 'not-found' };
    return { kind: lessonId ? 'course-lesson' : 'course-overview', courseId, lessonId };
  }
  match = path.match(/^\/verify\/([^/]+)$/);
  if (match) { const credentialId = decodeId(match[1]); return credentialId ? { kind: 'certificate-verification', credentialId } : { kind: 'not-found' }; }
  return { kind: 'not-found' };
}

export function routePath(route) {
  if (route.kind === 'public-page') return PUBLIC_PAGE_PATHS[route.pageId] ?? '/';
  if (route.kind === 'certificate-verification') return `/verify/${encodeURIComponent(route.credentialId)}`;
  if (route.kind === 'course-overview') return `/courses/${encodeURIComponent(route.courseId)}`;
  if (route.kind === 'course-lesson') return `/courses/${encodeURIComponent(route.courseId)}/lesson/${encodeURIComponent(route.lessonId)}`;
  if (route.kind === 'practice-question') return `/practice/${encodeURIComponent(route.questionId)}`;
  if (route.kind === 'challenge-daily') return `/challenges/daily/${route.date}`;
  return PAGE_PATHS[route.page] ?? '/';
}

export function routePage(route) {
  if (route.page) return route.page;
  if (route.kind === 'practice-question') return 'practice';
  if (route.kind === 'challenge-daily') return 'challenges';
  return 'home';
}

export function writeAppRoute(route, { replace = false } = {}) {
  const next = routePath(route);
  if (window.location.pathname !== next) window.history[replace ? 'replaceState' : 'pushState']({ mitutora: true }, '', next);
}
