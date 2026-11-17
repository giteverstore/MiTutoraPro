import { describe, expect, it, vi } from 'vitest';
import { createV2PilotGatewayHandler, isServerV2PilotEnabled } from '../../server/v2-pilot/V2PilotGateway';

function responseRecorder() {
  return { headers: {}, statusCode: null, body: null, setHeader(key, value) { this.headers[key] = value; }, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return value; }, send(value) { this.body = value; return value; } };
}

const environment = { V2_COURSE_PILOT_ENABLED: 'true', VERCEL_ENV: 'preview', V2_COURSE_PILOT_UIDS: 'learner-1', V2_COURSE_PILOT_CONTENT_IDS: 'course-a' };

describe('V2 pilot learner gateway', () => {
  it('stays disabled in production', () => expect(isServerV2PilotEnabled({ V2_COURSE_PILOT_ENABLED: 'true', VERCEL_ENV: 'production' })).toBe(false));

  it('rejects missing and invalid learner tokens', async () => {
    const transport = { request: vi.fn() };
    const handler = createV2PilotGatewayHandler({ environment, verifyToken: vi.fn(async () => { throw new Error('invalid'); }), transport, logger: {} });
    let response = responseRecorder(); await handler({ method: 'GET', headers: {}, query: { path: 'course-a' } }, response); expect(response.statusCode).toBe(401);
    response = responseRecorder(); await handler({ method: 'GET', headers: { authorization: 'Bearer bad' }, query: { path: 'course-a' } }, response); expect(response.body.error.code).toBe('v2/auth-invalid');
    expect(transport.request).not.toHaveBeenCalled();
  });

  it.each([
    ['non-allowlisted learner', { uid: 'learner-2' }, 'course-a'],
    ['non-allowlisted Course', { uid: 'learner-1' }, 'course-b'],
  ])('rejects a %s before Editor delivery', async (_label, principal, contentId) => {
    const transport = { request: vi.fn() };
    const handler = createV2PilotGatewayHandler({ environment, verifyToken: vi.fn(async () => principal), transport, logger: {} });
    const response = responseRecorder();
    await handler({ method: 'GET', headers: { authorization: 'Bearer valid' }, query: { path: contentId } }, response);
    expect(response).toMatchObject({ statusCode: 403, body: { error: { code: 'v2/access-denied' } } });
    expect(transport.request).not.toHaveBeenCalled();
  });

  it('accepts a normal learner without requiring adminRole and enforces allowlists', async () => {
    const transport = { request: vi.fn(async () => ({ contentId: 'course-a', publicationVersion: 4, course: { modules: [] } })) };
    const handler = createV2PilotGatewayHandler({ environment, verifyToken: vi.fn(async () => ({ uid: 'learner-1' })), transport, logger: {} });
    const response = responseRecorder(); await handler({ method: 'GET', headers: { authorization: 'Bearer valid' }, query: { path: 'course-a' } }, response);
    expect(response.statusCode).toBe(200); expect(transport.request).toHaveBeenCalledWith(expect.objectContaining({ mode: 'active' }), expect.any(Object));
  });

  it('preserves exact versions and version-bound asset tuples', async () => {
    const transport = { request: vi.fn(async (target) => target.kind === 'asset' ? { bytes: Buffer.from('image'), contentType: 'image/png' } : ({ contentId: target.contentId, publicationVersion: target.publicationVersion, course: { modules: [] } })) };
    const handler = createV2PilotGatewayHandler({ environment, verifyToken: async () => ({ uid: 'learner-1' }), transport, logger: {} });
    let response = responseRecorder(); await handler({ method: 'GET', headers: { authorization: 'Bearer valid' }, query: { path: 'course-a/versions/2' } }, response); expect(response.body.data.publicationVersion).toBe(2);
    response = responseRecorder(); await handler({ method: 'GET', headers: { authorization: 'Bearer valid' }, query: { path: 'course-a/versions/2/assets/hero' } }, response); expect(transport.request).toHaveBeenLastCalledWith(expect.objectContaining({ contentId: 'course-a', publicationVersion: 2, assetId: 'hero' }), expect.any(Object));
  });
});
