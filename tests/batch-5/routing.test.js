import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseAppRoute, routePage, routePath } from '../../src/routing/appRoutes';

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
});

describe('Vercel SPA routing contract', () => {
  const config = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8'));

  it('falls back unresolved direct requests to the Vite SPA entry point', () => {
    expect(config.routes).toEqual([
      { handle: 'filesystem' },
      { src: '/((?!api(?:/|$)|assets(?:/|$)|vendor(?:/|$)|src(?:/|$)|node_modules(?:/|$)|@[^/]+(?:/|$))[^.]*)', dest: '/index.html' },
    ]);
  });

  it('uses filesystem-aware rewrites without legacy route or build overrides', () => {
    expect(config.routes[0]).toEqual({ handle: 'filesystem' });
    expect(config.rewrites).toBeUndefined();
    expect(config.builds).toBeUndefined();
    expect(config.cleanUrls).toBeUndefined();
    expect(config.trailingSlash).toBeUndefined();
  });
});
