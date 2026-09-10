import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActivityCompletionClient } from '../../src/coins/ActivityCompletionClient.js';

const originalFetch = globalThis.fetch;

function response(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: vi.fn(async () => body) };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('ActivityCompletionClient browser request boundary', () => {
  it('preserves the global receiver for the default browser fetch implementation', async () => {
    const fetchSpy = vi.fn(function receiverSensitiveFetch(url, options) {
      if (this !== globalThis) throw new TypeError("'fetch' called on an object that does not implement interface Window.");
      expect(url).toBe('/api/activity/complete');
      expect(options).toMatchObject({
        method: 'POST',
        headers: { Authorization: 'Bearer firebase-token', 'Content-Type': 'application/json' },
      });
      expect(JSON.parse(options.body)).toEqual({ activityType: 'DAILY_CHALLENGE', activityId: 'challenge-1', activityVersion: 'v1' });
      return Promise.resolve(response({ completionStatus: 'completed', rewardStatus: 'credited', rewardAmount: 20, balance: 20 }));
    });
    globalThis.fetch = fetchSpy;
    const client = new ActivityCompletionClient({ tokenProvider: async () => 'firebase-token' });

    await expect(client.complete({ activityType: 'DAILY_CHALLENGE', activityId: 'challenge-1', activityVersion: 'v1' }))
      .resolves.toMatchObject({ rewardStatus: 'credited', rewardAmount: 20, balance: 20 });
    expect(fetchSpy).toHaveBeenCalledOnce();
  });

  it('preserves explicitly injected fetch implementations and the minimal request contract', async () => {
    const injectedFetch = vi.fn(async function injected(url, options) {
      expect(this).toBeUndefined();
      expect(url).toBe('/test/activity');
      expect(JSON.parse(options.body)).toEqual({ activityType: 'PRACTICE', activityId: 'practice-1', activityVersion: 'v2' });
      expect(options.body).not.toContain('uid');
      expect(options.body).not.toContain('rewardAmount');
      expect(options.body).not.toContain('policyVersion');
      return response({ completionStatus: 'completed', rewardStatus: 'credited', rewardAmount: 5, balance: 5 });
    });
    const client = new ActivityCompletionClient({ endpoint: '/test/activity', fetchImpl: injectedFetch, tokenProvider: async () => 'firebase-token' });

    await expect(client.complete({ activityType: 'PRACTICE', activityId: 'practice-1', activityVersion: 'v2', uid: 'forged', rewardAmount: 999, policyVersion: 'forged' }))
      .resolves.toMatchObject({ rewardStatus: 'credited', rewardAmount: 5, balance: 5 });
    expect(injectedFetch).toHaveBeenCalledOnce();
  });

  it('fails before fetch without authentication and sanitizes server/network outcomes', async () => {
    const fetchImpl = vi.fn();
    const unauthenticated = new ActivityCompletionClient({ fetchImpl, tokenProvider: async () => null });
    await expect(unauthenticated.complete({ activityType: 'PRACTICE', activityId: 'practice-1', activityVersion: 'v2' }))
      .rejects.toMatchObject({ code: 'coin/unauthenticated', status: 401 });
    expect(fetchImpl).not.toHaveBeenCalled();

    const rejected = new ActivityCompletionClient({ fetchImpl: async () => response({ error: { code: 'coin/service-unavailable', message: 'Completion could not be saved.' } }, { ok: false, status: 503 }), tokenProvider: async () => 'firebase-token' });
    await expect(rejected.complete({ activityType: 'PRACTICE', activityId: 'practice-1', activityVersion: 'v2' }))
      .rejects.toMatchObject({ code: 'coin/service-unavailable', status: 503 });
  });
});
