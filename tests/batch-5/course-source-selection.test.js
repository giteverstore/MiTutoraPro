import { describe, expect, it, vi } from 'vitest';
import { loadCourseMetadata } from '../../src/course/courseRepository.js';
import { COURSE_SOURCES, getCourseSource } from '../../src/course/courseSource.js';

const canonicalDocument = (courseId) => ({
  contentId: courseId,
  version: 3,
  locale: 'en',
  metadata: {},
  content: {
    courseId,
    slug: courseId,
    title: 'Canonical Course',
    description: 'Published through Admin.',
    language: 'python',
    difficulty: 'Beginner',
    estimatedMinutes: 30,
    comingSoon: false,
    modules: [{ id: 'module-1', order: 1, title: 'Start', lessons: [{ id: 'lesson-1', title: 'Lesson', blocks: [] }] }],
  },
});

describe('Course source ownership', () => {
  it.each(['python', 'java'])('loads known legacy %s directly without a canonical probe', async (courseId) => {
    const canonicalRepository = { active: vi.fn(), exact: vi.fn() };
    const legacyService = { getMetadata: vi.fn(async () => ({ id: courseId, version: 'v1' })) };
    await expect(loadCourseMetadata(undefined, courseId, null, { canonicalRepository, legacyService }))
      .resolves.toMatchObject({ provider: 'firebase', defaultCourseId: courseId });
    expect(getCourseSource(courseId)).toBe(COURSE_SOURCES.legacy);
    expect(canonicalRepository.active).not.toHaveBeenCalled();
    expect(canonicalRepository.exact).not.toHaveBeenCalled();
    expect(legacyService.getMetadata).toHaveBeenCalledOnce();
  });

  it('loads a canonical course from Admin without touching the legacy service', async () => {
    const canonicalRepository = { active: vi.fn(async () => ({ document: canonicalDocument('admin-course') })), exact: vi.fn() };
    const legacyService = { getMetadata: vi.fn() };
    await expect(loadCourseMetadata(undefined, 'admin-course', null, { canonicalRepository, legacyService }))
      .resolves.toMatchObject({ provider: 'canonical', defaultCourseId: 'admin-course' });
    expect(getCourseSource('admin-course')).toBeNull();
    expect(canonicalRepository.active).toHaveBeenCalledOnce();
    expect(legacyService.getMetadata).not.toHaveBeenCalled();
  });

  it('preserves migration fallback for an unknown course only after canonical not-published', async () => {
    const canonicalRepository = { active: vi.fn(async () => { throw Object.assign(new Error(), { code: 'content/not-published' }); }), exact: vi.fn() };
    const legacyService = { getMetadata: vi.fn(async () => ({ id: 'migrating-course', version: 'v1' })) };
    await expect(loadCourseMetadata(undefined, 'migrating-course', null, { canonicalRepository, legacyService }))
      .resolves.toMatchObject({ provider: 'firebase' });
    expect(canonicalRepository.active).toHaveBeenCalledOnce();
    expect(legacyService.getMetadata).toHaveBeenCalledOnce();
  });

  it('preserves exact canonical pinning and never sends it to legacy', async () => {
    const canonicalRepository = { active: vi.fn(), exact: vi.fn(async () => ({ document: canonicalDocument('admin-course') })) };
    const legacyService = { getMetadata: vi.fn() };
    await expect(loadCourseMetadata(undefined, 'admin-course', 3, { canonicalRepository, legacyService }))
      .resolves.toMatchObject({ provider: 'canonical', canonicalCourse: { publishedVersion: 3 } });
    expect(canonicalRepository.exact).toHaveBeenCalledWith('admin-course', 3);
    expect(legacyService.getMetadata).not.toHaveBeenCalled();
  });
});
