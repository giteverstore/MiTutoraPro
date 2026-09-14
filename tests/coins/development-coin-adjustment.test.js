import { describe, expect, it, vi } from 'vitest';
import { createDevelopmentCoinAdjustmentHandler } from '../../server/coins/developmentCoinAdjustmentHandler.js';

const safeEnvironment = {
  NODE_ENV: 'development', LOCAL_COIN_FULL_STACK: 'true', VITE_FIREBASE_USE_EMULATORS: 'true',
  FIREBASE_PROJECT_ID: 'demo-mitutora-coins', VITE_FIREBASE_PROJECT_ID: 'demo-mitutora-coins',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
};
const response = () => ({ status: vi.fn(function status(code) { this.statusCode = code; return { json: (body) => { this.body = body; return body; } }; }) });

describe('development coin adjustment boundary', () => {
  it.each([-1, 1.5, 100_001, '100'])('rejects invalid target balance %s before persistence', async (targetBalance) => {
    const firestoreFactory = vi.fn(); const res = response();
    await createDevelopmentCoinAdjustmentHandler({ environment: safeEnvironment, firestoreFactory })({ method: 'POST', body: { targetBalance, requestId: 'request-1' } }, res);
    expect(res.statusCode).toBe(400); expect(firestoreFactory).not.toHaveBeenCalled();
  });

  it.each([
    { NODE_ENV: 'production' },
    { FIREBASE_PROJECT_ID: 'mi-tutora-pro' },
    { FIRESTORE_EMULATOR_HOST: '' },
    { FIREBASE_AUTH_EMULATOR_HOST: 'remote.example:9099' },
  ])('is unavailable outside the pinned local boundary', async (override) => {
    const firestoreFactory = vi.fn(); const res = response();
    await createDevelopmentCoinAdjustmentHandler({ environment: { ...safeEnvironment, ...override }, firestoreFactory })({ method: 'POST', body: { targetBalance: 10, requestId: 'request-1' } }, res);
    expect(res.statusCode).toBe(404); expect(firestoreFactory).not.toHaveBeenCalled();
  });

  it('requires an authenticated emulator user before opening Firestore', async () => {
    const firestoreFactory = vi.fn(); const res = response();
    const authenticator = { authenticate: vi.fn().mockRejectedValue(Object.assign(new Error('auth required'), { code: 'ai/auth-required' })) };
    await createDevelopmentCoinAdjustmentHandler({ environment: safeEnvironment, authenticator, firestoreFactory })({ method: 'POST', body: { targetBalance: 10, requestId: 'request-1' } }, res);
    expect(res.statusCode).toBe(401); expect(firestoreFactory).not.toHaveBeenCalled();
  });
});
