import { describe, expect, it, vi } from 'vitest';
import { CoinRedemptionClient } from '../../src/coins/CoinRedemptionClient.js';

const response = (payload, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: vi.fn().mockResolvedValue(payload),
});

describe('CoinRedemptionClient', () => {
  it.each([
    ['CHALLENGE_PASS', '/api/coins/redeem/challenge-pass'],
    ['BRAND_THEME', '/api/coins/redeem/theme'],
    ['PREMIUM_MONTH', '/api/coins/redeem/premium'],
  ])('preserves the %s route and authenticated JSON request', async (type, endpoint) => {
    const fetchImpl = vi.fn().mockResolvedValue(response({ balance: 80 }));
    const request = { requestId: 'request-1' };
    await expect(new CoinRedemptionClient({ fetchImpl, tokenProvider: async () => 'token' }).redeem(type, request))
      .resolves.toEqual({ balance: 80 });
    expect(fetchImpl).toHaveBeenCalledWith(endpoint, {
      method: 'POST',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  });

  it('preserves the plain missing-auth error and skips fetch', async () => {
    const fetchImpl = vi.fn();
    await expect(new CoinRedemptionClient({ fetchImpl, tokenProvider: async () => null }).redeem('CHALLENGE_PASS', {}))
      .rejects.toEqual(new Error('Sign in to redeem coins.'));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('preserves server messages and optional error codes without adding status', async () => {
    const client = new CoinRedemptionClient({
      tokenProvider: async () => 'token',
      fetchImpl: vi.fn().mockResolvedValue(response({ error: { code: 'coin/insufficient-balance', message: 'More coins are required.' } }, { ok: false, status: 409 })),
    });
    const error = await client.redeem('BRAND_THEME', {}).catch((caught) => caught);
    expect(error).toMatchObject({ message: 'More coins are required.', code: 'coin/insufficient-balance' });
    expect(error).not.toHaveProperty('status');
  });

  it('tolerates malformed JSON and preserves the fallback error', async () => {
    const client = new CoinRedemptionClient({
      tokenProvider: async () => 'token',
      fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 502, json: vi.fn().mockRejectedValue(new SyntaxError('invalid')) }),
    });
    await expect(client.redeem('PREMIUM_MONTH', {})).rejects.toMatchObject({ message: 'Redemption could not be completed.' });
  });
});
