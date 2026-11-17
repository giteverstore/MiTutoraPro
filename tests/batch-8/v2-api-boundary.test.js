import { describe, expect, it, vi } from 'vitest';
import { createV2PilotApiHandler } from '../../api/v2-pilot/[...path].js';

function responseRecorder() {
  return { statusCode: null, body: null, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; return value; } };
}

describe('dedicated V2 learner API boundary', () => {
  it('dispatches Course and asset paths without an Admin router', () => {
    const courseHandler = vi.fn();
    const handler = createV2PilotApiHandler({ courseHandler, progressHandler: vi.fn() });
    const request = { query: { path: ['courses', 'course-a', 'versions', '2', 'assets', 'hero'] } };
    handler(request, responseRecorder());
    expect(courseHandler).toHaveBeenCalledOnce();
    expect(request.query.path).toBe('course-a/versions/2/assets/hero');
  });

  it('dispatches exact-version progress paths', () => {
    const progressHandler = vi.fn();
    const handler = createV2PilotApiHandler({ courseHandler: vi.fn(), progressHandler });
    const request = { query: { path: 'progress/course-a/versions/7' } };
    handler(request, responseRecorder());
    expect(progressHandler).toHaveBeenCalledOnce();
    expect(request.query).toMatchObject({ contentId: 'course-a', version: '7' });
  });

  it('rejects unrelated and malformed routes', () => {
    const response = responseRecorder();
    createV2PilotApiHandler({ courseHandler: vi.fn(), progressHandler: vi.fn() })({ query: { path: ['admin-content', 'public'] } }, response);
    expect(response.statusCode).toBe(404);
    expect(response.body.error.code).toBe('v2/route-not-found');
  });
});
