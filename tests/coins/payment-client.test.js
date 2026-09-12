import { describe, expect, it, vi } from 'vitest';
import { PaymentClient } from '../../src/subscriptions/PaymentClient.js';

const client = (fetchImpl) => new PaymentClient({ tokenProvider: async () => 'SYNTHETIC_AUTH_SENTINEL', fetchImpl });

describe('PaymentClient order request boundary', () => {
  it('classifies thrown Fetch failures with bounded metadata', async () => {
    const fetchImpl = vi.fn(async () => { throw Object.assign(new Error('private network detail'), { name: 'NetworkError' }); });
    await expect(client(fetchImpl).createOrder('monthly', 'request-identifier')).rejects.toMatchObject({
      category: 'ORDER_TRANSPORT_FAILED', endpoint: '/api/payments/orders', method: 'POST', exceptionName: 'NetworkError',
    });
  });

  it.each([401, 403, 503])('preserves HTTP %s and a sanitized server code', async (status) => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status, json: async () => ({ error: { code: 'payment/provider-unavailable', private: 'not released' } }) }));
    await expect(client(fetchImpl).createOrder('monthly', 'request-identifier')).rejects.toMatchObject({
      category: 'ORDER_HTTP_FAILED', endpoint: '/api/payments/orders', method: 'POST', status, serverCode: 'payment/provider-unavailable',
    });
  });

  it('invokes the configured Fetch implementation with the canonical request shape', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }));
    await client(fetchImpl).createOrder('monthly', 'request-identifier');
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [endpoint, init] = fetchImpl.mock.calls[0];
    expect(endpoint).toBe('/api/payments/orders');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ Authorization: 'Bearer SYNTHETIC_AUTH_SENTINEL', 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({ planId: 'monthly', requestId: 'request-identifier' });
  });
});
