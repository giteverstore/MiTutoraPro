import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { CompositeTutorContentSource } from '../../server/ai/tutor/CompositeTutorContentSource.js';
import { CanonicalTutorContentSource } from '../../server/ai/tutor/CanonicalTutorContentSource.js';
import { FirebaseTutorContentSource } from '../../server/ai/tutor/FirebaseTutorContentSource.js';
import { createTutorScopeResolver } from '../../server/ai/tutor/resolveTutorScope.js';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const bytes = (value) => Buffer.from(JSON.stringify(value));
const snapshot = (value) => ({ exists: value != null, data: () => value });

function database(records) {
  const reads = [];
  const db = {
    doc: (path) => ({ path, get: async () => { reads.push(path); return snapshot(records[path]); } }),
    getAll: vi.fn(async (...refs) => { reads.push(...refs.map(({ path }) => path)); return refs.map(({ path }) => snapshot(records[path])); }),
  };
  return { db, reads };
}

function courseFixture(id, version, lessonId) {
  const manifest = { id, title: `${id} course`, modules: [{ id: 'module-1', sections: [{ id: 'section-1', lessons: [{ id: lessonId, title: `${id} lesson`, summary: 'Authoritative summary', blocks: [] }] }] }] };
  const content = bytes(manifest);
  return {
    manifest, content,
    records: {
      [`contentPublications/course-${id}`]: { status: 'ACTIVE', activeVersion: version, integrityRequired: true },
      [`courses/${id}`]: { id, published: true, version, storagePath: `course-content/${id}`, contentIntegrity: { algorithm: 'sha256', manifest: hash(content), modules: {} } },
    },
  };
}

function practiceFixture() {
  const question = { id: 'fund-variables-008', title: 'Reason About Four Values', summary: 'Identify the types.', topic: 'variables', difficulty: 'easy', blocks: [] };
  const content = bytes(question);
  return {
    question, content,
    records: {
      'contentPublications/practice-python': { status: 'ACTIVE', activeVersion: 'v2', integrityRequired: true },
      'practiceQuestions/fund-variables-008': { id: question.id, published: true, version: 'v2', storagePath: 'practice/python/question-8.json', contentHash: hash(content) },
    },
  };
}

describe('composite Tutor content authority', () => {
  it.each([
    ['python', 'v2', 'lesson-1-1-introduction-to-python'],
    ['java', 'v1', 'java-lesson-1-1-1-getting-started-with-java'],
  ])('resolves approved legacy Course %s from one metadata batch and one verified manifest read', async (id, version, lessonId) => {
    const fixture = courseFixture(id, version, lessonId);
    const { db } = database(fixture.records);
    const loadBytes = vi.fn(async () => fixture.content);
    const source = new FirebaseTutorContentSource({ db, loadBytes });
    const resolve = createTutorScopeResolver({ contentSource: source });
    await expect(resolve({ body: { tutorScope: { surface: 'course', scopeId: id, activityId: lessonId } } })).resolves.toMatchObject({
      surface: 'course', scopeId: id, activityId: lessonId, contentSource: 'legacy-course', contentVersion: version,
    });
    expect(db.getAll).toHaveBeenCalledOnce();
    expect(loadBytes).toHaveBeenCalledOnce();
    expect(loadBytes.mock.calls[0][0]).toBe(`course-content/${id}/${version}/course.json`);
  });

  it('rejects unknown legacy Courses before Storage and rejects forged lesson membership', async () => {
    const fixture = courseFixture('python', 'v2', 'lesson-1');
    const { db } = database(fixture.records);
    const loadBytes = vi.fn(async () => fixture.content);
    const source = new FirebaseTutorContentSource({ db, loadBytes });
    await expect(source.get({ surface: 'course', contentId: 'ruby' })).rejects.toMatchObject({ code: 'ai/content-unavailable' });
    expect(loadBytes).not.toHaveBeenCalled();
    const resolve = createTutorScopeResolver({ contentSource: source });
    await expect(resolve({ body: { tutorScope: { surface: 'course', scopeId: 'python', activityId: 'forged-lesson' } } })).rejects.toMatchObject({ code: 'ai/activity-invalid' });
  });

  it.each([
    ['course identity mismatch', (fixture) => { fixture.records['courses/python'].id = 'java'; }],
    ['inactive version', (fixture) => { fixture.records['contentPublications/course-python'].activeVersion = 'v1'; }],
    ['integrity failure', (fixture) => { fixture.records['courses/python'].contentIntegrity.manifest = '0'.repeat(64); }],
  ])('rejects legacy Course %s', async (_label, alter) => {
    const fixture = courseFixture('python', 'v2', 'lesson-1'); alter(fixture);
    const { db } = database(fixture.records);
    const source = new FirebaseTutorContentSource({ db, loadBytes: async () => fixture.content });
    await expect(source.get({ surface: 'course', contentId: 'python' })).rejects.toMatchObject({ code: 'ai/content-unavailable' });
  });

  it('resolves an ACTIVE integrity-checked Practice question with question identity as scope identity', async () => {
    const fixture = practiceFixture(); const { db } = database(fixture.records); const loadBytes = vi.fn(async () => fixture.content);
    const resolve = createTutorScopeResolver({ contentSource: new FirebaseTutorContentSource({ db, loadBytes }) });
    await expect(resolve({ body: { tutorScope: { surface: 'practice', scopeId: fixture.question.id, activityId: fixture.question.id } } })).resolves.toMatchObject({
      surface: 'practice', scopeId: fixture.question.id, activityId: fixture.question.id, contentSource: 'firebase-practice', contentVersion: 'v2', practiceQuestionId: fixture.question.id,
    });
    expect(db.getAll).toHaveBeenCalledOnce();
    expect(loadBytes).toHaveBeenCalledOnce();
    expect(loadBytes.mock.calls[0][0]).toBe('practice/python/v2/question-8.json');
  });

  it.each([
    ['unknown question', (fixture) => { delete fixture.records['practiceQuestions/fund-variables-008']; }],
    ['inactive version', (fixture) => { fixture.records['contentPublications/practice-python'].activeVersion = 'v1'; }],
    ['question identity mismatch', (fixture) => { fixture.question.id = 'forged'; fixture.content = bytes(fixture.question); fixture.records['practiceQuestions/fund-variables-008'].contentHash = hash(fixture.content); }],
    ['integrity failure', (fixture) => { fixture.records['practiceQuestions/fund-variables-008'].contentHash = '0'.repeat(64); }],
  ])('rejects Practice %s', async (_label, alter) => {
    const fixture = practiceFixture(); alter(fixture); const { db } = database(fixture.records);
    const source = new FirebaseTutorContentSource({ db, loadBytes: async () => fixture.content });
    await expect(source.get({ surface: 'practice', contentId: 'fund-variables-008' })).rejects.toMatchObject({ code: 'ai/content-unavailable' });
  });

  it('rejects mismatched Practice activity membership', async () => {
    const fixture = practiceFixture(); const { db } = database(fixture.records);
    const resolve = createTutorScopeResolver({ contentSource: new FirebaseTutorContentSource({ db, loadBytes: async () => fixture.content }) });
    await expect(resolve({ body: { tutorScope: { surface: 'practice', scopeId: fixture.question.id, activityId: 'forged-question' } } })).rejects.toMatchObject({ code: 'ai/activity-invalid' });
  });

  it('uses Admin canonical content first and never constructs fallback for canonical Course or Project', async () => {
    const fallbackFactory = vi.fn();
    const documents = {
      course: { contentSource: 'admin', contentType: 'COURSE', contentId: 'canonical-course', version: 2, content: { courseId: 'canonical-course', title: 'Course', modules: [{ lessons: [{ id: 'lesson-1', title: 'Lesson' }] }] } },
      project: { contentSource: 'admin', contentType: 'PROJECT', contentId: 'bingo', version: 1, content: { projectId: 'bingo', title: 'Bingo', checkpoints: [{ checkpointId: 'bingo-c1', title: 'Start', tasks: [] }] } },
    };
    const canonical = { get: vi.fn(async ({ surface }) => documents[surface]) };
    const resolve = createTutorScopeResolver({ contentSource: new CompositeTutorContentSource({ canonical, fallbackFactory }) });
    await expect(resolve({ body: { tutorScope: { surface: 'course', scopeId: 'canonical-course', activityId: 'lesson-1' } } })).resolves.toMatchObject({ contentSource: 'admin', contentVersion: 2 });
    await expect(resolve({ body: { tutorScope: { surface: 'project', scopeId: 'bingo', activityId: 'bingo-c1', checkpointId: 'bingo-c1', contentVersion: 1 } } })).resolves.toMatchObject({ contentSource: 'admin', contentVersion: 1 });
    expect(canonical.get).toHaveBeenCalledTimes(2);
    expect(fallbackFactory).not.toHaveBeenCalled();
  });

  it('falls back only for an explicit unversioned canonical not-published result', async () => {
    const absent = Object.assign(new Error('absent'), { contentSourceFailure: 'not-published' });
    const fallback = { get: vi.fn(async () => ({ contentSource: 'legacy-course' })) };
    const fallbackFactory = vi.fn(async () => ({ source: fallback, close: vi.fn() }));
    const source = new CompositeTutorContentSource({ canonical: { get: vi.fn(async () => { throw absent; }) }, fallbackFactory });
    await expect(source.get({ surface: 'course', contentId: 'python' })).resolves.toMatchObject({ contentSource: 'legacy-course' });
    expect(fallbackFactory).toHaveBeenCalledOnce();
    for (const error of [Object.assign(new Error('forbidden'), { status: 403 }), Object.assign(new Error('malformed'), { code: 'ai/content-unavailable' })]) {
      const guarded = new CompositeTutorContentSource({ canonical: { get: vi.fn(async () => { throw error; }) }, fallbackFactory });
      await expect(guarded.get({ surface: 'course', contentId: 'python' })).rejects.toBe(error);
    }
    expect(fallbackFactory).toHaveBeenCalledOnce();
  });

  it('recognizes only the exact Admin 404 content/not-published response as fallback-eligible', async () => {
    const fallbackFactory = vi.fn(async () => ({ source: { get: async () => ({ contentSource: 'legacy-course' }) }, close: vi.fn() }));
    const response = (status, payload) => ({ ok: false, status, json: async () => payload });
    const eligible = new CompositeTutorContentSource({
      canonical: new CanonicalTutorContentSource({ fetcher: async () => response(404, { error: { code: 'content/not-published' } }) }),
      fallbackFactory,
    });
    await expect(eligible.get({ surface: 'course', contentId: 'python' })).resolves.toMatchObject({ contentSource: 'legacy-course' });
    for (const [status, payload] of [[403, { error: { code: 'content/not-published' } }], [404, null], [500, { error: { code: 'content/not-published' } }]]) {
      const guarded = new CompositeTutorContentSource({
        canonical: new CanonicalTutorContentSource({ fetcher: async () => response(status, payload) }),
        fallbackFactory,
      });
      await expect(guarded.get({ surface: 'course', contentId: 'python' })).rejects.toMatchObject({ code: 'ai/content-unavailable' });
    }
    expect(fallbackFactory).toHaveBeenCalledOnce();
  });

  it('sanitizes unexpected fallback infrastructure failures', async () => {
    const absent = Object.assign(new Error('absent'), { contentSourceFailure: 'not-published' });
    const source = new CompositeTutorContentSource({
      canonical: { get: vi.fn(async () => { throw absent; }) },
      fallbackFactory: vi.fn(async () => { throw new Error('internal storage detail'); }),
    });
    await expect(source.get({ surface: 'practice', contentId: 'fund-variables-008' })).rejects.toMatchObject({ code: 'ai/content-unavailable', status: 503 });
  });
});
