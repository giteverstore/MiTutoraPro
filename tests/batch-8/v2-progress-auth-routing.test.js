import { describe, expect, it, vi } from 'vitest';
import { createV2ProgressHandler } from '../../server/v2-pilot/V2ProgressHandler.js';

function responseRecorder() {
  return { statusCode: null, body: null, headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return value; } };
}

const environment = {
  V2_COURSE_PILOT_ENABLED: 'true', VERCEL_ENV: 'preview',
  V2_COURSE_PILOT_UIDS: 'learner-1', V2_COURSE_PILOT_CONTENT_IDS: 'course-a',
};

function request(method = 'GET') {
  return { method, headers: { authorization: 'Bearer learner-token' }, query: { contentId: 'course-a', version: '2' }, body: { completedLessons: ['lesson-1'] } };
}

describe('V2 progress authentication ordering', () => {
  it('rejects an invalid learner before reading progress or contacting Editor', async () => {
    const store = { load: vi.fn(), save: vi.fn() }; const transport = { request: vi.fn() };
    const handler = createV2ProgressHandler({ environment, store, transport, verifyToken: vi.fn(async () => { throw new Error('invalid'); }) });
    const response = responseRecorder(); await handler(request(), response);
    expect(response.statusCode).toBe(401);
    expect(store.load).not.toHaveBeenCalled(); expect(store.save).not.toHaveBeenCalled(); expect(transport.request).not.toHaveBeenCalled();
  });

  it('rejects non-allowlisted learner and Course identities before progress or delivery', async () => {
    for (const [uid, contentId] of [['learner-2', 'course-a'], ['learner-1', 'course-b']]) {
      const store = { load: vi.fn(), save: vi.fn() }; const transport = { request: vi.fn() };
      const handler = createV2ProgressHandler({ environment, store, transport, verifyToken: vi.fn(async () => ({ uid })) });
      const input = request(); input.query.contentId = contentId; const response = responseRecorder(); await handler(input, response);
      expect(response).toMatchObject({ statusCode: 403, body: { error: { code: 'v2/access-denied' } } });
      expect(store.load).not.toHaveBeenCalled(); expect(store.save).not.toHaveBeenCalled(); expect(transport.request).not.toHaveBeenCalled();
    }
  });

  it('preserves authenticated GET and PUT progress behavior', async () => {
    const store = { load: vi.fn(async () => ({ revision: 1 })), save: vi.fn(async () => ({ revision: 2 })) };
    const transport = { request: vi.fn(async () => ({ course: { modules: [{ lessons: [{ id: 'lesson-1' }] }] } })) };
    const handler = createV2ProgressHandler({ environment, store, transport, verifyToken: vi.fn(async () => ({ uid: 'learner-1' })) });
    let response = responseRecorder(); await handler(request('GET'), response);
    expect(response).toMatchObject({ statusCode: 200, body: { ok: true, data: { revision: 1 } } }); expect(transport.request).not.toHaveBeenCalled();
    response = responseRecorder(); await handler(request('PUT'), response);
    expect(response).toMatchObject({ statusCode: 200, body: { ok: true, data: { revision: 2 } } });
    expect(transport.request).toHaveBeenCalledWith(expect.objectContaining({ contentId: 'course-a', publicationVersion: 2, mode: 'exact' }), expect.objectContaining({ correlationId: expect.any(String) }));
    expect(store.save).toHaveBeenCalledWith('learner-1', { contentId: 'course-a', publicationVersion: 2 }, { completedLessons: ['lesson-1'] }, new Set(['lesson-1']));
  });
});
