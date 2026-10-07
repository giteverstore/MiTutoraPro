import { describe, expect, it, vi } from 'vitest';
import { ContentPublicationService } from '../../server/admin/content/ContentPublicationService.js';
import { InMemoryArtifactStore, InMemoryContentPublicationStore } from '../../server/admin/content/InMemoryContentPublicationStore.js';
import { CourseCompletionService } from '../../functions/src/certification/CourseCompletionService.js';
import { createAdminContentApiRouter } from '../../server/admin/content/adminContentApiRouter.js';
import { ADMIN_PERMISSIONS, hasAdminPermission } from '../../shared/admin/adminAuthorization.js';
import { createMiniCourseFixture } from './fixtures.js';

const actor = { uid: 'course-admin', role: 'SUPER_ADMIN' };
const snapshot = (value) => ({ exists: value != null, data: () => value ?? undefined });

function setup() {
  const store = new InMemoryContentPublicationStore();
  const artifacts = new InMemoryArtifactStore();
  const documents = new Map();
  const db = {
    doc(path) {
      return {
        async get() {
          if (path.startsWith('publishedContent/')) {
            const [, id, , version] = path.split('/');
            return snapshot(version ? await store.getVersion(id, Number(version)) : await store.getPointer(id));
          }
          return snapshot(documents.get(path));
        },
        async set(value) { documents.set(path, value); },
        async update(patch) { documents.set(path, { ...documents.get(path), ...patch }); },
      };
    },
    async runTransaction(callback) {
      return callback({ get: (ref) => ref.get(), set: (ref, value) => ref.set(value), update: (ref, patch) => ref.update(patch) });
    },
  };
  const bucket = { file: (path) => ({ download: async () => [await artifacts.read(path)] }) };
  const publication = new ContentPublicationService({ store, artifacts });
  const completion = new CourseCompletionService({ db, bucket, readingMinimumMs: 0 });
  const publish = async (document, expectedRevision = 0, expectedActiveRevision = null) => {
    const saved = await publication.saveDraft({ actor, document, expectedRevision });
    return publication.publish({ actor, contentId: document.contentId, expectedRevision: saved.draftRevision, expectedActiveRevision });
  };
  return { store, artifacts, documents, publication, completion, publish };
}

describe('canonical Course trusted completion', () => {
  it('loads the immutable artifact, grades a quiz, and retains pinned evidence after v2 and archive', async () => {
    const { documents, publication, completion, publish } = setup();
    const v1 = createMiniCourseFixture();
    await publish(v1);
    const first = await completion.beginLessonEvidence('learner-one', { courseId: v1.contentId, courseVersion: 1, lessonId: 'quiz' });
    const graded = await completion.recordLessonCompletion('learner-one', { courseId: v1.contentId, courseVersion: 1, lessonId: 'quiz', evidence: { sessionId: first.sessionId, challenge: first.challenge, answers: { 'quiz-one': ['print'] } } });
    expect(graded.completedLessons).toBe(1);
    const v2 = structuredClone(v1); v2.content.title = 'Python Mini v2';
    await publish(v2, 1, 1);
    await expect(completion.beginLessonEvidence('unbound-learner', { courseId: v1.contentId, courseVersion: 1, lessonId: 'hello' })).rejects.toMatchObject({ code: 'permission-denied' });
    documents.set(`users/learner-one/progress/${v1.contentId}`, { contentVersion: 1 });
    const pinned = await completion.beginLessonEvidence('learner-one', { courseId: v1.contentId, courseVersion: 1, lessonId: 'hello' });
    expect(pinned.courseVersion).toBe(1);
    await publication.archive({ actor, contentId: v1.contentId, expectedActiveRevision: 2 });
    expect((await completion.beginLessonEvidence('learner-one', { courseId: v1.contentId, courseVersion: 1, lessonId: 'hello' })).courseVersion).toBe(1);
  });

  it('rejects a corrupted canonical artifact before issuing evidence', async () => {
    const { store, artifacts, completion, publish } = setup();
    const course = createMiniCourseFixture();
    await publish(course);
    const metadata = await store.getVersion(course.contentId, 1);
    artifacts.files.set(metadata.artifactPath, Buffer.from('{"tampered":true}'));
    await expect(completion.beginLessonEvidence('learner', { courseId: course.contentId, courseVersion: 1, lessonId: 'hello' })).rejects.toMatchObject({ code: 'data-loss' });
  });
});

describe('Course publication authorization', () => {
  it.each([
    ['SUPER_ADMIN', 201], ['CONTENT_ADMIN', 201], ['CONTENT_EDITOR', 403], ['CONTENT_REVIEWER', 403],
  ])('enforces server publish permission for %s', async (role, expectedStatus) => {
    const publish = vi.fn().mockResolvedValue({ version: { version: 1 } });
    const authorize = async (_request, permission) => {
      expect(permission).toBe(ADMIN_PERMISSIONS.CONTENT_PUBLISH);
      if (!hasAdminPermission(role, permission)) throw Object.assign(new Error('Permission denied.'), { status: 403, code: 'admin/permission-denied' });
      return { uid: 'course-admin', role };
    };
    const router = createAdminContentApiRouter({ dependencies: async () => ({ service: { getDraft: async () => ({ contentType: 'COURSE', document: { contentType: 'COURSE' } }), publish }, delivery: {} }), authorize });
    const response = { statusCode: 0, setHeader() {}, status(statusCode) { this.statusCode = statusCode; return this; }, json(payload) { this.payload = payload; return payload; } };
    await router({ method: 'POST', query: { path: ['publish'] }, body: { contentType: 'COURSE', contentId: 'python-mini-fundamentals', expectedRevision: 1 } }, response);
    expect(response.statusCode).toBe(expectedStatus);
    expect(publish).toHaveBeenCalledTimes(expectedStatus === 201 ? 1 : 0);
  });
});
