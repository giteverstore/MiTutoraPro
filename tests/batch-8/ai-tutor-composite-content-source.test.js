import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { CompositeTutorContentSource } from '../../server/ai/tutor/CompositeTutorContentSource.js';
import { CanonicalTutorContentSource } from '../../server/ai/tutor/CanonicalTutorContentSource.js';
import { createFirebaseTutorContentSource, FirebaseTutorContentSource } from '../../server/ai/tutor/FirebaseTutorContentSource.js';
import { createTutorScopeResolver } from '../../server/ai/tutor/resolveTutorScope.js';
import { publicAIError } from '../../server/ai/explainHandler.js';
import { createTutorContentFailureLog } from '../../server/ai/tutor/tutorContentDiagnostics.js';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const bytes = (value) => Buffer.from(JSON.stringify(value));
const snapshot = (value, id) => ({ exists: value != null, id, data: () => value });

function database(records) {
  const reads = [];
  const db = {
    doc: (path) => ({ path, get: async () => { reads.push(path); return snapshot(records[path], path.split('/').at(-1)); } }),
    getAll: vi.fn(async (...refs) => { reads.push(...refs.map(({ path }) => path)); return refs.map(({ path }) => snapshot(records[path], path.split('/').at(-1))); }),
  };
  return { db, reads };
}

function courseFixture(id, version, lessonId) {
  const manifest = { id, title: `${id} course`, moduleFiles: ['module-1.json'], navigation: { defaultLessonId: lessonId }, modules: [{ id: 'module-1', title: 'Module', sections: [{ id: 'section-1', lessons: [{ id: lessonId, title: `${id} lesson`, summary: 'Authoritative summary', blocks: [] }] }] }] };
  const content = bytes(manifest);
  return {
    manifest, content,
    records: {
      [`courses/${id}`]: { id, published: true, version, storagePath: `course-content/${id}`, moduleCount: 1, lessonCount: 1 },
    },
  };
}

function practiceFixture() {
  const question = { id: 'fund-variables-008', title: 'Reason About Four Values', summary: 'Identify the types.', topic: 'variables', difficulty: 'easy', blocks: [] };
  const content = bytes(question);
  return {
    question, content,
    records: {
      'contentPublications/practice-python': { status: 'ACTIVE', activeVersion: 'v3', integrityRequired: true },
      'practiceQuestions/fund-variables-008': { published: true, version: 'v3', storagePath: 'practice/python/question-8.json', contentHash: hash(content) },
    },
  };
}

describe('composite Tutor content authority', () => {
  it('allowlists every fallback diagnostic reason without accepting arbitrary backend fields', () => {
    const reasons = [
      'canonical-miss', 'fallback-config-missing', 'metadata-read-failed', 'publication-not-found',
      'version-invalid', 'metadata-identity-mismatch', 'manifest-read-failed', 'storage-object-missing',
      'storage-read-denied', 'integrity-mismatch', 'content-identity-mismatch', 'lesson-not-found',
      'practice-question-not-found',
    ];
    for (const reason of reasons) {
      expect(createTutorContentFailureLog({ reason, surface: 'course', source: 'legacy-course', secret: 'SECRET' })).toEqual({
        operation: 'ai-tutor-content-resolution', reason, surface: 'course', source: 'legacy-course',
      });
    }
    expect(createTutorContentFailureLog({ reason: 'SECRET backend response', surface: 'course', source: 'legacy-course' })).toBeNull();
  });

  it.each([
    ['python', 'v2', 'lesson-1-1-introduction-to-python'],
    ['java', 'v1', 'java-lesson-1-1-1-getting-started-with-java'],
  ])('resolves approved legacy Course %s from its learner metadata authority and manifest', async (id, version, lessonId) => {
    const fixture = courseFixture(id, version, lessonId);
    const { db } = database(fixture.records);
    const loadBytes = vi.fn(async () => fixture.content);
    const source = new FirebaseTutorContentSource({ db, loadBytes });
    const resolve = createTutorScopeResolver({ contentSource: source });
    await expect(resolve({ body: { tutorScope: { surface: 'course', scopeId: id, activityId: lessonId } } })).resolves.toMatchObject({
      surface: 'course', scopeId: id, activityId: lessonId, contentSource: 'legacy-course', contentVersion: version,
    });
    expect(db.getAll).toHaveBeenCalledOnce();
    expect(db.getAll.mock.calls[0]).toHaveLength(1);
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
    ['course identity mismatch', (fixture) => { fixture.records['courses/python'].id = 'java'; }, 'metadata-identity-mismatch'],
    ['invalid version', (fixture) => { fixture.records['courses/python'].version = '2'; }, 'version-invalid'],
    ['integrity failure', (fixture) => { fixture.records['courses/python'].contentIntegrity = { algorithm: 'sha256', manifest: '0'.repeat(64), modules: {} }; }, 'integrity-mismatch'],
  ])('rejects legacy Course %s', async (_label, alter, reason) => {
    const fixture = courseFixture('python', 'v2', 'lesson-1'); alter(fixture);
    const { db } = database(fixture.records);
    const source = new FirebaseTutorContentSource({ db, loadBytes: async () => fixture.content });
    await expect(source.get({ surface: 'course', contentId: 'python' })).rejects.toMatchObject({ code: 'ai/content-unavailable', tutorContentFailureReason: reason });
  });

  it('resolves an ACTIVE integrity-checked Practice question with question identity as scope identity', async () => {
    const fixture = practiceFixture(); const { db } = database(fixture.records); const loadBytes = vi.fn(async () => fixture.content);
    const resolve = createTutorScopeResolver({ contentSource: new FirebaseTutorContentSource({ db, loadBytes }) });
    await expect(resolve({ body: { tutorScope: { surface: 'practice', scopeId: fixture.question.id, activityId: fixture.question.id } } })).resolves.toMatchObject({
      surface: 'practice', scopeId: fixture.question.id, activityId: fixture.question.id, contentSource: 'firebase-practice', contentVersion: 'v3', practiceQuestionId: fixture.question.id,
    });
    expect(db.getAll).toHaveBeenCalledOnce();
    expect(loadBytes).toHaveBeenCalledOnce();
    expect(loadBytes.mock.calls[0][0]).toBe('practice/python/v3/question-8.json');
  });

  it.each([
    ['unknown question', (fixture) => { delete fixture.records['practiceQuestions/fund-variables-008']; }, 'practice-question-not-found'],
    ['inactive version', (fixture) => { fixture.records['contentPublications/practice-python'].activeVersion = 'v2'; }, 'version-invalid'],
    ['question identity mismatch', (fixture) => { fixture.question.id = 'forged'; fixture.content = bytes(fixture.question); fixture.records['practiceQuestions/fund-variables-008'].contentHash = hash(fixture.content); }, 'content-identity-mismatch'],
    ['integrity failure', (fixture) => { fixture.records['practiceQuestions/fund-variables-008'].contentHash = '0'.repeat(64); }, 'integrity-mismatch'],
  ])('rejects Practice %s', async (_label, alter, reason) => {
    const fixture = practiceFixture(); alter(fixture); const { db } = database(fixture.records);
    const source = new FirebaseTutorContentSource({ db, loadBytes: async () => fixture.content });
    await expect(source.get({ surface: 'practice', contentId: 'fund-variables-008' })).rejects.toMatchObject({ code: 'ai/content-unavailable', tutorContentFailureReason: reason });
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

  it('classifies missing server-only bucket configuration without reading browser configuration', async () => {
    let error;
    try {
      await createFirebaseTutorContentSource({
        environment: { VITE_FIREBASE_STORAGE_BUCKET: 'browser-only.example' },
        credentials: { authClient: { request: vi.fn() } },
      });
    } catch (caught) { error = caught; }
    expect(error).toMatchObject({ code: 'ai/content-unavailable', tutorContentFailureReason: 'fallback-config-missing' });
    expect(publicAIError(error)).toEqual({
      status: 503,
      body: { error: { code: 'ai/content-unavailable', message: 'The requested learning content is unavailable.', retryable: true } },
    });
  });

  it.each([
    [403, 'storage-read-denied'],
    [404, 'storage-object-missing'],
    [500, 'manifest-read-failed'],
  ])('classifies Storage HTTP %s without exposing backend details', async (status, reason) => {
    const fixture = courseFixture('python', 'v2', 'lesson-1');
    const { db } = database(fixture.records);
    const cause = Object.assign(new Error('SECRET backend response'), { response: { status } });
    let error;
    try { await new FirebaseTutorContentSource({ db, loadBytes: async () => { throw cause; } }).get({ surface: 'course', contentId: 'python' }); }
    catch (caught) { error = caught; }
    expect(error).toMatchObject({ code: 'ai/content-unavailable', tutorContentFailureReason: reason });
    expect(JSON.stringify(publicAIError(error))).not.toContain('SECRET');
  });

  it('classifies missing Course metadata without requiring a second publication authority', async () => {
    const { db } = database({});
    await expect(new FirebaseTutorContentSource({ db, loadBytes: vi.fn() }).get({ surface: 'course', contentId: 'python' }))
      .rejects.toMatchObject({ code: 'ai/content-unavailable', tutorContentFailureReason: 'publication-not-found' });
  });

  it('uses the Practice document ID as mandatory metadata identity and rejects an artifact mismatch', async () => {
    const fixture = practiceFixture();
    fixture.question.id = 'forged-question';
    fixture.content = bytes(fixture.question);
    fixture.records['practiceQuestions/fund-variables-008'].contentHash = hash(fixture.content);
    const { db } = database(fixture.records);
    await expect(new FirebaseTutorContentSource({ db, loadBytes: async () => fixture.content }).get({ surface: 'practice', contentId: 'fund-variables-008' }))
      .rejects.toMatchObject({ code: 'ai/content-unavailable', tutorContentFailureReason: 'content-identity-mismatch' });
  });

  it('rejects a Practice metadata snapshot whose document identity differs from the requested scope', async () => {
    const fixture = practiceFixture();
    const refs = [];
    const db = {
      doc: (path) => { const ref = { path }; refs.push(ref); return ref; },
      getAll: vi.fn(async () => [
        snapshot(fixture.records['contentPublications/practice-python'], 'practice-python'),
        snapshot(fixture.records['practiceQuestions/fund-variables-008'], 'different-question'),
      ]),
    };
    await expect(new FirebaseTutorContentSource({ db, loadBytes: async () => fixture.content }).get({ surface: 'practice', contentId: 'fund-variables-008' }))
      .rejects.toMatchObject({ code: 'ai/content-unavailable', tutorContentFailureReason: 'metadata-identity-mismatch' });
    expect(refs.map(({ path }) => path)).toEqual(['contentPublications/practice-python', 'practiceQuestions/fund-variables-008']);
  });

  it('classifies invalid legacy Course lesson membership without weakening the public activity error', async () => {
    const fixture = courseFixture('python', 'v2', 'lesson-1');
    const { db } = database(fixture.records);
    const events = [];
    const resolve = createTutorScopeResolver({
      contentSource: new FirebaseTutorContentSource({ db, loadBytes: async () => fixture.content }),
      failureLogger: (event) => events.push(event),
    });
    await expect(resolve({ body: { tutorScope: { surface: 'course', scopeId: 'python', activityId: 'missing-lesson' } } }))
      .rejects.toMatchObject({ code: 'ai/activity-invalid', status: 400 });
    expect(events).toEqual([{
      operation: 'ai-tutor-content-resolution', reason: 'lesson-not-found', surface: 'course', source: 'legacy-course',
    }]);
  });

  it('emits only allowlisted fallback diagnostics and keeps Projects out of Firebase fallback', async () => {
    const events = [];
    const absent = Object.assign(new Error('SECRET canonical payload'), { contentSourceFailure: 'not-published' });
    const fallbackError = Object.assign(new Error('SECRET storage response'), { code: 'ai/content-unavailable', status: 503, tutorContentFailureReason: 'storage-read-denied' });
    const fallbackFactory = vi.fn(async () => ({ source: { get: async () => { throw fallbackError; } }, close: vi.fn() }));
    const source = new CompositeTutorContentSource({ canonical: { get: vi.fn(async () => { throw absent; }) }, fallbackFactory, failureLogger: (event) => events.push(event) });
    await expect(source.get({ surface: 'course', contentId: 'python' })).rejects.toMatchObject({ code: 'ai/content-unavailable', status: 503 });
    expect(events).toEqual([
      { operation: 'ai-tutor-content-resolution', reason: 'canonical-miss', surface: 'course', source: 'admin' },
      { operation: 'ai-tutor-content-resolution', reason: 'storage-read-denied', surface: 'course', source: 'legacy-course' },
    ]);
    expect(JSON.stringify(events)).not.toContain('SECRET');
    await expect(source.get({ surface: 'project', contentId: 'bingo' })).rejects.toBe(absent);
    expect(fallbackFactory).toHaveBeenCalledOnce();
  });
});
