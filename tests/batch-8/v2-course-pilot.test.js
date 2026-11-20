import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { parseAppRoute, routePath } from '../../src/routing/appRoutes';
import { createV2CourseIdentity, v2ProgressKey } from '../../src/v2-pilot/contentIdentity';
import { isV2CoursePilotEnabled } from '../../src/v2-pilot/featureGate';
import { adaptV2CourseForLearner, V2CourseRepository } from '../../src/v2-pilot/V2CourseRepository';
import { createCourseOverviewModel } from '../../src/course/createCourseOverviewModel';
import { CourseLoaderProvider, useCourseLoader } from '../../src/course/CourseLoader';
import { v2AssetDeliveryUrl } from '../../src/components/blocks/ImageBlock';
import { BlockRenderer } from '../../src/components/BlockRenderer';
import { createV2ProgressRepository } from '../../src/v2-pilot/v2ProgressRepository';
import { deriveProgress } from '../../src/progress/learningProgressModel';
import { createCourseNavigation } from '../../src/course/courseNavigation';
import { Sidebar } from '../../src/components/Sidebar';

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

  it('fits the pilot banner and learning shell inside one dynamic viewport', () => {
    const css = readFileSync('src/v2-pilot/v2-pilot.css', 'utf8');
    expect(css).toMatch(/\.v2-pilot-shell\s*\{[^}]*height:\s*100dvh;[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\);[^}]*overflow:\s*hidden;/s);
    expect(css).toMatch(/\.v2-pilot-shell\s*>\s*\.app-shell\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*0;/s);
    expect(css).toMatch(/\.v2-pilot-shell \.workspace\s*\{[^}]*height:\s*calc\(100% - var\(--topbar-height\)\);/s);
    expect(css).toMatch(/\.v2-pilot-shell \.lesson-completion-footer\s*\{[^}]*env\(safe-area-inset-bottom\)/s);
    expect(css).toMatch(/@media \(max-width:\s*40rem\)[\s\S]*?\.v2-pilot-banner\s*\{[^}]*flex-wrap:\s*wrap;/s);
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

  it('maps the immutable pilot blocks and metadata into the learner model', () => {
    const identity = createV2CourseIdentity({ contentId: 'course-a', publicationVersion: 1 });
    const rich = (id, content) => ({ id, type: 'richText', data: { document: { type: 'doc', content } } });
    const delivered = {
      courseId: 'course-a', title: 'V2 Staging Pilot Course', description: 'Pilot.', difficulty: 'beginner',
      estimatedMinutes: 40,
      learningOutcomes: ['Explain how a versioned V2 Course reaches the learner runtime.', 'Run a small TypeScript example and identify its output.'],
      prerequisites: ['Basic familiarity with JavaScript'],
      modules: [{ id: 'module-one', title: 'V2 Pilot Fundamentals', organization: 'sections', sections: [{
        id: 'section-one', title: 'Pilot Basics', lessons: [
          { id: 'lesson-one', title: 'Understanding V2 Delivery', estimatedMinutes: 20, blocks: [
            rich('rich-one', [
              { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Welcome to the V2 Pilot' }] },
              { type: 'paragraph', content: [{ type: 'text', text: 'This lesson verifies that immutable V2 Course content can move safely from Editor Studio to the learner runtime.' }] },
            ]),
            { id: 'code-one', type: 'code', data: { language: 'typescript', filename: 'src/pilot.ts', code: 'const publicationVersion: number = 1\n\nconsole.log(`Running V2 publication ${publicationVersion}`)' } },
            { id: 'image-one', type: 'image', data: { assetId: 'ea6bc02a-d508-462f-8808-2e7b22982dba', alt: 'Ycoders V2 staging pilot course illustration', caption: 'Staging-only image used to verify version-bound asset delivery.', delivery: { kind: 'versioned-v2-asset', namespace: 'v2', contentId: 'course-a', publicationVersion: 1, assetId: 'ea6bc02a-d508-462f-8808-2e7b22982dba' } } },
          ] },
          { id: 'lesson-two', title: 'Running the Pilot Example', estimatedMinutes: 20, blocks: [
            rich('rich-two', [
              { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Run the Example' }] },
              { type: 'paragraph', content: [{ type: 'text', text: 'Review the code, identify the publication version, and confirm the expected console output.' }] },
              { type: 'bulletList', content: [
                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Read the version constant.' }] }] },
                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Inspect the template string.' }] }] },
                { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Confirm the displayed version is 1.' }] }] },
              ] },
            ]),
            { id: 'code-two', type: 'code', data: { language: 'typescript', filename: 'src/check.ts', code: 'export function formatVersion(version: number): string {\n  return `V2 publication ${version}`\n}\n\nconsole.log(formatVersion(1))' } },
          ] },
        ],
      }] }],
    };
    const adapted = adaptV2CourseForLearner(delivered, identity);
    const [first, second] = adapted.modules[0].sections[0].lessons;
    expect(adapted.modules[0].sections[0].lessons).toHaveLength(2);
    expect(first.blocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'heading', text: 'Welcome to the V2 Pilot' }),
      expect.objectContaining({ type: 'paragraph', content: expect.stringContaining('immutable V2 Course') }),
      expect.objectContaining({ type: 'code', language: 'typescript', filename: 'src/pilot.ts', code: 'const publicationVersion: number = 1\n\nconsole.log(`Running V2 publication ${publicationVersion}`)' }),
      expect.objectContaining({ type: 'image', alt: 'Ycoders V2 staging pilot course illustration', caption: 'Staging-only image used to verify version-bound asset delivery.', delivery: expect.objectContaining({ publicationVersion: 1, assetId: 'ea6bc02a-d508-462f-8808-2e7b22982dba' }) }),
    ]));
    expect(second.blocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'heading', text: 'Run the Example' }),
      expect.objectContaining({ type: 'list', style: 'unordered', items: ['Read the version constant.', 'Inspect the template string.', 'Confirm the displayed version is 1.'] }),
      expect.objectContaining({ type: 'code', language: 'typescript', filename: 'src/check.ts', code: 'export function formatVersion(version: number): string {\n  return `V2 publication ${version}`\n}\n\nconsole.log(formatVersion(1))' }),
    ]));
    const overview = createCourseOverviewModel(adapted, { completedLessons: [] });
    expect(overview).toMatchObject({ estimatedDuration: '40 min', certificateAvailable: false, skills: delivered.learningOutcomes, prerequisites: delivered.prerequisites });
    const image = first.blocks.find(({ type }) => type === 'image');
    expect(v2AssetDeliveryUrl(image.delivery)).toBe('/api/v2-pilot/courses/course-a/versions/1/assets/ea6bc02a-d508-462f-8808-2e7b22982dba');
    expect(v2AssetDeliveryUrl(image.delivery)).not.toContain('editor-v2-published-assets');
    const list = second.blocks.find(({ type }) => type === 'list');
    render(React.createElement(BlockRenderer, { lesson: { blocks: [list] }, emptyState: {} }));
    const renderedList = screen.getByRole('list');
    expect(renderedList).toHaveClass('lesson-content-list');
    expect(renderedList).not.toHaveClass('lesson-list');
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Read the version constant.',
      'Inspect the template string.',
      'Confirm the displayed version is 1.',
    ]);
  });

  it('leaves legacy Course certification behavior unchanged', () => {
    const progress = { completedLessons: [] };
    const legacy = { id: 'legacy', title: 'Legacy', status: 'published', metadata: {}, modules: [] };
    expect(createCourseOverviewModel(legacy, progress).certificateAvailable).toBe(true);
    expect(createCourseOverviewModel({ ...legacy, status: 'archived' }, progress).certificateAvailable).toBe(false);
  });

  it('derives duration from two distinct lessons when the delivery omits a total', () => {
    const identity = createV2CourseIdentity({ contentId: 'course-a', publicationVersion: 1 });
    const adapted = adaptV2CourseForLearner({ courseId: 'course-a', modules: [{ id: 'm', lessons: [
      { id: 'one', estimatedMinutes: 15, blocks: [] }, { id: 'two', estimatedMinutes: 25, blocks: [] },
    ] }] }, identity);
    expect(adapted.metadata.estimatedMinutes).toBe(40);
    expect(adapted.modules[0].lessons.map(({ id }) => id)).toEqual(['one', 'two']);
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

  it('serializes progress writes against the latest authoritative revision', async () => {
    let revision = 4;
    const requestBodies = [];
    const fetchImpl = vi.fn(async (_url, options) => {
      if (options.method === 'GET') return { ok: true, json: async () => ({ ok: true, data: { completedLessons: [], revision } }) };
      const body = JSON.parse(options.body);
      requestBodies.push(body);
      expect(body.revision).toBe(revision);
      revision += 1;
      return { ok: true, json: async () => ({ ok: true, data: { ...body, revision } }) };
    });
    const repository = createV2ProgressRepository(
      { contentId: 'course-a', publicationVersion: 1 },
      { fetchImpl, tokenProvider: async () => 'learner-token' },
    );
    await repository.load('learner');
    await Promise.all([
      repository.save('learner', 'course-a', { completedLessons: ['lesson-one'], bookmarks: [] }),
      repository.save('learner', 'course-a', { completedLessons: ['lesson-one', 'lesson-two'], bookmarks: ['lesson-two'] }),
    ]);
    expect(requestBodies.map(({ revision: value }) => value)).toEqual([4, 5]);
    expect(requestBodies[1].completedLessons).toEqual(['lesson-one', 'lesson-two']);
  });

  it('restores every completion surface from the same V2 completed lesson set', () => {
    const lessons = [
      { id: 'lesson-one', title: 'Understanding V2 Delivery', blocks: [] },
      { id: 'lesson-two', title: 'Running the Pilot Example', blocks: [] },
    ];
    const course = {
      id: 'course-a', name: 'Pilot', sidebar: { closeLabel: 'Close' }, ui: { shortcuts: { close: 'Escape' } },
      modules: [{ id: 'module-one', title: 'Fundamentals', meta: '', initiallyOpen: true, sections: [{ id: 'section-one', title: 'Pilot Basics', initiallyExpanded: true, lessons }] }],
    };
    const progress = deriveProgress(course, { completedLessons: lessons.map(({ id }) => id), bookmarks: ['lesson-two'] });
    expect(progress.completedLessons).toEqual(['lesson-one', 'lesson-two']);
    expect(progress.sequentialCompletedLessons).toBe(2);

    const view = render(React.createElement(Sidebar, {
      course, currentLessonId: null, onSelectLesson: vi.fn(), isLoading: false,
      completedLessonIds: new Set(progress.completedLessons), visitedLessonIds: new Set(progress.visitedLessons),
      completedCount: progress.sequentialCompletedLessons, lessonCount: 2,
      completedModuleIds: new Set(progress.completedModules), estimatedTimeRemaining: progress.estimatedTimeRemaining,
      isOpen: true, onClose: vi.fn(), isCollapsed: false, onToggleCollapsed: vi.fn(), isOverlay: false,
    }));
    const queries = within(view.container);
    expect(queries.getByText('2 of 2 lessons')).toBeInTheDocument();
    expect(queries.getByText('2/2')).toBeInTheDocument();
    expect(view.container.querySelectorAll('.lesson-link.is-complete')).toHaveLength(2);
  });

  it('uses the ordered section lesson sequence for V2 Previous and Next targets', () => {
    const course = { modules: [{ id: 'module-one', sections: [{ id: 'section-one', lessons: [
      { id: 'lesson-one', title: 'Understanding V2 Delivery', blocks: [] },
      { id: 'lesson-two', title: 'Running the Pilot Example', blocks: [] },
    ] }] }] };
    const navigation = createCourseNavigation(course);
    expect(navigation.getState('lesson-one')).toMatchObject({ previousLesson: null, nextLesson: { id: 'lesson-two' } });
    expect(navigation.getState('lesson-two')).toMatchObject({ previousLesson: { id: 'lesson-one' }, nextLesson: null });
  });
});

describe('V2 lesson navigation reuse', () => {
  function CurrentLesson({ transitions = null }) {
    const loader = useCourseLoader();
    const lessonId = loader.currentLesson?.id ?? loader.status;
    React.useEffect(() => { if (loader.currentLesson?.id) transitions?.push(loader.currentLesson.id); }, [loader.currentLesson?.id, transitions]);
    return React.createElement(React.Fragment, null,
      React.createElement('span', null, lessonId),
      React.createElement('button', { type: 'button', disabled: !loader.previousLesson, onClick: loader.goToPreviousLesson }, 'Previous lesson'),
      React.createElement('button', { type: 'button', disabled: !loader.nextLesson, onClick: loader.goToNextLesson }, 'Next lesson'));
  }

  it('switches lessons locally without reloading the version-pinned Course', async () => {
    const repository = {
      loadMetadata: vi.fn(async () => ({ courses: [{ id: 'course-a', version: 1 }], provider: 'v2-pilot' })),
      loadDocument: vi.fn(async () => ({
        provider: 'v2-pilot', courseEntry: { id: 'course-a', version: 1 },
        course: { id: 'course-a', title: 'Pilot', defaultLessonId: 'lesson-one', navigation: { defaultLessonId: 'lesson-one' }, modules: [{ id: 'module-one', lessons: [
          { id: 'lesson-one', title: 'One', blocks: [] }, { id: 'lesson-two', title: 'Two', blocks: [] },
        ] }] },
      })),
    };
    const view = (lessonId) => React.createElement(CourseLoaderProvider, {
      courseId: 'course-a', contentVersion: 1, initialLessonId: lessonId, repository,
    }, React.createElement(CurrentLesson));
    const rendered = render(view('lesson-one'));
    const renderedQueries = within(rendered.container);
    await renderedQueries.findByText('lesson-one');
    rendered.rerender(view('lesson-two'));
    await renderedQueries.findByText('lesson-two');
    expect(repository.loadMetadata).toHaveBeenCalledTimes(1);
    expect(repository.loadDocument).toHaveBeenCalledTimes(1);
    expect(repository.loadMetadata.mock.calls[0][2]).toBe(1);
  });

  it('does not let a stale route prop revert a locally selected lesson before the URL catches up', async () => {
    const transitions = [];
    const repository = {
      loadMetadata: vi.fn(async () => ({ courses: [{ id: 'course-a', version: 1 }], provider: 'v2-pilot' })),
      loadDocument: vi.fn(async () => ({
        provider: 'v2-pilot', courseEntry: { id: 'course-a', version: 1 },
        course: { id: 'course-a', title: 'Pilot', defaultLessonId: 'lesson-one', navigation: { defaultLessonId: 'lesson-one' }, modules: [{ id: 'module-one', lessons: [
          { id: 'lesson-one', title: 'One', blocks: [] }, { id: 'lesson-two', title: 'Two', blocks: [] },
        ] }] },
      })),
    };
    const view = (lessonId) => React.createElement(CourseLoaderProvider, {
      courseId: 'course-a', contentVersion: 1, initialLessonId: lessonId, repository,
    }, React.createElement(CurrentLesson, { transitions }));
    const rendered = render(view('lesson-one'));
    const renderedQueries = within(rendered.container);
    await renderedQueries.findByText('lesson-one');
    fireEvent.click(renderedQueries.getByRole('button', { name: 'Next lesson' }));
    await renderedQueries.findByText('lesson-two');
    await waitFor(() => expect(transitions).toEqual(['lesson-one', 'lesson-two']));
    rendered.rerender(view('lesson-two'));
    await waitFor(() => expect(transitions).toEqual(['lesson-one', 'lesson-two']));
    expect(routePath({ kind: 'v2-pilot-course', contentId: 'course-a', publicationVersion: 1, lessonId: 'lesson-two' }))
      .toBe('/pilot/v2/courses/course-a/versions/1/lesson/lesson-two');
    fireEvent.click(renderedQueries.getByRole('button', { name: 'Previous lesson' }));
    await renderedQueries.findByText('lesson-one');
    await waitFor(() => expect(transitions).toEqual(['lesson-one', 'lesson-two', 'lesson-one']));
    rendered.rerender(view('lesson-one'));
    await waitFor(() => expect(transitions).toEqual(['lesson-one', 'lesson-two', 'lesson-one']));
    expect(repository.loadMetadata).toHaveBeenCalledTimes(1);
    expect(repository.loadDocument).toHaveBeenCalledTimes(1);
  });
});
