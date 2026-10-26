import { describe, expect, it, vi } from 'vitest';
import { ADMIN_PERMISSIONS, ADMIN_ROLES } from '../../shared/admin/adminAuthorization.js';
import { ContentPublicationService } from '../../server/admin/content/ContentPublicationService.js';
import { InMemoryArtifactStore, InMemoryContentPublicationStore } from '../../server/admin/content/InMemoryContentPublicationStore.js';
import { PublicationSummaryBackfillService } from '../../server/admin/content/PublicationSummaryBackfillService.js';
import { PublishedContentService } from '../../server/admin/content/PublishedContentService.js';
import {
  createAdminContentApiRouter,
  PUBLICATION_SUMMARY_BACKFILL_CONFIRMATION,
} from '../../server/admin/content/adminContentApiRouter.js';
import { createMiniCourseFixture } from './fixtures.js';

const route = ['maintenance', 'publication-summary-backfill'];
const superAdmin = { uid: 'maintenance-admin', role: ADMIN_ROLES.SUPER_ADMIN };
const credentialFactory = () => ({ preflight: async () => {} });
const response = () => ({
  statusCode: 0,
  headers: {},
  body: null,
  setHeader(name, value) { this.headers[name] = value; },
  status(value) { this.statusCode = value; return this; },
  json(value) { this.body = value; return this; },
});
const request = (body = {}, method = 'POST', headers = { authorization: 'Bearer verified-token' }) => ({
  method,
  url: '/api/admin-content/maintenance/publication-summary-backfill',
  query: { path: route },
  headers,
  body,
});
const routerFor = ({ authorize = vi.fn().mockResolvedValue(superAdmin), dependencies } = {}) => createAdminContentApiRouter({
  environment: {}, authorize, credentialFactory, dependencies,
});

describe('publication summary maintenance endpoint', () => {
  it.each([
    [{}, true],
    [{ dryRun: true }, true],
  ])('defaults safely and returns only bounded dry-run counters for %o', async (input, dryRun) => {
    const run = vi.fn().mockResolvedValue({ dryRun, inspected: 4, missing: 2, changed: 2, unchanged: 2 });
    const close = vi.fn();
    const res = response();
    await routerFor({ dependencies: async () => ({ summaryBackfill: { run }, close }) })(request(input), res);

    expect(res.statusCode).toBe(200);
    expect(run).toHaveBeenCalledWith({ dryRun: true });
    expect(res.body).toEqual({ backfill: { dryRun: true, inspected: 4, missing: 2, changed: 2, unchanged: 2 } });
    expect(res.headers['Cache-Control']).toBe('private, no-store');
    expect(close).toHaveBeenCalledOnce();
  });

  it('rejects unauthenticated requests before credentials or publication dependencies are created', async () => {
    const credentials = vi.fn();
    const dependencies = vi.fn();
    const router = createAdminContentApiRouter({ environment: {}, credentialFactory: credentials, dependencies });
    const res = response();
    await router(request({}, 'POST', {}), res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error.code).toBe('admin/auth-required');
    expect(credentials).not.toHaveBeenCalled();
    expect(dependencies).not.toHaveBeenCalled();
    expect(res.headers['Cache-Control']).toBe('private, no-store');
  });

  it('requires Super Admin and ADMIN_MANAGE before constructing publication dependencies', async () => {
    const dependencies = vi.fn();
    const authorize = vi.fn().mockResolvedValue({ uid: 'content-admin', role: ADMIN_ROLES.CONTENT_ADMIN });
    const res = response();
    await routerFor({ authorize, dependencies })(request(), res);
    expect(authorize).toHaveBeenCalledWith(expect.anything(), ADMIN_PERMISSIONS.ADMIN_MANAGE);
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe('admin/permission-denied');
    expect(dependencies).not.toHaveBeenCalled();
  });

  it('rejects unauthenticated GET before credentials or publication dependencies are created', async () => {
    const credentials = vi.fn();
    const dependencies = vi.fn();
    const router = createAdminContentApiRouter({ environment: {}, credentialFactory: credentials, dependencies });
    const res = response();
    await router(request({}, 'GET', {}), res);
    expect(res.statusCode).toBe(405);
    expect(credentials).not.toHaveBeenCalled();
    expect(dependencies).not.toHaveBeenCalled();
    expect(res.headers['Cache-Control']).toBe('private, no-store');
  });

  it('requires the exact confirmation before apply mode and does not run the service', async () => {
    const dependencies = vi.fn();
    for (const input of [{ dryRun: false }, { dryRun: false, confirm: 'wrong' }]) {
      const res = response();
      await routerFor({ dependencies })(request(input), res);
      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('content/backfill-confirmation-required');
    }
    expect(dependencies).not.toHaveBeenCalled();
  });

  it('permits explicit apply only with the exact confirmation token', async () => {
    const run = vi.fn().mockResolvedValue({ dryRun: false, inspected: 1, missing: 1, changed: 1, unchanged: 0 });
    const res = response();
    await routerFor({ dependencies: async () => ({ summaryBackfill: { run }, close: async () => {} }) })(request({
      dryRun: false,
      confirm: PUBLICATION_SUMMARY_BACKFILL_CONFIRMATION,
    }), res);
    expect(res.statusCode).toBe(200);
    expect(run).toHaveBeenCalledWith({ dryRun: false });
    expect(res.headers['Cache-Control']).toBe('private, no-store');
  });

  it('keeps dry-run immutable and applies idempotently through the reviewed service only', async () => {
    const store = new InMemoryContentPublicationStore();
    const artifacts = new InMemoryArtifactStore();
    const publication = new ContentPublicationService({ store, artifacts });
    const delivery = new PublishedContentService({ store, artifacts });
    const document = createMiniCourseFixture();
    const draft = await publication.saveDraft({ actor: superAdmin, document, expectedRevision: 0 });
    await publication.publish({ actor: superAdmin, contentId: document.contentId, expectedRevision: draft.draftRevision });
    await store.updateVersionSummary(document.contentId, 1, {});
    const beforeVersion = await store.getVersion(document.contentId, 1);
    const beforePointer = await store.getPointer(document.contentId);
    const summaryBackfill = new PublicationSummaryBackfillService({ store, delivery });
    const dependencies = async () => ({ summaryBackfill, close: async () => {} });

    const dryResponse = response();
    await routerFor({ dependencies })(request({ dryRun: true }), dryResponse);
    expect(dryResponse.body.backfill).toMatchObject({ dryRun: true, inspected: 1, missing: 1, changed: 1, unchanged: 0 });
    expect(await store.getVersion(document.contentId, 1)).toEqual(beforeVersion);
    expect(await store.getPointer(document.contentId)).toEqual(beforePointer);

    const applyResponse = response();
    await routerFor({ dependencies })(request({ dryRun: false, confirm: PUBLICATION_SUMMARY_BACKFILL_CONFIRMATION }), applyResponse);
    expect(applyResponse.body.backfill).toMatchObject({ dryRun: false, inspected: 1, missing: 1, changed: 1, unchanged: 0 });
    const afterPointer = await store.getPointer(document.contentId);
    expect((await store.getVersion(document.contentId, 1)).metadataSnapshot.summaryVersion).toBe(1);
    expect(afterPointer.metadataSnapshot.summaryVersion).toBe(1);
    expect(afterPointer).toMatchObject({
      activeVersion: beforePointer.activeVersion,
      activeRevision: beforePointer.activeRevision,
      publicationStatus: beforePointer.publicationStatus,
    });

    const repeatResponse = response();
    await routerFor({ dependencies })(request({ dryRun: false, confirm: PUBLICATION_SUMMARY_BACKFILL_CONFIRMATION }), repeatResponse);
    expect(repeatResponse.body.backfill).toMatchObject({ dryRun: false, inspected: 1, missing: 0, changed: 0, unchanged: 1 });
  });

  it('sanitizes service failures and preserves private caching', async () => {
    const run = vi.fn().mockRejectedValue(new Error('private Firestore path and credential detail'));
    const res = response();
    await routerFor({ dependencies: async () => ({ summaryBackfill: { run }, close: async () => {} }) })(request(), res);
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: { code: 'content/internal', message: 'Content service is temporarily unavailable.' } });
    expect(JSON.stringify(res.body)).not.toContain('Firestore');
    expect(res.headers['Cache-Control']).toBe('private, no-store');
  });
});
