import { describe, expect, it, vi } from 'vitest';
import { AdminAssetService, MAX_ASSET_BYTES, validateAssetUpload } from '../../server/admin/content/AdminAssetService.js';
import { createAdminContentApiRouter } from '../../server/admin/content/adminContentApiRouter.js';
import { ContentPublicationService } from '../../server/admin/content/ContentPublicationService.js';
import { InMemoryContentPublicationStore } from '../../server/admin/content/InMemoryContentPublicationStore.js';
import { ADMIN_PERMISSIONS } from '../../shared/admin/adminAuthorization.js';

const png = () => { const bytes = Buffer.alloc(33); Buffer.from('89504e470d0a1a0a', 'hex').copy(bytes); bytes.write('IHDR', 12, 'ascii'); bytes.writeUInt32BE(1, 16); bytes.writeUInt32BE(1, 20); return bytes; };
const response = () => ({ statusCode: 0, headers: {}, status(code) { this.statusCode = code; return this; }, json(value) { this.value = value; return this; }, setHeader(key, value) { this.headers[key] = value; }, send(value) { this.value = value; return this; } });
const route = (method, path, body) => ({ method, url: `/api/admin-content/${path}`, query: { path: path.split('/') }, body });

describe('Phase 12 publishing and assets', () => {
  it('uses bounded summary and catalog pages without hydrating full draft content', async () => {
    const store = new InMemoryContentPublicationStore();
    const service = new ContentPublicationService({ store, artifacts: null });
    for (let index = 0; index < 3; index++) {
      const id = `item-${index}`;
      store.drafts.set(id, { contentId: id, contentType: 'PRACTICE', draftRevision: 1, lifecycleState: 'DRAFT', updatedAt: `2026-10-0${index + 1}`, document: { content: { title: `Question ${index}`, huge: 'x'.repeat(10000) } } });
      store.pointers.set(id, { contentId: id, contentType: 'PRACTICE', publicationStatus: 'ARCHIVED', activeVersion: 1 });
    }
    const first = service.listDraftSummaries({ limit: 2 });
    expect(first.items).toHaveLength(2);
    expect(first.items[0]).not.toHaveProperty('document');
    expect(service.listDraftSummaries({ limit: 2, cursor: first.nextCursor }).items).toHaveLength(1);
    expect(service.listPointers({ limit: 2 }).items).toHaveLength(2);
  });

  it('rejects unsupported, spoofed, oversized, and overlarge-dimension uploads', () => {
    const valid = { name: 'diagram.png', mediaType: 'image/png', data: png().toString('base64') };
    expect(validateAssetUpload(valid)).toMatchObject({ width: 1, height: 1, mediaType: 'image/png' });
    expect(() => validateAssetUpload({ ...valid, name: '../diagram.png' })).toThrow();
    expect(() => validateAssetUpload({ ...valid, mediaType: 'image/jpeg' })).toThrow();
    expect(() => validateAssetUpload({ ...valid, name: 'diagram.svg' })).toThrow();
    expect(() => validateAssetUpload({ ...valid, data: Buffer.alloc(MAX_ASSET_BYTES + 1).toString('base64') })).toThrow();
    const enormous = png(); enormous.writeUInt32BE(7000, 16);
    expect(() => validateAssetUpload({ ...valid, data: enormous.toString('base64') })).toThrow();
  });

  it('keeps asset creation on server authorization and records only metadata', async () => {
    const registry = { create: vi.fn(async (metadata, bytes) => { expect(bytes).toBeInstanceOf(Buffer); expect(metadata).not.toHaveProperty('data'); return metadata; }) };
    const assets = new AdminAssetService(registry, () => new Date('2026-10-07T00:00:00Z'));
    const uploaded = await assets.upload({ name: 'example.png', mediaType: 'image/png', data: png().toString('base64') }, { uid: 'admin' });
    expect(uploaded).toMatchObject({ assetId: expect.stringMatching(/^asset-/), path: expect.stringMatching(/^admin-content-assets\//), status: 'ACTIVE', createdBy: 'admin' });
    const authorize = vi.fn(async () => { throw Object.assign(new Error('Denied'), { status: 403, code: 'admin/permission-denied' }); });
    const router = createAdminContentApiRouter({ dependencies: async () => ({ service: {}, delivery: {}, assetService: assets }), authorize });
    const result = response();
    await router(route('POST', 'assets', { name: 'example.png', mediaType: 'image/png', data: png().toString('base64') }), result);
    expect(result.statusCode).toBe(403);
    expect(authorize).toHaveBeenCalledWith(expect.anything(), ADMIN_PERMISSIONS.CONTENT_EDIT);
    expect(registry.create).toHaveBeenCalledTimes(1);
  });

  it('routes catalog and assets reads, and preserves unknown-route handling', async () => {
    const service = { listPointers: vi.fn(async () => ({ items: [], nextCursor: null })), listDraftSummaries: vi.fn(async () => ({ items: [], nextCursor: null })) };
    const assetService = { list: vi.fn(async () => ({ items: [], nextCursor: null })) };
    const authorize = vi.fn(async () => ({ uid: 'admin', role: 'CONTENT_EDITOR' }));
    const router = createAdminContentApiRouter({ dependencies: async () => ({ service, delivery: {}, assetService }), authorize });
    for (const path of ['catalog', 'draft-summaries', 'assets']) {
      const result = response(); await router(route('GET', path), result);
      expect(result.statusCode).toBe(200);
    }
    const missing = response(); await router(route('POST', 'unknown'), missing);
    expect(missing.statusCode).toBe(404);
    const invalid = response(); await router(route('POST', 'assets', '{not-json'), invalid);
    expect(invalid.statusCode).toBe(400);
  });
});
