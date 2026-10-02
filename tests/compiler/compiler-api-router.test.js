import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCompilerApiRouter } from '../../server/compiler-public/compilerApiRouter.js';
import { createCompilerPublicDependencies } from '../../server/compiler-public/compilerPublicService.js';

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

  it('owns and closes an independent dependency session for every concurrent Share request', async () => {
    const sessions = [];
    const dependencyFactory = vi.fn(async () => {
      const close = vi.fn(async () => {});
      const db = {
        runTransaction: async (work) => work({ get: async () => ({ exists: false }), set: vi.fn() }),
        collection: () => ({ doc: () => ({ create: async () => {} }) }),
      };
      const value = { db, auth: {}, now: Date.now(), close };
      sessions.push(value);
      return value;
    });
    const router = createCompilerApiRouter({ dependencyFactory });
    const requests = Array.from({ length: 4 }, () => ({ ...request('share', 'POST'), headers: { 'content-type': 'application/json' }, body: { languageId: 'python', source: 'print(1)' }, socket: { remoteAddress: '127.0.0.1' } }));
    const responses = requests.map(() => responseDouble());
    await Promise.all(requests.map((value, index) => router(value, responses[index])));
    expect(responses.map((value) => value.statusCode)).toEqual([201, 201, 201, 201]);
    expect(new Set(sessions).size).toBe(4);
    expect(sessions.every((value) => value.close.mock.calls.length === 1)).toBe(true);
  });

  it.each([
    ['auth failure', { verifyIdToken: vi.fn(async () => { throw new Error('invalid token'); }) }, { authorization: 'Bearer invalid-token' }, 401],
    ['rate-limit failure', {}, {}, 500],
    ['payload validation failure', {}, {}, 400],
    ['Firestore write failure', {}, {}, 500],
  ])('closes request dependencies after %s', async (name, auth, extraHeaders, expectedStatus) => {
    const close = vi.fn(async () => {});
    const db = {
      runTransaction: async (work) => {
        if (name === 'rate-limit failure') throw new Error('synthetic transaction failure');
        return work({ get: async () => ({ exists: false }), set: vi.fn() });
      },
      collection: () => ({ doc: () => ({ create: async () => {
        if (name === 'Firestore write failure') throw new Error('synthetic write failure');
      } }) }),
    };
    const router = createCompilerApiRouter({ dependencyFactory: async () => ({ db, auth, now: Date.now(), close }) });
    const currentRequest = {
      ...request('share', 'POST'),
      headers: { 'content-type': 'application/json', ...extraHeaders },
      body: name === 'payload validation failure' ? { languageId: 'unknown', source: '' } : { languageId: 'python', source: 'print(1)' },
      socket: { remoteAddress: '127.0.0.1' },
    };
    const response = responseDouble();
    await router(currentRequest, response);
    expect(response.statusCode).toBe(expectedStatus);
    expect(close).toHaveBeenCalledOnce();
  });

  it('closes dependencies for Share GET, Feedback, and the authorized janitor', async () => {
    process.env.COMPILER_PUBLIC_JANITOR_SECRET = 'synthetic-janitor-secret';
    const sessions = [];
    const dependencyFactory = async () => {
      const close = vi.fn(async () => {});
      const db = {
        runTransaction: async (work) => work({ get: async () => ({ exists: false }), set: vi.fn() }),
        collection: (name) => ({
          doc: () => ({ create: async () => {}, get: async () => ({ exists: false, data: () => ({}) }) }),
          where: () => ({ limit: () => ({ get: async () => ({ empty: true, size: 0, docs: [] }) }) }),
        }),
      };
      const value = { db, auth: {}, now: Date.now(), close };
      sessions.push(value);
      return value;
    };
    const router = createCompilerApiRouter({ dependencyFactory });
    const getResponse = responseDouble();
    await router(request('share/AAAAAAAAAAAAAAAAAAAAAA'), getResponse);
    expect(getResponse.statusCode).toBe(404);
    const feedbackResponse = responseDouble();
    await router({ ...request('feedback', 'POST'), headers: { 'content-type': 'application/json' }, body: { type: 'general', description: 'Useful feedback' }, socket: { remoteAddress: '127.0.0.1' } }, feedbackResponse);
    expect(feedbackResponse.statusCode).toBe(201);
    const janitorResponse = responseDouble();
    await router({ ...request('share/janitor'), headers: { authorization: 'Bearer synthetic-janitor-secret' } }, janitorResponse);
    expect(janitorResponse.statusCode).toBe(200);
    expect(sessions).toHaveLength(3);
    expect(sessions.every((value) => value.close.mock.calls.length === 1)).toBe(true);
  });

  it('takes a Production-equivalent WIF Share request through rate limiting and persistence', async () => {
    const calls = [];
    const close = vi.fn(async () => calls.push('close'));
    const db = {
      terminate: vi.fn(async () => calls.push('firestore-close')),
      runTransaction: async (work) => { calls.push('rate-limit'); return work({ get: async () => ({ exists: false }), set: vi.fn() }); },
      collection: () => ({ doc: () => ({ create: async () => calls.push('share-write') }) }),
    };
    const credential = { getAccessToken: vi.fn() };
    const authClient = { kind: 'identity-pool-client' };
    const dependencyFactory = ({ request: currentRequest }) => createCompilerPublicDependencies({
      request: currentRequest,
      environment: { NODE_ENV: 'production', VERCEL_ENV: 'production' },
      credentialFactory: () => ({ mode: 'wif', authClient, firebaseCredential: credential, preflight: async () => calls.push('oidc-sts-preflight') }),
      firebaseAppFactory: async (_environment, options) => {
        expect(options.firebaseCredential).toBe(credential);
        calls.push('firebase-app');
        return { app: {}, close };
      },
      firestoreFactory: (_environment, options) => {
        expect(options).toMatchObject({ authClient, databaseId: '(default)' });
        calls.push('firestore-client');
        return db;
      },
      authFactory: () => ({}),
    });
    const router = createCompilerApiRouter({ dependencyFactory });
    const response = responseDouble();
    await router({ ...request('share', 'POST'), headers: { 'content-type': 'application/json' }, body: { languageId: 'python', source: 'print(1)' }, socket: { remoteAddress: '127.0.0.1' } }, response);
    expect(response.statusCode).toBe(201);
    expect(calls).toEqual(['oidc-sts-preflight', 'firebase-app', 'firestore-client', 'rate-limit', 'share-write', 'firestore-close', 'close']);
  });

  it('returns the sanitized server contract when Production WIF configuration is missing', async () => {
    const dependencyFactory = ({ request: currentRequest }) => createCompilerPublicDependencies({
      request: currentRequest,
      environment: { NODE_ENV: 'production', VERCEL_ENV: 'production', FIREBASE_PROJECT_ID: 'mi-tutora-pro' },
    });
    const response = responseDouble();
    await createCompilerApiRouter({ dependencyFactory })({ ...request('share', 'POST'), headers: { 'content-type': 'application/json' }, body: { languageId: 'python', source: 'print(1)' } }, response);
    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({ error: { code: 'compiler-public/server-error', message: 'The request could not be completed.' } });
  });
});
