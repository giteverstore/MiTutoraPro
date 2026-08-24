import { describe, expect, it } from 'vitest';
import { parseAppRoute, routePage, routePath } from '../../src/routing/appRoutes';

describe('application URL adapter', () => {
  it.each([
    ['/', { kind: 'page', page: 'home' }],
    ['/practice', { kind: 'page', page: 'practice' }],
    ['/practice/fund-variables-001', { kind: 'practice-question', page: 'practice', questionId: 'fund-variables-001' }],
    ['/courses/python', { kind: 'course-overview', courseId: 'python', lessonId: null }],
    ['/courses/python/lesson/python-introduction', { kind: 'course-lesson', courseId: 'python', lessonId: 'python-introduction' }],
  ])('parses %s', (path, expected) => expect(parseAppRoute(path)).toEqual(expected));

  it('rejects malformed and path-traversal identifiers', () => {
    expect(parseAppRoute('/courses/%2e%2e/lesson/x').kind).toBe('not-found');
    expect(parseAppRoute('/practice/a%2Fb').kind).toBe('not-found');
    expect(parseAppRoute('/unknown').kind).toBe('not-found');
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
