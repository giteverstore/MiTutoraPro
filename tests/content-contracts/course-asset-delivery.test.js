import { describe, expect, it, vi } from 'vitest';
import { createAdminContentApiRouter, ADMIN_CONTENT_BUCKET_NAME } from '../../server/admin/content/adminContentApiRouter.js';
import { ContentPublicationService } from '../../server/admin/content/ContentPublicationService.js';
import { FirebaseAssetRegistry } from '../../server/admin/content/FirebaseContentPublicationStore.js';

const assetId = 'asset-11111111-1111-4111-8111-111111111111';
const image = { id: 'course-image', type: 'image', assetId, alt: 'Git branches', caption: 'Branch diagram' };
const document = { contentId: 'git-course', contentType: 'COURSE', version: 2, locale: 'en', metadata: {}, content: {
  courseId: 'git-course', slug: 'git-course', title: 'Git', description: 'A course', language: 'none', difficulty: 'Beginner', estimatedMinutes: 10,
  modules: [{ id: 'chapter-1', order: 1, lessons: [{ id: 'lesson-1', blocks: [image] }] }],
} };
const response = () => ({ statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; }, setHeader(name, value) { this.headers[name] = value; return this; }, json(value) { this.body = value; return this; }, send(value) { this.body = value; return this; } });
const request = (id = assetId) => ({ method: 'GET', query: { path: ['public', 'assets', 'git-course', '2', id] }, headers: {} });
const credentials = () => ({ preflight: async () => {} });

describe('canonical Course asset delivery', () => {
  it('serves only a referenced image from an immutable READY Course version using the existing registry', async () => {
    const asset = { assetId, path: `admin-content-assets/${assetId}.png`, mediaType: 'image/png' };
    const read = vi.fn(async () => Buffer.from('png'));
    const fetchVersion = vi.fn(async () => ({ document }));
    const route = createAdminContentApiRouter({ useDedicatedAdminBucket: true, environment: { VERCEL_ENV: 'production' }, credentialFactory: credentials,
      dependencies: async () => ({ delivery: { fetchVersion }, assetService: { get: async () => asset, read } }) });
    const ok = response(); await route(request(), ok);
    expect(ok.statusCode).toBe(200);
    expect(ok.headers['Content-Type']).toBe('image/png');
    expect(ok.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(ok.body).toEqual(Buffer.from('png'));
    expect(fetchVersion).toHaveBeenCalledWith('git-course', '2');
    const denied = response(); await route(request('asset-22222222-2222-4222-8222-222222222222'), denied);
    expect(denied.statusCode).toBe(404);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('checks a registered private object before allowing an asset-only Course image to publish', async () => {
    const metadata = { assetId, path: `admin-content-assets/${assetId}.png`, mediaType: 'image/png', size: 1024 };
    const getMetadata = vi.fn(async () => [{ size: '1024', contentType: 'image/png' }]);
    const db = { collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => metadata }) }) }) };
    const bucket = { file: () => ({ getMetadata }), getFiles: vi.fn(() => { throw new Error('Listing is forbidden'); }) };
    const assets = new FirebaseAssetRegistry(db, bucket);
    const service = new ContentPublicationService({ store: {}, artifacts: {}, assets });
    await expect(service.verifyAssets(document)).resolves.toBeUndefined();
    expect(getMetadata).toHaveBeenCalledOnce();
    expect(bucket.getFiles).not.toHaveBeenCalled();
    const missing = new ContentPublicationService({ store: {}, artifacts: {}, assets: { exists: async () => true, verifyReadable: async () => false } });
    await expect(missing.verifyAssets(document)).rejects.toMatchObject({ code: 'content/asset-missing', status: 422 });
  });

  it('proxies learner bytes only from the configured Admin origin and remains fail-closed in Preview', async () => {
    const fetcher = vi.fn(async () => new Response(Buffer.from('png'), { headers: { 'content-type': 'image/png' } }));
    const dependencies = async () => ({ delivery: {}, assetService: {} });
    const environment = { VERCEL_ENV: 'production', ADMIN_PUBLIC_CONTENT_ORIGIN: 'https://admin.ycoders.com', ADMIN_CONTENT_STORAGE_BUCKET: ADMIN_CONTENT_BUCKET_NAME };
    const route = createAdminContentApiRouter({ publicOnly: true, environment, credentialFactory: credentials, dependencies, fetcher });
    const ok = response(); await route(request(), ok);
    expect(ok.statusCode).toBe(200);
    expect(fetcher.mock.calls[0][0]).toBe(`https://admin.ycoders.com/api/admin-content/public/assets/git-course/2/${assetId}`);
    const preview = createAdminContentApiRouter({ publicOnly: true, environment: { VERCEL_ENV: 'preview' }, dependencies: vi.fn(), credentialFactory: vi.fn() });
    const blocked = response(); await preview(request(), blocked);
    expect(blocked.statusCode).toBe(503);
  });
});
