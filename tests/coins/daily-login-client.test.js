import { describe, expect, it, vi } from 'vitest';
import { DailyLoginClient } from '../../src/coins/DailyLoginClient.js';

describe('DailyLoginClient', () => {
  it('sends only an empty authenticated claim request', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, json: async () => ({ status: 'credited', balance: 1 }) }));
    const client = new DailyLoginClient({ fetchImpl, tokenProvider: async () => 'test-token' });
    await client.claim();
    expect(fetchImpl).toHaveBeenCalledWith('/api/activity/daily-login', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
      body: '{}',
    });
  });

  it('does nothing without an authenticated token and fails quietly on server errors', async () => {
    const fetchImpl = vi.fn();
    await expect(new DailyLoginClient({ fetchImpl, tokenProvider: async () => null }).claim()).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    const failed = new DailyLoginClient({ fetchImpl: vi.fn(async () => ({ ok: false })), tokenProvider: async () => 'token' });
    await expect(failed.claim()).resolves.toBeNull();
  });
});
