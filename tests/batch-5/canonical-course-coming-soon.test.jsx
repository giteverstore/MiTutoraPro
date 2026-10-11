import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CanonicalPublishedRepository, adaptCanonicalCourse } from '../../src/content/repositories/CanonicalPublishedRepository.js';
import { loadActiveCourseCatalog, loadPinnedCourseCatalog } from '../../src/home/canonicalCourseCatalog.js';
import { loadCourseMetadata } from '../../src/course/courseRepository.js';
import { CourseService } from '../../src/content/services/CourseService.js';
import { CourseCard } from '../../src/home/CourseCard.jsx';
import { createVercelConfig, ADMIN_PUBLIC_CONTENT_ROUTE } from '../../vercel.mjs';

vi.mock('../../src/bookmarks/BookmarkToggle', () => ({ BookmarkToggle: () => null }));

const contentId = 'course-1791616150410';
const pointer = { contentId, activeVersion: 2, metadata: { title: 'Untitled Course', language: 'python' } };

function courseDocument(comingSoon) {
  const content = {
    courseId: contentId, slug: 'untitled-course', title: 'Untitled Course', description: 'A diagnostic course.',
    language: 'python', difficulty: 'Beginner', estimatedMinutes: 5, prerequisites: [],
    learningOutcomes: ['Learn a concept.'], tags: [], defaultLessonId: 'first-lesson',
    modules: [{ id: 'first-module', order: 1, title: 'First module', description: 'Introduction.', lessons: [{
      id: 'first-lesson', order: 1, number: '1', title: 'First lesson', summary: 'Introduction.',
      status: 'available', estimatedMinutes: 5, tags: [], blocks: [{ id: 'first-paragraph', type: 'paragraph', content: 'Hello.', format: 'plain' }],
    }] }],
  };
  if (comingSoon !== undefined) content.comingSoon = comingSoon;
  return { contentId, contentType: 'COURSE', schemaVersion: '1.0.0', version: 2, status: 'published', locale: 'en', metadata: {}, content };
}

const response = (payload, ok = true) => ({ ok, json: async () => payload });
const fetcherFor = (document) => vi.fn(async (url) => url.includes('?contentType=')
  ? response({ items: [pointer] })
  : response({ document }));

describe('minimal canonical Course learner release', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it.each([[false, true], [true, false], [undefined, true]])('maps ACTIVE comingSoon=%s to available=%s', async (comingSoon, available) => {
    const document = courseDocument(comingSoon);
    const fetcher = fetcherFor(document);
    const repository = new CanonicalPublishedRepository({ contentType: 'COURSE', fetcher });
    const [catalogCourse] = await loadActiveCourseCatalog(repository);
    expect(catalogCourse).toMatchObject({ id: contentId, publishedVersion: 2, comingSoon: !available, available });
    expect(adaptCanonicalCourse((await repository.active(contentId)).document)).toMatchObject({ comingSoon: !available, available });
    expect(fetcher).toHaveBeenCalledWith(`/api/admin-content/public/${contentId}/2`);
  });

  it('uses the existing disabled Coming Soon card for the live diagnostic shape', async () => {
    const repository = new CanonicalPublishedRepository({ contentType: 'COURSE', fetcher: fetcherFor(courseDocument(true)) });
    const [course] = await loadActiveCourseCatalog(repository);
    const open = vi.fn();
    render(<CourseCard course={course} onOpenCourse={open} variant="list" allowBookmark={false} />);
    const card = screen.getByRole('heading', { name: 'Untitled Course' }).closest('article');
    expect(card).toHaveAttribute('aria-disabled', 'true');
    expect(card).toHaveTextContent('Coming Soon');
    fireEvent.click(card);
    expect(open).not.toHaveBeenCalled();
  });

  it('blocks a new learner direct URL but retains an existing pinned learner version', async () => {
    vi.stubGlobal('fetch', fetcherFor(courseDocument(true)));
    await expect(loadCourseMetadata(undefined, contentId)).rejects.toMatchObject({ code: 'content/course-coming-soon' });
    await expect(loadCourseMetadata(undefined, contentId, 2)).resolves.toMatchObject({
      provider: 'canonical', canonicalCourse: { comingSoon: true, contentVersion: 2 },
    });
    const [pinned] = await loadPinnedCourseCatalog([{ courseId: contentId, contentVersion: 2 }], {
      exact: async () => ({ document: courseDocument(true) }),
    });
    expect(pinned).toMatchObject({ id: contentId, publishedVersion: 2 });
  });

  it('does not treat an unreadable artifact as evidence that the Course is available', async () => {
    const repository = new CanonicalPublishedRepository({ contentType: 'COURSE', fetcher: async (url) => url.includes('?contentType=')
      ? response({ items: [pointer] }) : response({ error: { code: 'content/artifact-unavailable' } }, false) });
    await expect(loadActiveCourseCatalog(repository)).rejects.toMatchObject({ code: 'content/artifact-unavailable' });
  });

  it('retains the legacy Firebase Course path when no canonical publication exists', async () => {
    const legacy = { id: 'legacy-python', title: 'Legacy Python' };
    const getMetadata = vi.spyOn(CourseService.prototype, 'getMetadata').mockResolvedValue(legacy);
    vi.stubGlobal('fetch', vi.fn(async () => response({ error: { code: 'content/not-published' } }, false)));
    await expect(loadCourseMetadata(undefined, legacy.id)).resolves.toMatchObject({ provider: 'firebase', defaultCourseId: legacy.id });
    expect(getMetadata).toHaveBeenCalledWith(legacy.id);
  });

  it('routes only main-site public GET reads to the existing Admin public API', () => {
    expect(createVercelConfig('main').routes).toContain(ADMIN_PUBLIC_CONTENT_ROUTE);
    expect(createVercelConfig('compiler').routes).not.toContain(ADMIN_PUBLIC_CONTENT_ROUTE);
    expect(ADMIN_PUBLIC_CONTENT_ROUTE.methods).toEqual(['GET']);
    expect('/api/admin-content/public/course-1791616150410/2').toMatch(new RegExp(ADMIN_PUBLIC_CONTENT_ROUTE.src));
    expect('/api/admin-content/publish').not.toMatch(new RegExp(ADMIN_PUBLIC_CONTENT_ROUTE.src));
  });
});
