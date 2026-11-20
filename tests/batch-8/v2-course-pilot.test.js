import { describe, expect, it, vi } from 'vitest';
import { parseAppRoute, routePath } from '../../src/routing/appRoutes';
import { createV2CourseIdentity, v2ProgressKey } from '../../src/v2-pilot/contentIdentity';
import { isV2CoursePilotEnabled } from '../../src/v2-pilot/featureGate';
import { V2CourseRepository } from '../../src/v2-pilot/V2CourseRepository';
import { createV2ProgressRepository } from '../../src/v2-pilot/v2ProgressRepository';

describe('E10.3 V2 Course pilot identity and feature gate', () => {
  it('is disabled by default and cannot be enabled in production', () => {
    expect(isV2CoursePilotEnabled({})).toBe(false);
    expect(isV2CoursePilotEnabled({ VITE_V2_COURSE_PILOT_ENABLED: 'true', VITE_YCODERS_ENVIRONMENT: 'production' })).toBe(false);
    expect(isV2CoursePilotEnabled({ VITE_V2_COURSE_PILOT_ENABLED: 'true', VITE_YCODERS_ENVIRONMENT: 'preview' })).toBe(true);
  });

  it('uses an explicit namespace and exact version identity', () => {
    const identity = createV2CourseIdentity({ contentId: 'same-id', publicationVersion: 2 });
    expect(identity).toEqual({ namespace: 'v2', contentType: 'course', contentId: 'same-id', publicationVersion: 2 });
    expect(v2ProgressKey(identity)).toBe('v2:course:same-id:version:2');
    expect(() => v2ProgressKey({ contentId: 'same-id' })).toThrow(/exact publicationVersion/);
  });

  it('parses only the explicit pilot namespace route', () => {
    const route = parseAppRoute('/pilot/v2/courses/python-v2/versions/7/lesson/intro');
    expect(route).toMatchObject({ kind: 'v2-pilot-course', namespace: 'v2', contentId: 'python-v2', publicationVersion: 7, lessonId: 'intro' });
    expect(routePath(route)).toBe('/pilot/v2/courses/python-v2/versions/7/lesson/intro');
    expect(parseAppRoute('/courses/python-v2')).toMatchObject({ kind: 'course-overview', courseId: 'python-v2' });
  });
});

describe('V2 learner repository', () => {
  const course = { id: 'course-a', modules: [{ id: 'm1', lessons: [{ id: 'l1', blocks: [{ type: 'image', delivery: { kind: 'versioned-v2-asset', namespace: 'v2', contentId: 'course-a', publicationVersion: 3, assetId: 'hero' } }] }] }] };
  it('invokes the browser fetch implementation with the global receiver', async () => {
    const browserFetch = vi.fn(function browserFetch(url) {
      if (this !== globalThis) throw new TypeError('fetch requires the Window receiver');
      return Promise.resolve({
        ok: true,
        headers: new Headers(),
        json: async () => ({ ok: true, data: { namespace: 'v2', contentType: 'course', contentId: 'course-a', publicationVersion: 3, course } }),
      });
    });
    vi.stubGlobal('fetch', browserFetch);
    try {
      const repository = new V2CourseRepository({ tokenProvider: async () => 'learner-token' });
      await expect(repository.load({ contentId: 'course-a' })).resolves.toMatchObject({ contentId: 'course-a' });
      expect(browserFetch).toHaveBeenCalledWith('/api/v2-pilot/courses/course-a', expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer learner-token' }),
      }));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('loads active and exact publications without legacy fallback', async () => {
    const fetchImpl = vi.fn(async (url) => ({ ok: true, headers: new Headers(), json: async () => ({ ok: true, data: { namespace: 'v2', contentType: 'course', contentId: 'course-a', publicationVersion: 3, course } }) }));
    const repository = new V2CourseRepository({ tokenProvider: async () => 'learner-token', fetchImpl });
    expect((await repository.load({ contentId: 'course-a' })).identity.publicationVersion).toBe(3);
    await repository.load({ contentId: 'course-a', publicationVersion: 3 });
    expect(fetchImpl.mock.calls[0][0]).toBe('/api/v2-pilot/courses/course-a');
    expect(fetchImpl.mock.calls[1][0]).toBe('/api/v2-pilot/courses/course-a/versions/3');
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer learner-token');
  });

  it('returns typed errors and never invokes another repository', async () => {
    const repository = new V2CourseRepository({ tokenProvider: async () => 'token', fetchImpl: async () => ({ ok: false, status: 404, headers: new Headers(), json: async () => ({ error: { code: 'v2/not-found', message: 'Missing.' } }) }) });
    await expect(repository.load({ contentId: 'missing' })).rejects.toMatchObject({ code: 'v2/not-found', status: 404 });
  });
});

describe('V2 progress isolation', () => {
  it('uses separate authenticated server endpoints for each version', async () => {
    const fetchImpl=vi.fn(async(url,options)=>({ok:true,json:async()=>({ok:true,data:{completedLessons:[url.includes('versions/1')?'intro':'advanced'],revision:1}})}));
    const options={fetchImpl,tokenProvider:async()=>'learner-token'};
    const v1 = createV2ProgressRepository({ contentId: 'same-id', publicationVersion: 1 }, options);
    const v2 = createV2ProgressRepository({ contentId: 'same-id', publicationVersion: 2 }, options);
    await v1.save('learner', 'same-id', { completedLessons: ['intro'] });
    await v2.save('learner', 'same-id', { completedLessons: ['advanced'] });
    expect((await v1.load('learner')).completedLessons).toEqual(['intro']);
    expect((await v2.load('learner')).completedLessons).toEqual(['advanced']);
    expect(fetchImpl.mock.calls.map(([url])=>url)).toContain('/api/v2-pilot/progress/same-id/versions/1');
    expect(fetchImpl.mock.calls.every(([,request])=>request.headers.Authorization==='Bearer learner-token')).toBe(true);
  });

  it('does not persist shadow validation progress', async () => {
    const fetchImpl=vi.fn();
    const repository = createV2ProgressRepository({ contentId: 'course-a', publicationVersion: 1 }, { fetchImpl, persist: false });
    await repository.save('learner', 'course-a', { completedLessons: ['l1'] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
