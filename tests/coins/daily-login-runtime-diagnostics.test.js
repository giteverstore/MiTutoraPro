import { describe, expect, it, vi } from 'vitest';
import { createDailyLoginHandler, dailyLoginFailureCategory } from '../../server/coins/dailyLoginHandler.js';

function responseRecorder() {
  const state = { statusCode: null, body: null, headers: {} };
  return {
    state,
    setHeader: vi.fn((name, value) => { state.headers[name] = value; }),
    status(statusCode) {
      state.statusCode = statusCode;
      return { json(body) { state.body = body; return state; } };
    },
  };
}

describe('Daily Login runtime diagnostics', () => {
  it.each([
    [{ code: 7 }, 'PERMISSION_DENIED'],
    [{ code: 16 }, 'UNAUTHENTICATED'],
    [{ code: 5 }, 'DATABASE_NOT_FOUND'],
    [{ code: 'firestore/invalid-credential' }, 'INVALID_CREDENTIAL'],
    [{ code: 'ai/auth-invalid' }, 'AUTH_TOKEN_VERIFY'],
    [new Error('private runtime detail'), 'RUNTIME_FAILURE'],
  ])('normalizes failures without returning raw details', (error, category) => {
    expect(dailyLoginFailureCategory(error)).toBe(category);
  });

  it('logs only the bounded failing stage and category', async () => {
    const sensitive = Object.assign(new Error('sensitive material and private document contents'), { code: 7, subject: 'SENSITIVE_IDENTITY_SENTINEL' });
    const logger = { error: vi.fn() };
    const response = responseRecorder();
    const handler = createDailyLoginHandler({
      environment: {},
      logger,
      credentialFactory: () => ({ preflight: vi.fn(async () => {}) }),
      authenticator: { authenticate: vi.fn(async () => ({ uid: 'SENSITIVE_IDENTITY_SENTINEL' })) },
      firestoreFactory: vi.fn(async () => { throw sensitive; }),
    });

    await handler({ method: 'POST', headers: { authorization: 'SENSITIVE_AUTH_SENTINEL' }, body: { private: true } }, response);

    expect(response.state).toEqual({
      statusCode: 503,
      body: { error: { code: 'coin/service-unavailable', message: 'The daily login reward could not be claimed.' } },
      headers: { 'Server-Timing': expect.stringMatching(/^total;dur=\d+\.\d$/) },
    });
    expect(logger.error).toHaveBeenCalledWith('daily-login-runtime-failure', {
      stage: 'FIRESTORE_CONSTRUCTION',
      category: 'PERMISSION_DENIED',
    });
    expect(JSON.stringify(logger.error.mock.calls)).not.toMatch(/SENSITIVE_AUTH_SENTINEL|SENSITIVE_IDENTITY_SENTINEL|private document/);
  });

  it('emits bounded stage timings without changing a successful response', async () => {
    const response = responseRecorder();
    const expected = { status: 'credited', rewardAmount: 1, balance: 11, revision: 2 };
    const claim = vi.fn(async () => expected);
    const handler = createDailyLoginHandler({
      environment: {},
      credentialFactory: () => ({ preflight: vi.fn(async () => {}) }),
      authenticator: { authenticate: vi.fn(async () => ({ uid: 'private-user' })) },
      firestoreFactory: vi.fn(async () => ({
        db: { doc: vi.fn(), runTransaction: vi.fn() },
        close: vi.fn(async () => {}),
      })),
      rewardServiceFactory: () => ({ claim }),
    });

    await handler({ method: 'POST', headers: {}, body: {} }, response);

    expect(response.state).toMatchObject({ statusCode: 200, body: expected });
    expect(response.state.headers['Server-Timing']).toMatch(/^wif;dur=\d+\.\d, auth;dur=\d+\.\d, client;dur=\d+\.\d, claim;dur=\d+\.\d, total;dur=\d+\.\d$/);
    expect(response.state.headers['Server-Timing']).not.toMatch(/private-user|desc=/);
  });
});
