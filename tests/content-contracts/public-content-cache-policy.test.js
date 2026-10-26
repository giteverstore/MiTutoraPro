import { describe, expect, it, vi } from 'vitest';
import { PUBLIC_CACHE_POLICY, createAdminContentApiRouter } from '../../server/admin/content/adminContentApiRouter.js';

function response() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    send(value) { this.body = value; return this; },
  };
}

const environment = { VERCEL_ENV: 'production' };
const request = (path) => ({ method: 'GET', query: { path }, headers: {} });
const routeFor = (delivery) => createAdminContentApiRouter({
  environment,
  credentialFactory: () => ({ preflight: async () => {} }),
  dependencies: async () => ({ delivery, close: async () => {} }),
});

describe('public content cache policy', () => {
  it('uses short shared caching for catalog and ACTIVE responses', async () => {
    const delivery = { listActive: vi.fn(async () => []), resolveActive: vi.fn(async () => ({ document: { contentId: 'course' } })) };
    for (const path of [['public'], ['public', 'course']]) {
      const result = response();
      await routeFor(delivery)(request(path), result);
      expect(result.statusCode).toBe(200);
      expect(result.headers).toMatchObject(PUBLIC_CACHE_POLICY.mutable);
      expect(result.headers['Cache-Control']).not.toContain('immutable');
    }
  });

  it('caches successful exact detail immutably without changing its body', async () => {
    const body = { document: { contentId: 'course', version: 2 } };
    const result = response();
    await routeFor({ fetchVersion: vi.fn(async () => body) })(request(['public', 'course', '2']), result);
    expect(result.statusCode).toBe(200);
    expect(result.body).toBe(body);
    expect(result.headers).toMatchObject(PUBLIC_CACHE_POLICY.immutable);
  });

  it('keeps exact summaries refreshable until the backfill is complete', async () => {
    const body = { contentId: 'course', version: 2, metadata: {} };
    const result = response();
    await routeFor({ fetchVersionSummary: vi.fn(async () => body) })(request(['public', 'course', '2', 'summary']), result);
    expect(result.statusCode).toBe(200);
    expect(result.body).toBe(body);
    expect(result.headers).toMatchObject(PUBLIC_CACHE_POLICY.mutable);
    expect(result.headers['Cache-Control']).not.toContain('immutable');
  });

  it.each([
    ['missing ACTIVE', ['public', 'missing'], { resolveActive: vi.fn(async () => null) }, 404],
    ['missing exact detail', ['public', 'missing', '2'], { fetchVersion: vi.fn(async () => { throw Object.assign(new Error(), { code: 'content/version-not-found', status: 404 }); }) }, 404],
    ['missing exact summary', ['public', 'missing', '2', 'summary'], { fetchVersionSummary: vi.fn(async () => { throw Object.assign(new Error(), { code: 'content/version-not-found', status: 404 }); }) }, 404],
  ])('keeps %s private and retryable', async (_label, path, delivery, status) => {
    const result = response();
    await routeFor(delivery)(request(path), result);
    expect(result.statusCode).toBe(status);
    expect(result.headers['Cache-Control']).toBe('private, no-store');
    expect(result.headers['CDN-Cache-Control']).toBeUndefined();
    expect(result.headers['Vercel-CDN-Cache-Control']).toBeUndefined();
  });
});
