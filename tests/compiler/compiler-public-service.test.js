import { describe, expect, it, vi } from 'vitest';
import { getApps } from 'firebase-admin/app';
import { CompilerPublicError, createCompilerPublicDependencies, validateFeedbackPayload, validateSharePayload } from '../../server/compiler-public/compilerPublicService.js';

it('materializes request time as epoch milliseconds for HTTP handlers', async () => {
  const before = Date.now();
  const close = vi.fn(async () => {});
  const request = { headers: {} };
  const credentialFactory = vi.fn(() => ({ mode: 'adc', firebaseCredential: null, preflight: vi.fn(async () => {}) }));
  const firebaseAppFactory = vi.fn(async () => ({ app: { name: 'request-app' }, close }));
  const logger = { info: vi.fn() };
  const dependencies = await createCompilerPublicDependencies({
    request,
    environment: { NODE_ENV: 'development' },
    credentialFactory,
    firebaseAppFactory,
    firestoreFactory: vi.fn(() => ({ kind: 'db' })),
    authFactory: vi.fn(() => ({ kind: 'auth' })),
    logger,
  });
  expect(dependencies.now).toBeTypeOf('number');
  expect(dependencies.now).toBeGreaterThanOrEqual(before);
  expect(dependencies.now).toBeLessThanOrEqual(Date.now());
  expect(credentialFactory).toHaveBeenCalledWith(expect.objectContaining({ request, environment: { NODE_ENV: 'development' }, diagnostics: expect.any(Object) }));
  expect(logger.info).toHaveBeenCalledWith('compiler_public_wif', expect.objectContaining({ stage: 'wif.firebase.success', databaseId: '(default)' }));
  expect(dependencies.credentialMode).toBe('adc');
  await dependencies.close();
  expect(close).toHaveBeenCalledOnce();
});

it('closes a request app when Auth or Firestore dependency materialization fails', async () => {
  const close = vi.fn(async () => {});
  await expect(createCompilerPublicDependencies({
    request: { headers: {} },
    environment: { NODE_ENV: 'development' },
    credentialFactory: () => ({ mode: 'adc', firebaseCredential: null, preflight: async () => {} }),
    firebaseAppFactory: async () => ({ app: {}, close }),
    firestoreFactory: () => { throw new Error('synthetic Firestore initialization failure'); },
    logger: { info: vi.fn() },
  })).rejects.toThrow('synthetic Firestore initialization failure');
  expect(close).toHaveBeenCalledOnce();
});

it('uses one WIF credential and one independently owned Firebase app per concurrent request', async () => {
  const credential = { getAccessToken: vi.fn() };
  const preflight = vi.fn(async () => {});
  const credentialFactory = vi.fn(() => ({ mode: 'wif', firebaseCredential: credential, preflight }));
  const sessions = [];
  const firebaseAppFactory = vi.fn(async (_environment, options) => {
    expect(options.firebaseCredential).toBe(credential);
    const session = { app: {}, close: vi.fn(async () => {}) };
    sessions.push(session);
    return session;
  });
  const options = {
    environment: { NODE_ENV: 'production', VERCEL_ENV: 'production' },
    credentialFactory,
    firebaseAppFactory,
    firestoreFactory: (app) => ({ app }),
    authFactory: (app) => ({ app }),
    logger: { info: vi.fn() },
  };
  const dependencies = await Promise.all(Array.from({ length: 5 }, (_, index) => createCompilerPublicDependencies({ ...options, request: { id: index } })));
  expect(preflight).toHaveBeenCalledTimes(5);
  expect(new Set(sessions.map((value) => value.app)).size).toBe(5);
  await Promise.all(dependencies.map((value) => value.close()));
  expect(sessions.every((value) => value.close.mock.calls.length === 1)).toBe(true);
});

it('fails closed in managed Production instead of using service-account JSON', async () => {
  const firebaseAppFactory = vi.fn();
  await expect(createCompilerPublicDependencies({
    request: { headers: {} },
    environment: {
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
      FIREBASE_PROJECT_ID: 'mi-tutora-pro',
      FIREBASE_SERVICE_ACCOUNT_JSON: '{"type":"service_account"}',
      GOOGLE_WIF_AUDIENCE: '//iam.googleapis.com/projects/196429461457/locations/global/workloadIdentityPools/ai-tutor-vercel/providers/vercel-production',
      GOOGLE_WIF_SERVICE_ACCOUNT_EMAIL: 'ai-tutor-runtime@mi-tutora-pro.iam.gserviceaccount.com',
    },
    firebaseAppFactory,
    logger: { info: vi.fn() },
  })).rejects.toMatchObject({ code: 'ai/server-unavailable', status: 503 });
  expect(firebaseAppFactory).not.toHaveBeenCalled();
});

it('leaves no Firebase Admin request-app accumulation after repeated disposal', async () => {
  const before = getApps().map((app) => app.name).sort();
  const firebaseCredential = { getAccessToken: async () => ({ access_token: 'synthetic', expires_in: 60 }) };
  const dependencies = await Promise.all(Array.from({ length: 3 }, () => createCompilerPublicDependencies({
    request: { headers: {} },
    environment: { NODE_ENV: 'development', FIREBASE_PROJECT_ID: 'demo-compiler-public' },
    credentialFactory: () => ({ mode: 'test', firebaseCredential, preflight: async () => {} }),
    firestoreFactory: (app) => ({ app }),
    authFactory: (app) => ({ app }),
    logger: { info: vi.fn() },
  })));
  expect(getApps().filter((app) => app.name.startsWith('mitutora-request-'))).toHaveLength(3);
  await Promise.all(dependencies.map((value) => value.close()));
  expect(getApps().map((app) => app.name).sort()).toEqual(before);
});

it('reports Firebase initialization failure without logging secret sentinel values', async () => {
  const logger = { info: vi.fn() };
  await expect(createCompilerPublicDependencies({
    request: { headers: { authorization: 'Bearer ID_TOKEN_SENTINEL' } },
    environment: { NODE_ENV: 'development', FIREBASE_PROJECT_ID: 'demo-compiler-public' },
    credentialFactory: () => ({ mode: 'test', firebaseCredential: {}, preflight: async () => {} }),
    firebaseAppFactory: async () => { throw Object.assign(new Error('PRIVATE_KEY_SENTINEL'), { code: 'firebase/init-failed' }); },
    logger,
  })).rejects.toMatchObject({ code: 'firebase/init-failed' });
  expect(logger.info).toHaveBeenCalledWith('compiler_public_wif', expect.objectContaining({ stage: 'wif.initialization.failure', errorCode: 'firebase/init-failed' }));
  const output = JSON.stringify(logger.info.mock.calls);
  expect(output).not.toContain('ID_TOKEN_SENTINEL');
  expect(output).not.toContain('PRIVATE_KEY_SENTINEL');
});

describe('compiler public share validation', () => {
  it('accepts canonical snapshots and excludes stdin unless explicitly selected', () => {
    expect(validateSharePayload({ languageId: 'python', source: 'print(1)', stdin: 'secret' })).toEqual({ languageId: 'python', source: 'print(1)', stdinIncluded: false, stdin: null });
    expect(validateSharePayload({ languageId: 'rust', source: 'fn main() {}', stdinIncluded: true, stdin: '5' }).stdin).toBe('5');
  });
  it('rejects invalid languages and oversized UTF-8 fields', () => {
    expect(() => validateSharePayload({ languageId: 'ruby', source: '' })).toThrow(CompilerPublicError);
    expect(() => validateSharePayload({ languageId: 'Python', source: '' })).toThrow(/supported compiler language/);
    expect(() => validateSharePayload({ languageId: ' python ', source: '' })).toThrow(/supported compiler language/);
    expect(() => validateSharePayload({ languageId: 'python', source: '€'.repeat(22000) })).toThrow(/64 KiB/);
    expect(() => validateSharePayload({ languageId: 'python', source: '', stdinIncluded: true, stdin: 'x'.repeat(65537) })).toThrow(/64 KiB/);
  });
});

describe('compiler feedback validation and privacy', () => {
  it.each(['bug', 'improvement', 'general'])('accepts %s and stores only allowlisted context', (type) => {
    const result = validateFeedbackPayload({ type, description: ' Useful feedback ', languageId: 'python', route: '/python', source: 'private', stdin: 'private', email: 'private', context: { theme: 'dark', viewportWidth: 1200, source: 'private', authToken: 'private' } });
    expect(result.description).toBe('Useful feedback');
    expect(result.context).toEqual(expect.objectContaining({ theme: 'dark', viewportWidth: 1200 }));
    expect(JSON.stringify(result)).not.toMatch(/private|source|stdin|authToken|email/);
  });
  it('rejects invalid types and description bounds', () => {
    expect(() => validateFeedbackPayload({ type: 'other', description: 'valid text' })).toThrow(/valid feedback type/);
    expect(() => validateFeedbackPayload({ type: 'bug', description: 'no' })).toThrow(/between 5 and 5000/);
    expect(() => validateFeedbackPayload({ type: 'bug', description: 'x'.repeat(5001) })).toThrow(/between 5 and 5000/);
    expect(() => validateFeedbackPayload({ type: 'bug', description: 'valid text', languageId: 'Python' })).toThrow(/Invalid compiler language/);
  });
});
