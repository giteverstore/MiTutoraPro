import { describe, expect, it, vi } from 'vitest';
import { createDevelopmentTrustedCompletionHandler } from '../../server/courses/developmentTrustedCompletionHandler.js';

const safe = { NODE_ENV: 'development', LOCAL_COIN_FULL_STACK: 'true', FIREBASE_PROJECT_ID: 'demo-mitutora-coins', VITE_FIREBASE_PROJECT_ID: 'demo-mitutora-coins', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' };
const request = { body: { courseId: 'python', courseVersion: 'v2', lessonId: 'lesson-1-1-introduction-to-python' } };
function response() { return { status(code) { this.statusCode = code; return { json: (body) => { this.body = body; return body; } }; } }; }
function firestore(initial = null) {
  let value = initial;
  const set = vi.fn((_reference, next) => { value = next; });
  const db = {
    doc: vi.fn(() => ({ path: 'users/tester/trustedCourseProgress/python' })),
    runTransaction: (callback) => callback({ get: async () => ({ data: () => value }), set }),
  };
  return { session: { db, close: vi.fn() }, set, read: () => value };
}

describe('trusted completion development boundary', () => {
  it.each([{ NODE_ENV: 'production' }, { FIREBASE_PROJECT_ID: 'mi-tutora-pro' }, { FIRESTORE_EMULATOR_HOST: '' }])('is unavailable outside the pinned emulator boundary', async (override) => {
    const firestoreFactory = vi.fn(); const res = response();
    await createDevelopmentTrustedCompletionHandler({ environment: { ...safe, ...override }, firestoreFactory })(request, res);
    expect(res.statusCode).toBe(404); expect(firestoreFactory).not.toHaveBeenCalled();
  });

  it('requires emulator authentication before opening Firestore', async () => {
    const firestoreFactory = vi.fn(); const res = response();
    const authenticator = { authenticate: vi.fn().mockRejectedValue(Object.assign(new Error('no auth'), { code: 'ai/auth-required' })) };
    await createDevelopmentTrustedCompletionHandler({ environment: safe, authenticator, firestoreFactory })(request, res);
    expect(res.statusCode).toBe(401); expect(firestoreFactory).not.toHaveBeenCalled();
  });

  it('requires the canonical Firebase publication version rather than the content schema version', async () => {
    const firestoreFactory = vi.fn(); const res = response();
    const authenticator = { authenticate: vi.fn().mockResolvedValue({ uid: 'tester' }) };
    await createDevelopmentTrustedCompletionHandler({ environment: safe, authenticator, firestoreFactory })({
      body: { ...request.body, courseVersion: '2.0.0' },
    }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe('development/identity-mismatch');
    expect(firestoreFactory).not.toHaveBeenCalled();
  });

  it('records the canonical first lesson and rejects out-of-order progression', async () => {
    const store = firestore();
    const authenticator = { authenticate: vi.fn().mockResolvedValue({ uid: 'tester' }) };
    const handler = createDevelopmentTrustedCompletionHandler({ environment: safe, authenticator, firestoreFactory: async () => store.session });
    const first = response();
    await handler(request, first);
    expect(first.statusCode).toBe(200);
    expect(store.read().completedLessons).toEqual(['lesson-1-1-introduction-to-python']);

    const skipped = response();
    await handler({ body: { ...request.body, lessonId: 'lesson-1-3-working-of-the-program' } }, skipped);
    expect(skipped.statusCode).toBe(409);
    expect(store.read().completedLessons).toEqual(['lesson-1-1-introduction-to-python']);
  });

  it('treats an already-recorded lesson as a write-free idempotent replay', async () => {
    const store = firestore({ completedLessons: ['lesson-1-1-introduction-to-python'], lessonEvidence: {}, schemaVersion: '2.0.0' });
    const authenticator = { authenticate: vi.fn().mockResolvedValue({ uid: 'tester' }) };
    const res = response();
    await createDevelopmentTrustedCompletionHandler({ environment: safe, authenticator, firestoreFactory: async () => store.session })(request, res);
    expect(res.statusCode).toBe(200);
    expect(store.set).not.toHaveBeenCalled();
  });
});
