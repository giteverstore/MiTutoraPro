import { afterEach, describe, expect, it } from 'vitest';
import { createCompilerApiRouter } from '../../server/compiler-public/compilerApiRouter.js';

function responseDouble() {
  return {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
}

function request(path, method = 'GET') {
  return { method, query: { path: path.split('/') }, headers: {}, url: `/api/compiler/${path}` };
}

afterEach(() => {
  delete process.env.COMPILER_PUBLIC_JANITOR_SECRET;
  delete process.env.CRON_SECRET;
});

describe('consolidated compiler API router', () => {
  it.each([
    ['share', 'GET', 405],
    ['share/example-share-id', 'POST', 405],
    ['feedback', 'GET', 405],
    ['mysql/public', 'GET', 405],
    ['mysql/run', 'GET', 405],
    ['mysql/janitor', 'POST', 405],
    ['remote/public', 'GET', 405],
    ['execute', 'GET', 405],
  ])('dispatches /api/compiler/%s to its existing method contract', async (path, method, expectedStatus) => {
    const response = responseDouble();
    await createCompilerApiRouter()(request(path, method), response);
    expect(response.statusCode).toBe(expectedStatus);
  });

  it('keeps the share janitor route distinct from dynamic share reads', async () => {
    const response = responseDouble();
    await createCompilerApiRouter()(request('share/janitor'), response);
    expect(response.statusCode).toBe(401);
    expect(response.body.error.code).toBe('compiler-public/unauthenticated');
  });

  it('returns a sanitized 404 for unknown compiler paths', async () => {
    const response = responseDouble();
    await createCompilerApiRouter()(request('unknown/path'), response);
    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ error: { code: 'compiler/not-found', message: 'Compiler API route not found.' } });
  });
});
