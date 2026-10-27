import { describe, expect, it, vi } from 'vitest';
import { createAIHistoryHandler } from '../../api/ai/history.js';

function response() { return { headers: {}, setHeader: vi.fn(function setHeader(name, value) { this.headers[name] = value; }), status: vi.fn(function status(value) { this.statusCode = value; return this; }), json: vi.fn(function json(value) { this.body = value; return this; }) }; }
const credentials = { authClient: {}, preflight: vi.fn() };
const scope = { surface: 'course', scopeId: 'python', activityId: 'loops', contentVersion: 7 };
const entitlement = { includedTutorMessages: 30 };

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
  return { promise, resolve, reject };
}

function createHandler(overrides = {}) {
  return createAIHistoryHandler({
    environment: {},
    credentialFactory: () => credentials,
    authenticator: { authenticate: async () => ({ uid: 'verified-user' }) },
    premiumAccessGuardFactory: () => ({ assertPremium: async () => entitlement }),
    scopeResolver: async () => scope,
    ...overrides,
  });
}

describe('Tutor history API ownership boundary', () => {
  it('derives owner from authenticated principal and always requests exactly five', async () => {
    const history = vi.fn().mockResolvedValue({ items: [], nextCursor: null }); const usageSnapshot = vi.fn().mockResolvedValue({ usedMessages: 4, reservedMessages: 0 });
    const handler = createAIHistoryHandler({ environment: {}, credentialFactory: () => credentials, authenticator: { authenticate: async () => ({ uid: 'verified-user' }) }, premiumAccessGuardFactory: () => ({ assertPremium: async () => ({ includedTutorMessages: 30 }) }), scopeResolver: async () => scope, storeFactory: () => ({ history, usageSnapshot }) }); const res = response();
    await handler({ method: 'GET', query: { ...scope, uid: 'attacker', ownerKey: 'forged' }, headers: {} }, res);
    expect(history).toHaveBeenCalledWith(expect.objectContaining({ ownerKey: expect.not.stringContaining('attacker'), scope, limit: 5 })); expect(res.body.usage).toMatchObject({ usedMessages: 4, remainingMessages: 26 });
    expect(res.headers['Server-Timing']).toMatch(/^wif;dur=\d+\.\d, auth;dur=\d+\.\d, premium;dur=\d+\.\d, scope;dur=\d+\.\d, client;dur=\d+\.\d, history;dur=\d+\.\d, usage;dur=\d+\.\d, total;dur=\d+\.\d$/);
    expect(res.headers['Server-Timing']).not.toMatch(/verified-user|python|loops|desc=/);
  });
  it('does not expose Practice retention or security-stage timing through history', async () => { const handler = createAIHistoryHandler({ environment: {}, credentialFactory: () => credentials, authenticator: { authenticate: async () => ({ uid: 'verified-user' }) }, premiumAccessGuardFactory: () => ({ assertPremium: async () => ({ includedTutorMessages: 30 }) }), scopeResolver: async () => ({ ...scope, surface: 'practice' }), storeFactory: () => ({}) }); const res = response(); await handler({ method: 'GET', query: {}, headers: {} }, res); expect(res.status).toHaveBeenCalledWith(403); expect(res.body.error.code).toBe('ai/forbidden'); expect(res.headers['Server-Timing']).toMatch(/^total;dur=\d+\.\d$/); });

  it('starts history and usage together after the security gates succeed', async () => {
    const historyResult = deferred(); const usageResult = deferred(); const started = [];
    const history = vi.fn(() => { started.push('history'); return historyResult.promise; });
    const usageSnapshot = vi.fn(() => { started.push('usage'); return usageResult.promise; });
    const res = response(); const pending = createHandler({ storeFactory: () => ({ history, usageSnapshot }) })({ method: 'GET', query: {}, headers: {} }, res);
    await vi.waitFor(() => expect(started).toEqual(['history', 'usage']));
    expect(res.json).not.toHaveBeenCalled();
    historyResult.resolve({ items: [], nextCursor: null }); usageResult.resolve({ usedMessages: 2, reservedMessages: 0 });
    await pending;
    expect(res.status).toHaveBeenCalledWith(200); expect(res.body.usage.remainingMessages).toBe(28);
  });

  it('starts Premium and canonical scope checks together, then gates private reads behind both', async () => {
    const premiumResult = deferred(); const scopeResult = deferred(); const started = [];
    const assertPremium = vi.fn(() => { started.push('premium'); return premiumResult.promise; });
    const scopeResolver = vi.fn(() => { started.push('scope'); return scopeResult.promise; });
    const history = vi.fn().mockResolvedValue({ items: [], nextCursor: null });
    const usageSnapshot = vi.fn().mockResolvedValue({ usedMessages: 0, reservedMessages: 0 });
    const res = response();
    const pending = createHandler({
      premiumAccessGuardFactory: () => ({ assertPremium }), scopeResolver,
      storeFactory: () => ({ history, usageSnapshot }),
    })({ method: 'GET', query: {}, headers: {} }, res);
    await vi.waitFor(() => expect(started).toEqual(['premium', 'scope']));
    expect(history).not.toHaveBeenCalled(); expect(usageSnapshot).not.toHaveBeenCalled();
    premiumResult.resolve(entitlement);
    await Promise.resolve();
    expect(history).not.toHaveBeenCalled(); expect(usageSnapshot).not.toHaveBeenCalled();
    scopeResult.resolve(scope);
    await pending;
    expect(history).toHaveBeenCalledTimes(1); expect(usageSnapshot).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('settles both authorization checks and preserves Premium-error precedence when both fail', async () => {
    const premiumResult = deferred(); const scopeResult = deferred();
    const history = vi.fn(); const usageSnapshot = vi.fn(); const res = response();
    const pending = createHandler({
      premiumAccessGuardFactory: () => ({ assertPremium: () => premiumResult.promise }),
      scopeResolver: () => scopeResult.promise,
      storeFactory: () => ({ history, usageSnapshot }),
    })({ method: 'GET', query: {}, headers: {} }, res);
    premiumResult.reject(new Error('premium failed'));
    await Promise.resolve();
    expect(res.json).not.toHaveBeenCalled();
    scopeResult.reject(new Error('scope failed'));
    await pending;
    expect(history).not.toHaveBeenCalled(); expect(usageSnapshot).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.headers['Server-Timing']).toMatch(/^total;dur=\d+\.\d$/);
  });

  it('does not start Premium, scope, history, or usage work when authentication fails', async () => {
    const assertPremium = vi.fn(); const scopeResolver = vi.fn(); const history = vi.fn(); const usageSnapshot = vi.fn(); const res = response();
    await createHandler({
      authenticator: { authenticate: async () => { throw new Error('auth failed'); } },
      premiumAccessGuardFactory: () => ({ assertPremium }), scopeResolver,
      storeFactory: () => ({ history, usageSnapshot }),
    })({ method: 'GET', query: {}, headers: {} }, res);
    expect(assertPremium).not.toHaveBeenCalled(); expect(scopeResolver).not.toHaveBeenCalled();
    expect(history).not.toHaveBeenCalled(); expect(usageSnapshot).not.toHaveBeenCalled();
    expect(res.headers['Server-Timing']).toMatch(/^total;dur=\d+\.\d$/);
  });

  it.each([
    ['authentication', { authenticator: { authenticate: async () => { throw new Error('auth failed'); } } }],
    ['Premium authorization', { premiumAccessGuardFactory: () => ({ assertPremium: async () => { throw new Error('premium failed'); } }) }],
    ['canonical scope resolution', { scopeResolver: async () => { throw new Error('scope failed'); } }],
  ])('does not start reads when %s fails', async (_stage, overrides) => {
    const history = vi.fn(); const usageSnapshot = vi.fn(); const res = response();
    await createHandler({ ...overrides, storeFactory: () => ({ history, usageSnapshot }) })({ method: 'GET', query: {}, headers: {} }, res);
    expect(history).not.toHaveBeenCalled(); expect(usageSnapshot).not.toHaveBeenCalled(); expect(res.status).toHaveBeenCalledWith(500); expect(res.headers['Server-Timing']).toMatch(/^total;dur=\d+\.\d$/);
  });

  it.each(['history', 'usage'])('does not return a partial response when the %s read fails', async (failedRead) => {
    const first = deferred(); const second = deferred();
    const history = vi.fn(() => first.promise); const usageSnapshot = vi.fn(() => second.promise); const res = response();
    const pending = createHandler({ storeFactory: () => ({ history, usageSnapshot }) })({ method: 'GET', query: { before: 'older-cursor' }, headers: {} }, res);
    await vi.waitFor(() => { expect(history).toHaveBeenCalledWith(expect.objectContaining({ limit: 5, before: 'older-cursor' })); expect(usageSnapshot).toHaveBeenCalledTimes(1); });
    if (failedRead === 'history') { first.reject(new Error('history failed')); await Promise.resolve(); expect(res.json).not.toHaveBeenCalled(); second.resolve({ usedMessages: 4 }); }
    else { second.reject(new Error('usage failed')); await Promise.resolve(); expect(res.json).not.toHaveBeenCalled(); first.resolve({ items: [{ id: 'private-message' }], nextCursor: null }); }
    await pending;
    expect(res.status).toHaveBeenCalledWith(500); expect(res.body).toEqual({ error: { code: 'ai/unavailable', message: 'The AI Tutor is temporarily unavailable.', retryable: false } }); expect(res.headers['Server-Timing']).toMatch(/^total;dur=\d+\.\d$/);
  });
});
