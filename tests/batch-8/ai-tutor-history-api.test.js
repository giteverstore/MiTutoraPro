import { describe, expect, it, vi } from 'vitest';
import { createAIHistoryHandler } from '../../api/ai/history.js';

function response() { return { headers: {}, setHeader: vi.fn(function setHeader(name, value) { this.headers[name] = value; }), status: vi.fn(function status(value) { this.statusCode = value; return this; }), json: vi.fn(function json(value) { this.body = value; return this; }) }; }
const credentials = { authClient: {}, preflight: vi.fn() };
const scope = { surface: 'course', scopeId: 'python', activityId: 'loops', contentVersion: 7 };

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
});
