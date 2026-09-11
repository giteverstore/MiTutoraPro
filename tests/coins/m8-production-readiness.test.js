import { describe, expect, it, vi } from 'vitest';
import { createPaymentReconciliationHandler } from '../../server/payments/paymentHandlers.js';
import { RazorpayPaymentProvider } from '../../functions/src/payments/providers/razorpay/RazorpayPaymentProvider.js';

function response() {
  return { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

describe('M8.10 production financial boundary', () => {
  it('keeps reconciliation server-only and processes a fixed bounded batch', async () => {
    const reconcile = vi.fn(async ({ limit }) => { expect(limit).toBe(25); return [{ status: 'CAPTURED' }]; });
    const close = vi.fn(async () => {});
    const contextFactory = vi.fn(async () => ({ session: { close }, service: { reconcile } }));
    const environment = { CRON_SECRET: 'synthetic-cron-secret-0001' };
    const handler = createPaymentReconciliationHandler({ environment, contextFactory });

    const denied = response();
    await handler({ method: 'GET', headers: {} }, denied);
    expect(denied).toMatchObject({ statusCode: 401, body: { error: { code: 'payment/unauthorized' } } });
    expect(contextFactory).not.toHaveBeenCalled();

    const allowed = response();
    await handler({ method: 'GET', headers: { authorization: `Bearer ${environment.CRON_SECRET}` } }, allowed);
    expect(allowed).toMatchObject({ statusCode: 200, body: { processed: 1 } });
    expect(reconcile).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it('fails closed for missing, malformed, or runtime-mismatched provider configuration', () => {
    const common = { PAYMENT_PROVIDER: 'razorpay', RAZORPAY_KEY_SECRET: 'synthetic_checkout_secret', RAZORPAY_PAYMENT_WEBHOOK_SECRET: 'synthetic_webhook_secret' };
    expect(() => new RazorpayPaymentProvider({ environment: { ...common, NODE_ENV: 'production', RAZORPAY_KEY_ID: 'rzp_test_publickey' }, fetchImpl: vi.fn() })).toThrowError(expect.objectContaining({ code: 'payment/provider-unavailable' }));
    expect(() => new RazorpayPaymentProvider({ environment: { ...common, NODE_ENV: 'development', RAZORPAY_KEY_ID: 'rzp_live_publickey' }, fetchImpl: vi.fn() })).toThrowError(expect.objectContaining({ code: 'payment/provider-unavailable' }));
    expect(() => new RazorpayPaymentProvider({ environment: { ...common, NODE_ENV: 'production', PAYMENT_PROVIDER: 'other', RAZORPAY_KEY_ID: 'rzp_live_publickey' }, fetchImpl: vi.fn() })).toThrowError(expect.objectContaining({ code: 'payment/provider-unavailable' }));
    expect(() => new RazorpayPaymentProvider({ environment: { ...common, NODE_ENV: 'production', RAZORPAY_KEY_ID: 'malformed' }, fetchImpl: vi.fn() })).toThrowError(expect.objectContaining({ code: 'payment/provider-unavailable' }));
    expect(() => new RazorpayPaymentProvider({ environment: { ...common, NODE_ENV: 'production', RAZORPAY_KEY_ID: 'rzp_live_publickey' }, fetchImpl: vi.fn() })).not.toThrow();
  });
});
