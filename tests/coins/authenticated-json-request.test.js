import { describe, expect, it, vi } from 'vitest';
import { authenticatedJsonPost } from '../../src/api/authenticatedJsonRequest.js';

const response = (payload, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: vi.fn().mockResolvedValue(payload),
});

describe('authenticatedJsonPost', () => {
  it('requests a fresh token and sends the bearer header for every call', async () => {
    const tokenProvider = vi.fn().mockResolvedValueOnce('token-1').mockResolvedValueOnce('token-2');
    const fetchImpl = vi.fn().mockResolvedValue(response({ ok: true }));

    await authenticatedJsonPost({ tokenProvider, fetchImpl, url: '/first' });
    await authenticatedJsonPost({ tokenProvider, fetchImpl, url: '/second' });

    expect(tokenProvider).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0][1].headers).toEqual({ Authorization: 'Bearer token-1' });
    expect(fetchImpl.mock.calls[1][1].headers).toEqual({ Authorization: 'Bearer token-2' });
  });

  it('returns a missing-token result without invoking fetch', async () => {
    const fetchImpl = vi.fn();

    await expect(authenticatedJsonPost({ tokenProvider: async () => null, fetchImpl, url: '/test' }))
      .resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('propagates token-provider rejection without invoking fetch', async () => {
    const failure = new Error('token failed');
    const fetchImpl = vi.fn();
    await expect(authenticatedJsonPost({ tokenProvider: async () => { throw failure; }, fetchImpl, url: '/test' }))
      .rejects.toBe(failure);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('encodes JSON request bodies', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ saved: true }));
    await authenticatedJsonPost({
      tokenProvider: async () => 'token',
      fetchImpl,
      url: '/test',
      body: { value: 1 },
    });
    expect(fetchImpl).toHaveBeenCalledWith('/test', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value: 1 }),
    });
  });

  it('does not add a JSON content type to bodyless requests', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ items: [] }));
    await authenticatedJsonPost({ tokenProvider: async () => 'token', fetchImpl, url: '/test' });
    expect(fetchImpl.mock.calls[0][1]).toEqual({
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
    });
  });

  it('returns response and JSON payload while tolerating empty or malformed JSON', async () => {
    const validResponse = response({ value: 1 });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(validResponse)
      .mockResolvedValueOnce({ ok: true, status: 204, json: vi.fn().mockRejectedValue(new SyntaxError('empty')) })
      .mockResolvedValueOnce({ ok: false, status: 502 });

    await expect(authenticatedJsonPost({ tokenProvider: async () => 'token', fetchImpl, url: '/valid' }))
      .resolves.toEqual({ response: validResponse, payload: { value: 1 } });
    await expect(authenticatedJsonPost({ tokenProvider: async () => 'token', fetchImpl, url: '/empty' }))
      .resolves.toMatchObject({ payload: null });
    await expect(authenticatedJsonPost({ tokenProvider: async () => 'token', fetchImpl, url: '/malformed' }))
      .resolves.toMatchObject({ payload: null });
  });
});
