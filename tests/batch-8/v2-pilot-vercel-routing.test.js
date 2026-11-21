import { describe, expect, it, vi } from 'vitest';
import { createV2PilotApiHandler } from '../../api/internal-v2-pilot.js';

function responseRecorder() {
  return { statusCode: null, body: null, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return value; } };
}

function request(path, { method = 'GET', query = {} } = {}) {
  return { method, url: `/api/internal-v2-pilot?pilotPath=${encodeURIComponent(path)}`, query: { pilotPath: path, ...query } };
}

describe('Vercel V2 pilot internal dispatcher', () => {
  it.each([
    ['active Course', 'courses/course-a', 'course-a'],
    ['exact Course version', 'courses/course-a/versions/2', 'course-a/versions/2'],
    ['version-bound asset', 'courses/course-a/versions/2/assets/hero', 'course-a/versions/2/assets/hero'],
  ])('dispatches the public multi-segment %s path', async (_label, path, expectedPath) => {
    const courseHandler = vi.fn((_request, response) => response.status(401).json({ error: { code: 'v2/auth-required' } }));
    const handler = createV2PilotApiHandler({ courseHandler, progressHandler: vi.fn() });
    const input = request(path); const output = responseRecorder();
    await handler(input, output);
    expect(courseHandler).toHaveBeenCalledOnce();
    expect(input.query.path).toBe(expectedPath);
    expect(input.url).toBe(`/api/v2-pilot/${path}`);
    expect(output).toMatchObject({ statusCode: 401, body: { error: { code: 'v2/auth-required' } } });
  });

  it('dispatches Practice through its isolated handler and allowlist boundary', async () => {
    const practiceHandler = vi.fn((_request, response) => response.status(200).json({ ok:true }));
    const handler = createV2PilotApiHandler({ courseHandler:vi.fn(), practiceHandler, progressHandler:vi.fn() });
    const input = request('practice/practice-a/versions/2'); await handler(input, responseRecorder());
    expect(practiceHandler).toHaveBeenCalledOnce(); expect(input.query.path).toBe('practice-a/versions/2');
  });

  it.each(['GET', 'PUT'])('dispatches progress %s without changing its method', async (method) => {
    const progressHandler = vi.fn((_request, response) => response.status(401).json({ error: { code: 'v2/auth-invalid' } }));
    const handler = createV2PilotApiHandler({ courseHandler: vi.fn(), progressHandler });
    const input = request('progress/course-a/versions/3', { method }); const output = responseRecorder();
    await handler(input, output);
    expect(progressHandler).toHaveBeenCalledOnce();
    expect(input).toMatchObject({ method, url: '/api/v2-pilot/progress/course-a/versions/3', query: { contentId: 'course-a', version: '3' } });
  });

  it.each(['courses', 'progress/course-a', 'unknown/course-a'])('returns an application-level 404 for malformed route %s', async (path) => {
    const handler = createV2PilotApiHandler({ courseHandler: vi.fn(), progressHandler: vi.fn() });
    const output = responseRecorder(); await handler(request(path), output);
    expect(output).toMatchObject({ statusCode: 404, body: { error: { code: 'v2/route-not-found' } } });
  });

  it('preserves original query values while hiding the internal routing parameter', async () => {
    const courseHandler = vi.fn((_request, response) => response.status(401).json({}));
    const handler = createV2PilotApiHandler({ courseHandler, progressHandler: vi.fn() });
    const input = request('courses/course-a', { query: { mode: 'shadow', tag: ['a', 'b'] } });
    await handler(input, responseRecorder());
    expect(input.query).toMatchObject({ mode: 'shadow', tag: ['a', 'b'], path: 'course-a' });
    expect(input.query).not.toHaveProperty('pilotPath');
    expect(input.url).toBe('/api/v2-pilot/courses/course-a?mode=shadow&tag=a&tag=b');
  });
});
