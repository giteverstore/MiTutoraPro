import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseAppRoute, routePage, routePath } from '../../src/routing/appRoutes';

const pageRoutes = [
  ['/', 'home'],
  ['/practice', 'practice'],
  ['/challenges', 'challenges'],
  ['/bookmarks', 'bookmarks'],
  ['/certificates', 'certificates'],
  ['/referrals', 'referrals'],
  ['/settings', 'settings'],
  ['/projects', 'projects'],
];

describe('application URL adapter', () => {
  it.each(pageRoutes)('parses the AppShell route %s', (path, page) => {
    expect(parseAppRoute(path)).toEqual({ kind: 'page', page });
  });

  it.each([
    ['/practice/fund-variables-001', { kind: 'practice-question', page: 'practice', questionId: 'fund-variables-001' }],
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
    expect(routePage({ kind: 'page', page: 'settings' })).toBe('settings');
  });
});

describe('Vercel SPA routing contract', () => {
  const config = JSON.parse(readFileSync(resolve('vercel.json'), 'utf8'));

  it('falls back unresolved direct requests to the Vite SPA entry point', () => {
    expect(config.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }]);
  });

  it('uses filesystem-aware rewrites without legacy route or build overrides', () => {
    expect(config.routes).toBeUndefined();
    expect(config.builds).toBeUndefined();
    expect(config.cleanUrls).toBeUndefined();
    expect(config.trailingSlash).toBeUndefined();
  });
});
