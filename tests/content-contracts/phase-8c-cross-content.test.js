import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { CONTENT_SCHEMA_VERSION, validateContent } from '../../shared/content/index.js';
import { hasAdminPermission, ADMIN_PERMISSIONS } from '../../shared/admin/adminAuthorization.js';
import { ContentPublicationService } from '../../server/admin/content/ContentPublicationService.js';
import { PublishedContentService } from '../../server/admin/content/PublishedContentService.js';
import { InMemoryArtifactStore, InMemoryContentPublicationStore } from '../../server/admin/content/InMemoryContentPublicationStore.js';
import { createAdminContentApiRouter } from '../../server/admin/content/adminContentApiRouter.js';
import { createTaskProgressionFixture, createMiniCourseFixture, createPracticeFixture } from './fixtures.js';

const documents = () => [createTaskProgressionFixture(), createMiniCourseFixture(), createPracticeFixture()];
const actor = (role = 'SUPER_ADMIN') => ({ uid: `user-${role}`, role });
const setup = (assets) => {
  const store = new InMemoryContentPublicationStore();
  const artifacts = new InMemoryArtifactStore();
  return { store, artifacts, service: new ContentPublicationService({ store, artifacts, assets, clock: () => new Date('2026-10-05T00:00:00.000Z') }), delivery: new PublishedContentService({ store, artifacts }) };
};
const response = () => ({ statusCode: 0, setHeader() {}, status(code) { this.statusCode = code; return this; }, json(value) { this.value = value; return value; } });

describe('Phase 8C shared Project/Course/Practice acceptance', () => {
  it('keeps a shared envelope and separate valid internal schemas', () => {
    for (const document of documents()) {
      expect(document).toEqual(expect.objectContaining({ contentId: expect.any(String), contentType: expect.any(String), schemaVersion: CONTENT_SCHEMA_VERSION, version: 1, status: 'draft', locale: 'en', metadata: expect.any(Object), content: expect.any(Object) }));
      expect(validateContent(document).valid).toBe(true);
    }
    expect(documents().map(({ contentType }) => contentType)).toEqual(['PROJECT', 'COURSE', 'PRACTICE']);
  });

  it('coexists through draft, immutable publication, independent pointers, rollback, archive and audit', async () => {
    const { store, artifacts, service, delivery } = setup();
    for (const document of documents()) {
      const draft = await service.saveDraft({ actor: actor(), document });
      expect(draft.draftRevision).toBe(1);
      expect((await service.getDraft(document.contentId)).document).toEqual(document);
      await expect(service.saveDraft({ actor: actor(), document, expectedRevision: 0 })).rejects.toMatchObject({ code: 'content/draft-conflict' });
      expect((await service.validateDraft({ actor: actor(), contentId: document.contentId, expectedRevision: 1 })).valid).toBe(true);
      const first = await service.publish({ actor: actor(), contentId: document.contentId, expectedRevision: 1 });
      expect(first.version).toMatchObject({ contentType: document.contentType, status: 'READY', artifactHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
      expect(first.version.artifactPath).toBe(`published-content/${document.contentType.toLowerCase()}s/${document.contentId}/v1.json`);
      expect(createHash('sha256').update(await artifacts.read(first.version.artifactPath)).digest('hex')).toBe(first.version.artifactHash);
      await expect(artifacts.createImmutable(first.version.artifactPath, Buffer.from('{}'))).rejects.toThrow();
      const changed = structuredClone(document); changed.metadata.release = 2;
      await service.saveDraft({ actor: actor(), document: changed, expectedRevision: 1 });
      await service.publish({ actor: actor(), contentId: document.contentId, expectedRevision: 2, expectedActiveRevision: 1 });
      expect((await delivery.resolveActive(document.contentId)).document.version).toBe(2);
    }
    expect((await delivery.listActive('PROJECT')).map(({ contentId }) => contentId)).toEqual(['phase-7-task-progression-fixture']);
    expect((await delivery.listActive('COURSE')).map(({ contentId }) => contentId)).toEqual(['python-mini-fundamentals']);
    expect((await delivery.listActive('PRACTICE')).map(({ contentId }) => contentId)).toEqual(['print-greeting']);
    for (const document of documents()) {
      await service.activate({ actor: actor(), contentId: document.contentId, version: 1, expectedActiveRevision: 2 });
      expect((await delivery.resolveActive(document.contentId)).document.version).toBe(1);
      await service.archive({ actor: actor(), contentId: document.contentId, expectedActiveRevision: 3 });
      expect(await delivery.resolveActive(document.contentId)).toBeNull();
      expect((await delivery.fetchVersion(document.contentId, 2)).document.version).toBe(2);
      for (const event of ['CONTENT_PUBLISHED', 'CONTENT_ACTIVATED', 'CONTENT_ROLLED_BACK', 'CONTENT_ARCHIVED']) {
        expect(store.audit).toContainEqual(expect.objectContaining({ event, contentId: document.contentId, contentType: document.contentType }));
      }
    }
    expect(artifacts.files.size).toBe(6);
    expect(store.audit.every((entry) => !('content' in entry) && !('document' in entry))).toBe(true);
  });

  it('rejects reuse of a content ID by another type instead of colliding pointers', async () => {
    const { service } = setup();
    const project = createTaskProgressionFixture();
    await service.saveDraft({ actor: actor(), document: project });
    const course = createMiniCourseFixture();
    course.contentId = project.contentId;
    await expect(service.saveDraft({ actor: actor(), document: course, expectedRevision: 1 })).rejects.toMatchObject({ code: 'content/type-conflict' });
  });

  it.each(documents())('rejects forged %s request types at the server boundary', async (document) => {
    const { service, delivery } = setup();
    await service.saveDraft({ actor: actor(), document });
    const router = createAdminContentApiRouter({ dependencies: async () => ({ service, delivery }), authorize: async () => actor() });
    const other = documents().find(({ contentType }) => contentType !== document.contentType).contentType;
    const forgedSave = response();
    await router({ method: 'POST', query: { path: ['drafts'] }, body: { contentType: other, document, expectedRevision: 1 } }, forgedSave);
    expect(forgedSave.statusCode).toBe(409);
    const forgedPublish = response();
    await router({ method: 'POST', query: { path: ['publish'] }, body: { contentType: other, contentId: document.contentId, expectedRevision: 1 } }, forgedPublish);
    expect(forgedPublish.statusCode).toBe(409);
    expect(await service.pointer(document.contentId)).toBeNull();
  });

  it('enforces the shared permission matrix server-side for every content type', async () => {
    for (const document of documents()) {
      for (const role of ['SUPER_ADMIN', 'CONTENT_ADMIN', 'CONTENT_EDITOR', 'CONTENT_REVIEWER']) {
        const service = {
          getDraft: vi.fn().mockResolvedValue({ contentType: document.contentType, document }),
          saveDraft: vi.fn().mockResolvedValue({ contentId: document.contentId }),
          validateDraft: vi.fn().mockResolvedValue({ valid: true }),
          publish: vi.fn().mockResolvedValue({ version: { version: 2 } }),
          activate: vi.fn().mockResolvedValue({ activeVersion: 1 }),
          archive: vi.fn().mockResolvedValue({ publicationStatus: 'ARCHIVED' }),
        };
        const authorize = vi.fn(async (_request, permission) => {
          if (!hasAdminPermission(role, permission)) throw Object.assign(new Error('Denied'), { status: 403, code: 'admin/permission-denied' });
          return actor(role);
        });
        const router = createAdminContentApiRouter({ dependencies: async () => ({ service, delivery: {} }), authorize });
        for (const [path, permission, method] of [
          ['drafts', ADMIN_PERMISSIONS.CONTENT_EDIT, 'saveDraft'],
          ['validate', ADMIN_PERMISSIONS.CONTENT_VALIDATE, 'validateDraft'],
          ['publish', ADMIN_PERMISSIONS.CONTENT_PUBLISH, 'publish'],
          ['rollback', ADMIN_PERMISSIONS.CONTENT_PUBLISH, 'activate'],
          ['archive', ADMIN_PERMISSIONS.CONTENT_PUBLISH, 'archive'],
        ]) {
          const reply = response();
          await router({ method: 'POST', query: { path: [path] }, body: { contentType: document.contentType, contentId: document.contentId, document, expectedRevision: 1, version: 1, expectedActiveRevision: 2 } }, reply);
          expect(reply.statusCode).toBe(hasAdminPermission(role, permission) ? (path === 'publish' ? 201 : 200) : 403);
          expect(service[method]).toHaveBeenCalledTimes(hasAdminPermission(role, permission) ? 1 : 0);
        }
      }
    }
  });

  it('blocks publication with a missing referenced image asset', async () => {
    const { service } = setup({ exists: async () => false });
    const document = createMiniCourseFixture();
    document.content.modules[0].lessons[0].blocks.push({ id: 'missing-image', type: 'image', assetId: 'missing-media', alt: 'missing' });
    const draft = await service.saveDraft({ actor: actor(), document });
    await expect(service.publish({ actor: actor(), contentId: document.contentId, expectedRevision: draft.draftRevision })).rejects.toMatchObject({ code: 'content/asset-missing' });
  });
});
