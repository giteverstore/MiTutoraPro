import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { createAdminContentApiRouter } from '../../server/admin/content/adminContentApiRouter.js';
import { FirebaseArtifactStore, FirebaseContentPublicationStore } from '../../server/admin/content/FirebaseContentPublicationStore.js';
import { observePublicResponseFinish, runWithPublicContentTiming, setPublicContentTimingHeader, timePublic, timePublicSync } from '../../server/admin/content/publicContentTiming.js';

function response() {
  return {
    headers: new Map(), statusCode: 200, body: null,
    setHeader(name, value) { this.headers.set(name.toLowerCase(), value); return this; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

const publicRequest = (path = ['public']) => ({ method: 'GET', query: { path }, headers: {} });
const environment = { VERCEL_ENV: 'production' };

describe('public-content timing instrumentation', () => {
  it('emits only allowlisted duration fields, never arbitrary stage names or sensitive values', async () => {
    const result = response();
    await runWithPublicContentTiming(true, async () => {
      await timePublic('wif', async () => {});
      timePublicSync('token-secret', () => 'Bearer sensitive-value');
      setPublicContentTimingHeader(result);
    });
    expect(result.headers.get('server-timing')).toMatch(/^handler;dur=\d+\.\d{2}, wif;dur=\d+\.\d{2}$/);
    expect(result.headers.get('server-timing')).not.toMatch(/token|Bearer|sensitive/i);
  });

  it('logs only a total duration when the public response finishes', async () => {
    const events = new EventEmitter();
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      await runWithPublicContentTiming(true, async () => {
        observePublicResponseFinish(events);
        events.emit('finish');
      });
      expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ operation: 'admin-public-response-finish', totalMs: expect.any(Number) });
      expect(log.mock.calls[0][0]).not.toMatch(/Bearer|token|contentId|document/);
    } finally { log.mockRestore(); }
  });

  it('preserves catalog JSON, status, no-store, and repeats request-scoped WIF preflight', async () => {
    const items = [{ contentId: 'course-one', activeVersion: 1, metadata: { title: 'Course One' } }];
    const preflight = vi.fn(async () => {});
    const credentials = vi.fn(() => ({ preflight }));
    const route = createAdminContentApiRouter({ environment, credentialFactory: credentials,
      dependencies: async () => ({ delivery: { listActive: async () => items }, close: async () => {} }),
    });
    for (const _ of [1, 2]) {
      const result = response();
      await route({ ...publicRequest(), query: { path: ['public'], contentType: 'COURSE' } }, result);
      expect(result.statusCode).toBe(200);
      expect(result.body).toEqual({ items });
      expect(result.headers.get('cache-control')).toBe('no-store');
      expect(result.headers.get('server-timing')).toMatch(/handler;dur=\d+\.\d{2}/);
      expect(result.headers.get('server-timing')).toMatch(/wif;dur=\d+\.\d{2}/);
      expect(result.headers.get('server-timing')).not.toMatch(/course-one|Course One/);
    }
    expect(credentials).toHaveBeenCalledTimes(2);
    expect(preflight).toHaveBeenCalledTimes(2);
  });

  it('times the bounded catalog RPC, pointer/version gets, and artifact read separately', async () => {
    const catalogGet = vi.fn(async () => ({ docs: [{ data: () => ({ contentId: 'course-one' }) }] }));
    const pointerGet = vi.fn(async () => ({ exists: true, data: () => ({ activeVersion: 1 }) }));
    const versionGet = vi.fn(async () => ({ exists: true, data: () => ({ version: 1, status: 'READY' }) }));
    const versionDoc = { get: versionGet };
    const pointerDoc = { get: pointerGet, collection: () => ({ doc: () => versionDoc }) };
    const db = { collection: () => ({ where() { return this; }, limit() { return this; }, get: catalogGet, doc: () => pointerDoc }) };
    const store = new FirebaseContentPublicationStore(db);
    const artifact = new FirebaseArtifactStore({ name: 'test-bucket', file: () => ({ download: async () => [Buffer.from('{}')] }) });
    const result = response();
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      await runWithPublicContentTiming(true, async () => {
        expect(await store.listActivePointers('COURSE')).toHaveLength(1);
        expect(await store.getPointer('course-one')).toEqual({ activeVersion: 1 });
        expect(await store.getVersion('course-one', 1)).toEqual({ version: 1, status: 'READY' });
        expect(await artifact.read('published-content/courses/course-one/v1.json')).toEqual(Buffer.from('{}'));
        setPublicContentTimingHeader(result);
      });
      expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ operation: 'admin-public-catalog-timing', documents: 1 });
      expect(log.mock.calls[0][0]).not.toContain('course-one');
    } finally { log.mockRestore(); }
    expect(catalogGet).toHaveBeenCalledOnce();
    expect(pointerGet).toHaveBeenCalledOnce();
    expect(versionGet).toHaveBeenCalledOnce();
    expect(result.headers.get('server-timing')).toMatch(/catalog_query;dur=\d+\.\d{2}/);
    expect(result.headers.get('server-timing')).toMatch(/catalog_map;dur=\d+\.\d{2}/);
    expect(result.headers.get('server-timing')).toMatch(/pointer_get;dur=\d+\.\d{2}/);
    expect(result.headers.get('server-timing')).toMatch(/version_get;dur=\d+\.\d{2}/);
    expect(result.headers.get('server-timing')).toMatch(/artifact_read;dur=\d+\.\d{2}/);
    expect(result.headers.get('server-timing')).not.toContain('course-one');
  });

  it('preserves missing ACTIVE and failed-WIF statuses and payloads', async () => {
    const missing = createAdminContentApiRouter({ environment,
      credentialFactory: () => ({ preflight: async () => {} }),
      dependencies: async () => ({ delivery: { resolveActive: async () => null }, close: async () => {} }),
    });
    const notFound = response();
    await missing(publicRequest(['public', 'python']), notFound);
    expect(notFound.statusCode).toBe(404);
    expect(notFound.body).toEqual({ error: { code: 'content/not-published', message: 'Published content was not found.' } });
    expect(notFound.headers.get('server-timing')).toMatch(/wif;dur=/);

    const unavailable = createAdminContentApiRouter({ environment,
      credentialFactory: () => ({ preflight: async () => { throw new Error('Bearer secret-token'); } }),
      dependencies: vi.fn(),
    });
    const failed = response();
    await unavailable(publicRequest(), failed);
    expect(failed.statusCode).toBe(500);
    expect(failed.body).toEqual({ error: { code: 'content/internal', message: 'Content service is temporarily unavailable.' } });
    expect(failed.headers.get('server-timing')).not.toMatch(/Bearer|secret-token/);
  });

  it('leaves Preview public reads fail-closed before credential creation', async () => {
    const credentialFactory = vi.fn();
    const route = createAdminContentApiRouter({ environment: { VERCEL_ENV: 'preview' }, credentialFactory });
    const result = response();
    await route(publicRequest(), result);
    expect(result.statusCode).toBe(503);
    expect(result.body).toEqual({ error: { code: 'admin/preview-backend-disabled', message: 'Preview content is not configured.' } });
    expect(credentialFactory).not.toHaveBeenCalled();
  });
});
