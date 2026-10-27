import { describe, expect, it, vi } from 'vitest';
import { createAdminContentApiRouter, createDefaultContentDependencies, PUBLIC_CACHE_POLICY } from '../../server/admin/content/adminContentApiRouter.js';
import { PublishedContentService } from '../../server/admin/content/PublishedContentService.js';

function response() {
  return {
    statusCode: 200, headers: {}, body: null,
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

const request = (contentType = 'PROJECT') => ({ method: 'GET', query: { path: ['public'], contentType }, headers: {} });

describe('public catalog performance boundary', () => {
  it('constructs catalog-only dependencies and emits sanitized stage timings', async () => {
    const artifacts = { read: vi.fn() };
    const store = { listActivePointers: vi.fn(async () => [{ contentId: 'bounded', activeVersion: 1, metadataSnapshot: { title: 'Bounded' } }]) };
    const dependencies = vi.fn(async () => ({
      delivery: new PublishedContentService({ store, artifacts }), close: vi.fn(async () => {}),
    }));
    const result = response();
    await createAdminContentApiRouter({
      environment: { VERCEL_ENV: 'production' },
      credentialFactory: () => ({ preflight: async () => {} }),
      dependencies,
    })(request(), result);

    expect(dependencies).toHaveBeenCalledWith(expect.objectContaining({ catalogOnly: true }));
    expect(result.statusCode).toBe(200);
    expect(result.headers).toMatchObject(PUBLIC_CACHE_POLICY.catalog);
    expect(result.headers['Server-Timing']).toMatch(/^wif;dur=\d+\.\d, client;dur=\d+\.\d, query;dur=\d+\.\d, project;dur=\d+\.\d, total;dur=\d+\.\d$/);
    expect(result.headers['Server-Timing']).not.toMatch(/bounded|credential|path/i);
    expect(store.listActivePointers).toHaveBeenCalledOnce();
    expect(artifacts.read).not.toHaveBeenCalled();
  });

  it.each(['PROJECT', 'COURSE'])('%s catalog reads one pointer query and zero artifacts', async (contentType) => {
    const artifacts = { read: vi.fn() };
    const store = { listActivePointers: vi.fn(async () => []) };
    const delivery = new PublishedContentService({ store, artifacts });
    await delivery.listActive(contentType);
    expect(store.listActivePointers).toHaveBeenCalledWith(contentType);
    expect(artifacts.read).not.toHaveBeenCalled();
  });

  it('exposes only total timing when a public catalog request fails', async () => {
    const result = response();
    await createAdminContentApiRouter({
      environment: { VERCEL_ENV: 'production' },
      credentialFactory: () => ({ preflight: async () => { throw new Error('Bearer private-token'); } }),
      dependencies: vi.fn(),
    })(request(), result);
    expect(result.statusCode).toBe(500);
    expect(result.headers['Server-Timing']).toMatch(/^total;dur=\d+\.\d$/);
    expect(result.headers['Server-Timing']).not.toMatch(/Bearer|token|wif/i);
  });

  it('does not initialize Storage for catalog-only default dependencies', async () => {
    const close = vi.fn(async () => {});
    const firestoreFactory = vi.fn(async () => ({ db: {}, close }));
    const storageFactory = vi.fn();
    const resources = await createDefaultContentDependencies({
      environment: {}, googleCredentials: {}, catalogOnly: true,
    }, { firestoreFactory, storageFactory });
    expect(firestoreFactory).toHaveBeenCalledOnce();
    expect(storageFactory).not.toHaveBeenCalled();
    expect(Object.keys(resources).sort()).toEqual(['close', 'delivery']);
    await resources.close();
    expect(close).toHaveBeenCalledOnce();
  });
});
