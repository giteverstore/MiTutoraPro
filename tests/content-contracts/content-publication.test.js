import { describe, expect, it, vi } from 'vitest';
import { ADMIN_PERMISSIONS } from '../../shared/admin/adminAuthorization.js';
import { ContentPublicationService } from '../../server/admin/content/ContentPublicationService.js';
import { PublishedContentService } from '../../server/admin/content/PublishedContentService.js';
import { InMemoryArtifactStore, InMemoryContentPublicationStore } from '../../server/admin/content/InMemoryContentPublicationStore.js';
import { createAdminContentApiRouter } from '../../server/admin/content/adminContentApiRouter.js';
import { PublishedContentRepository } from '../../src/projects/repositories/PublishedContentRepository.js';
import { ProjectProgressService } from '../../src/projects/services/ProjectProgressService.js';
import { createBingoContractFixture } from './fixtures.js';

const actor = (role = 'SUPER_ADMIN') => ({ uid: `user-${role}`, role });
const setup = () => {
  const store = new InMemoryContentPublicationStore();
  const artifacts = new InMemoryArtifactStore();
  const service = new ContentPublicationService({ store, artifacts, clock: () => new Date('2026-10-05T00:00:00.000Z') });
  const delivery = new PublishedContentService({ store, artifacts });
  return { store, artifacts, service, delivery };
};
const save = (service, document = createBingoContractFixture(), expectedRevision = 0) => service.saveDraft({ actor: actor(), document, expectedRevision });

describe('Phase 6 content publication lifecycle', () => {
  it('creates, updates, reloads, and rejects stale draft writes', async () => {
    const { service } = setup();
    const first = await save(service);
    expect(first.draftRevision).toBe(1);
    const updated = await service.saveDraft({ actor: actor('CONTENT_EDITOR'), document: { ...first.document, metadata: { updated: true } }, expectedRevision: 1 });
    expect(updated.draftRevision).toBe(2);
    expect((await service.getDraft(first.contentId)).updatedBy).toBe('user-CONTENT_EDITOR');
    await expect(save(service, first.document, 1)).rejects.toMatchObject({ code: 'content/draft-conflict', status: 409 });
  });

  it('allows only one of two simultaneous stale draft saves', async () => {
    const { service } = setup();
    const document = createBingoContractFixture();
    const results = await Promise.allSettled([save(service, document), save(service, document)]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(({ status }) => status === 'rejected')[0].reason).toMatchObject({ code: 'content/draft-conflict' });
  });

  it('publishes immutable hashed versions monotonically and pins exact delivery', async () => {
    const { service, store, artifacts, delivery } = setup();
    const first = await save(service);
    const published1 = await service.publish({ actor: actor(), contentId: first.contentId, expectedRevision: 1 });
    expect(published1.version).toMatchObject({ version: 1, status: 'READY', artifactSize: expect.any(Number), artifactHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    await expect(artifacts.createImmutable(published1.version.artifactPath, Buffer.from('{}'))).rejects.toThrow('already exists');
    const secondDraft = await service.saveDraft({ actor: actor(), document: { ...first.document, metadata: { release: 2 } }, expectedRevision: 1 });
    const published2 = await service.publish({ actor: actor(), contentId: first.contentId, expectedRevision: secondDraft.draftRevision, expectedActiveRevision: 1 });
    expect(published2.version.version).toBe(2);
    expect((await delivery.resolveActive(first.contentId)).document.version).toBe(2);
    expect((await delivery.fetchVersion(first.contentId, 1)).document.version).toBe(1);
    expect((await store.listVersions(first.contentId)).map(({ version }) => version)).toEqual([2, 1]);
  });

  it('leaves ACTIVE unchanged when artifact publication fails', async () => {
    const { service, store } = setup();
    const first = await save(service);
    await service.publish({ actor: actor(), contentId: first.contentId, expectedRevision: 1 });
    const second = await service.saveDraft({ actor: actor(), document: { ...first.document, metadata: { next: true } }, expectedRevision: 1 });
    service.artifacts = { createImmutable: async () => { throw new Error('storage down'); }, read: vi.fn() };
    await expect(service.publish({ actor: actor(), contentId: first.contentId, expectedRevision: second.draftRevision, expectedActiveRevision: 1 })).rejects.toMatchObject({ code: 'content/publication-failed' });
    expect((await store.getPointer(first.contentId)).activeVersion).toBe(1);
    expect((await store.getVersion(first.contentId, 2)).status).toBe('FAILED');
  });

  it('serializes simultaneous publish attempts without duplicate versions', async () => {
    const { service, store } = setup();
    const draft = await save(service);
    const results = await Promise.allSettled([
      service.publish({ actor: actor(), contentId: draft.contentId, expectedRevision: 1 }),
      service.publish({ actor: actor('CONTENT_ADMIN'), contentId: draft.contentId, expectedRevision: 1 }),
    ]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect((await store.listVersions(draft.contentId)).map(({ version }) => version).sort()).toEqual([1, 2]);
    expect((await store.listVersions(draft.contentId)).filter(({ status }) => status === 'READY')).toHaveLength(1);
  });

  it('protects publish/rollback concurrency and retains archived pinned versions', async () => {
    const { service, store, delivery } = setup();
    const first = await save(service);
    await service.publish({ actor: actor(), contentId: first.contentId, expectedRevision: 1 });
    const second = await service.saveDraft({ actor: actor(), document: { ...first.document, metadata: { next: true } }, expectedRevision: 1 });
    await service.publish({ actor: actor(), contentId: first.contentId, expectedRevision: second.draftRevision, expectedActiveRevision: 1 });
    await service.activate({ actor: actor('CONTENT_ADMIN'), contentId: first.contentId, version: 1, expectedActiveRevision: 2 });
    await expect(service.activate({ actor: actor(), contentId: first.contentId, version: 2, expectedActiveRevision: 2 })).rejects.toMatchObject({ code: 'content/active-conflict' });
    expect((await store.listVersions(first.contentId))).toHaveLength(2);
    await service.archive({ actor: actor(), contentId: first.contentId, expectedActiveRevision: 3 });
    expect(await delivery.resolveActive(first.contentId)).toBeNull();
    expect((await delivery.fetchVersion(first.contentId, 2)).document.version).toBe(2);
  });

  it('fails closed for corrupted artifacts', async () => {
    const { service, artifacts, delivery } = setup();
    const draft = await save(service);
    const result = await service.publish({ actor: actor(), contentId: draft.contentId, expectedRevision: 1 });
    artifacts.files.set(result.version.artifactPath, Buffer.from('{"tampered":true}'));
    await expect(delivery.fetchVersion(draft.contentId, 1)).rejects.toMatchObject({ code: 'content/artifact-corrupt' });
  });

  it('uses legacy fallback only when no ACTIVE publication exists', async () => {
    const legacy = { id: 'legacy-project', title: 'Legacy' };
    const repository = new PublishedContentRepository({
      fetcher: async () => ({ ok: false, json: async () => ({ error: { code: 'content/not-published' } }) }),
      legacyCatalog: { getProjectById: () => legacy },
    });
    await expect(repository.resolveProject('legacy-project')).resolves.toEqual({ source: 'legacy', contentVersion: null, document: null, project: legacy });
  });

  it('pins the first resolved content version and never silently upgrades it', () => {
    const values = new Map();
    const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
    const progress = new ProjectProgressService({ storage });
    progress.start('project-one', 'python', 3);
    expect(progress.get('project-one').contentVersion).toBe(3);
    progress.start('project-one', 'python', 4);
    expect(progress.get('project-one').contentVersion).toBe(3);
  });

  it.each([
    ['SUPER_ADMIN', ADMIN_PERMISSIONS.CONTENT_PUBLISH],
    ['CONTENT_ADMIN', ADMIN_PERMISSIONS.CONTENT_PUBLISH],
    ['CONTENT_EDITOR', ADMIN_PERMISSIONS.CONTENT_PUBLISH],
    ['CONTENT_REVIEWER', ADMIN_PERMISSIONS.CONTENT_PUBLISH],
  ])('routes publish through server permission enforcement for %s', async (role, permission) => {
    const authorize = vi.fn(async (_request, requested) => { if (['CONTENT_EDITOR', 'CONTENT_REVIEWER'].includes(role)) { const error = new Error('denied'); error.status = 403; error.code = 'admin/permission-denied'; throw error; } return actor(role); });
    const service = { getDraft: vi.fn().mockResolvedValue({ contentType: 'PROJECT', document: { contentType: 'PROJECT' } }), publish: vi.fn().mockResolvedValue({ version: { version: 1 } }) };
    const router = createAdminContentApiRouter({ dependencies: async () => ({ service, delivery: {} }), authorize });
    const response = { statusCode: 0, status(value) { this.statusCode = value; return this; }, json(value) { this.value = value; return value; }, setHeader() {} };
    await router({ method: 'POST', url: '/api/admin-content/publish', query: { path: ['publish'] }, headers: {}, body: { contentType: 'PROJECT', contentId: 'x', expectedRevision: 1 } }, response);
    expect(authorize).toHaveBeenCalledWith(expect.anything(), permission);
    expect(response.statusCode).toBe(['CONTENT_EDITOR', 'CONTENT_REVIEWER'].includes(role) ? 403 : 201);
  });
});
