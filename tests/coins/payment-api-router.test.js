import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createPaymentApiRouter } from '../../server/payments/paymentApiRouter.js';

function responseDouble() {
  return {
    status(value) { this.statusCode = value; return this; },
    json(value) { this.body = value; return this; },
  };
}

function request(path, method = 'GET', body) {
  const stream = Readable.from(body === undefined ? [] : [Buffer.from(body)]);
  return Object.assign(stream, { method, query: { path: [path] }, headers: {}, url: `/api/payments/${path}` });
}

describe('consolidated payment API router', () => {
  it.each([
    ['orders', 'GET', 405],
    ['verify', 'GET', 405],
    ['razorpay-webhook', 'GET', 405],
    ['reconcile', 'POST', 405],
  ])('dispatches /api/payments/%s to its existing method contract', async (path, method, expectedStatus) => {
    const response = responseDouble();
    await createPaymentApiRouter()(request(path, method), response);
    expect(response.statusCode).toBe(expectedStatus);
  });

  it('rejects malformed JSON before an order handler receives it', async () => {
    const response = responseDouble();
    await createPaymentApiRouter()(request('orders', 'POST', '{'), response);
    expect(response.statusCode).toBe(400);
    expect(response.body.error.code).toBe('payment/invalid-request');
  });

  it('returns a sanitized 404 for unknown payment paths', async () => {
    const response = responseDouble();
    await createPaymentApiRouter()(request('unknown'), response);
    expect(response.statusCode).toBe(404);
    expect(response.body.error.code).toBe('payment/not-found');
  });
});
