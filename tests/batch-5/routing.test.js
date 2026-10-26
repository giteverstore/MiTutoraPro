import { describe, expect, it, vi } from 'vitest';
import { parseAppRoute, routePage, routePath, resetApplicationPageScroll, writeAppRoute } from '../../src/routing/appRoutes';
import { ADMIN_PUBLIC_CONTENT_LIST_ROUTE, ADMIN_PUBLIC_CONTENT_DETAIL_ROUTE, COMPILER_ISOLATION_ROUTE, HASHED_ASSET_CACHE_ROUTE, JAVASCRIPT_LEARNER_WORKER_ROUTE, PRIVATE_API_CACHE_ROUTE, createVercelConfig } from '../../vercel.mjs';
import { API_SECURITY_ROUTE, DOCUMENT_SECURITY_ROUTE } from '../../config/securityHeaderPolicy.mjs';

const pageRoutes = [
  ['/', 'home'],
  ['/library', 'library'],
  ['/practice', 'practice'],
  ['/challenges', 'challenges'],
  ['/redeem', 'redeem'],
  ['/bookmarks', 'bookmarks'],
  ['/certificates', 'certificates'],
  ['/referrals', 'referrals'],
  ['/wallet', 'wallet'],
  ['/settings', 'settings'],
  ['/projects', 'projects'],
];

describe('application URL adapter', () => {
  it.each([
    ['/privacy', 'privacy'],
    ['/terms', 'terms'],
    ['/refund-policy', 'refund'],
    ['/about', 'about'],
    ['/contact', 'contact'],
  ])('parses the signed-out public route %s', (path, pageId) => {
    const route = { kind: 'public-page', pageId };
    expect(parseAppRoute(path)).toEqual(route);
    expect(routePath(route)).toBe(path);
  });

  it.each(pageRoutes)('parses the AppShell route %s', (path, page) => {
    expect(parseAppRoute(path)).toEqual({ kind: 'page', page });
  });

  it.each([
    ['/practice/fund-variables-001', { kind: 'practice-question', page: 'practice', questionId: 'fund-variables-001' }],
    ['/challenges/daily/2026-09-13', { kind: 'challenge-daily', page: 'challenges', date: '2026-09-13' }],
    ['/courses/python', { kind: 'course-overview', courseId: 'python', lessonId: null }],
    ['/courses/python/lesson/lesson-1-1-introduction-to-python', { kind: 'course-lesson', courseId: 'python', lessonId: 'lesson-1-1-introduction-to-python' }],
    ['/courses/java', { kind: 'course-overview', courseId: 'java', lessonId: null }],
    ['/courses/java/lesson/java-lesson-1-1-1-getting-started-with-java', { kind: 'course-lesson', courseId: 'java', lessonId: 'java-lesson-1-1-1-getting-started-with-java' }],
  ])('parses the resource route %s', (path, expected) => {
    expect(parseAppRoute(path)).toEqual(expected);
  });

  it('rejects malformed and path-traversal identifiers', () => {
    expect(parseAppRoute('/courses/%2e%2e/lesson/x').kind).toBe('not-found');
    expect(parseAppRoute('/practice/a%2Fb').kind).toBe('not-found');
    expect(parseAppRoute('/challenges/daily/2026-02-30').kind).toBe('not-found');
    expect(parseAppRoute('/unknown').kind).toBe('not-found');
    expect(parseAppRoute('/exam').kind).toBe('not-found');
    expect(parseAppRoute('/setup').kind).toBe('not-found');
    expect(parseAppRoute('/login').kind).toBe('not-found');
  });

  it('round trips stable resource identifiers only', () => {
    const route = { kind: 'course-lesson', courseId: 'java', lessonId: 'java-basics-1' };
    expect(parseAppRoute(routePath(route))).toMatchObject(route);
    expect(routePath(route)).not.toMatch(/token|credential|evidence/i);
  });

  it('keeps resource routes in their owning AppShell page', () => {
    expect(routePage({ kind: 'practice-question', questionId: 'fund-variables-001' })).toBe('practice');
    expect(routePage({ kind: 'challenge-daily', date: '2026-09-13' })).toBe('challenges');
    expect(routePage({ kind: 'page', page: 'settings' })).toBe('settings');
  });

  it('resets only the AppShell page on a push route, leaving internal scroll regions alone', () => {
    const original = window.location.pathname;
    window.history.replaceState({}, '', '/');
    const page = document.createElement('main');
    page.id = 'application-page';
    page.scrollTop = 180;
    const editor = document.createElement('div');
    editor.scrollTop = 90;
    page.append(editor);
    document.body.append(page);
    const scrollTo = vi.fn(({ top }) => { page.scrollTop = top; });
    page.scrollTo = scrollTo;
    try {
      writeAppRoute({ kind: 'page', page: 'library' });
      expect(page.scrollTop).toBe(0);
      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
      expect(editor.scrollTop).toBe(90);
      page.scrollTop = 175;
      writeAppRoute({ kind: 'page', page: 'library' });
      expect(page.scrollTop).toBe(175);
      writeAppRoute({ kind: 'page', page: 'home' }, { replace: true });
      expect(page.scrollTop).toBe(175);
      resetApplicationPageScroll();
      expect(page.scrollTop).toBe(0);
    } finally {
      page.remove();
      window.history.replaceState({}, '', original);
    }
  });

  it('uses the window scroll only when no AppShell page exists', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    try {
      resetApplicationPageScroll();
      expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'instant' });
    } finally {
      scrollTo.mockRestore();
    }
  });
});

describe('Vercel SPA routing contract', () => {
  const config = createVercelConfig('main');

  it('falls back unresolved direct requests to the Vite SPA entry point', () => {
    expect(config.routes).toEqual([
      DOCUMENT_SECURITY_ROUTE,
      API_SECURITY_ROUTE,
      HASHED_ASSET_CACHE_ROUTE,
      PRIVATE_API_CACHE_ROUTE,
      COMPILER_ISOLATION_ROUTE,
      JAVASCRIPT_LEARNER_WORKER_ROUTE,
      ADMIN_PUBLIC_CONTENT_LIST_ROUTE,
      ADMIN_PUBLIC_CONTENT_DETAIL_ROUTE,
      { src: '/api/compiler(?:/(.*))?', dest: '/api/compiler?path=$1' },
      { handle: 'filesystem' },
      { src: '/((?!api(?:/|$)|assets(?:/|$)|vendor(?:/|$)|src(?:/|$)|node_modules(?:/|$)|@[^/]+(?:/|$))[^.]*)', dest: '/index.html' },
    ]);
  });

  it('uses filesystem-aware rewrites without legacy route or build overrides', () => {
    expect(config.routes.find((route) => route.handle === 'filesystem')).toEqual({ handle: 'filesystem' });
    expect(config.rewrites).toBeUndefined();
    expect(config.builds).toBeUndefined();
    expect(config.cleanUrls).toBeUndefined();
    expect(config.trailingSlash).toBeUndefined();
  });

  const destinationFor = (request, method = 'GET') => {
    const url = new URL(request, 'https://www.ycoders.com');
    for (const route of config.routes) {
      if (route.continue || !route.dest || (route.methods && !route.methods.includes(method))) continue;
      const match = url.pathname.match(new RegExp(`^(?:${route.src})$`));
      if (match) return route.dest.replace(/\$(\d+)/g, (_, index) => match[Number(index)] ?? '') + url.search;
    }
    return null;
  };

  it('routes the Course catalog list without an extra slash and preserves its query', () => {
    expect(destinationFor('/api/admin-content/public?contentType=COURSE'))
      .toBe('https://ycoders-admin.vercel.app/api/admin-content/public?contentType=COURSE');
  });

  it('routes existing ACTIVE and exact-version Course artifact URLs unchanged', () => {
    expect(destinationFor('/api/admin-content/public/course-1791616150410'))
      .toBe('https://ycoders-admin.vercel.app/api/admin-content/public/course-1791616150410');
    expect(destinationFor('/api/admin-content/public/course-1791616150410/2'))
      .toBe('https://ycoders-admin.vercel.app/api/admin-content/public/course-1791616150410/2');
  });

  it('keeps unrelated API and SPA routing unchanged', () => {
    expect(destinationFor('/library')).toBe('/index.html');
    expect(destinationFor('/api/compiler/health')).toBe('/api/compiler?path=health');
    expect(destinationFor('/api/admin-content/publish')).toBeNull();
    expect(destinationFor('/api/admin-content/public', 'POST')).toBeNull();
    expect(createVercelConfig('compiler').routes).not.toContain(ADMIN_PUBLIC_CONTENT_LIST_ROUTE);
    expect(createVercelConfig('compiler').routes).not.toContain(ADMIN_PUBLIC_CONTENT_DETAIL_ROUTE);
  });
});
