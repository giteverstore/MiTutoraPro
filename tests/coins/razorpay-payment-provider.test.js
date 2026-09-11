import { createHmac } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { RazorpayPaymentProvider } from '../../functions/src/payments/providers/razorpay/RazorpayPaymentProvider.js';
import { createPaymentProvider } from '../../functions/src/payments/PaymentProvider.js';
import { readRawBody } from '../../server/payments/paymentHandlers.js';

const environment = { NODE_ENV: 'test', PAYMENT_PROVIDER: 'razorpay', RAZORPAY_KEY_ID: 'rzp_test_publickey', RAZORPAY_KEY_SECRET: 'synthetic_checkout_secret', RAZORPAY_PAYMENT_WEBHOOK_SECRET: 'synthetic_webhook_secret' };
const jsonResponse = (value, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => value });

describe('M8.3 Razorpay payment provider', () => {
  it('selects Razorpay only through explicit server configuration', () => {
    expect(createPaymentProvider({ environment: { ...environment, PAYMENT_PROVIDER: 'razorpay' }, fetchImpl: vi.fn() })).toBeInstanceOf(RazorpayPaymentProvider);
  });
  it('fails closed when any server-side provider configuration is missing', () => {
    for (const missing of ['PAYMENT_PROVIDER', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_PAYMENT_WEBHOOK_SECRET']) expect(() => new RazorpayPaymentProvider({ environment: { ...environment, [missing]: '' }, fetchImpl: vi.fn() })).toThrowError(expect.objectContaining({ code: 'payment/provider-unavailable' }));
  });

  it('creates an exact canonical one-time order without recurring fields', async () => {
    const fetchImpl = vi.fn(async (_url, request) => {
      const body = JSON.parse(request.body);
      expect(body).toEqual({ amount: 49_900, currency: 'INR', receipt: 'order_receipt_0001', notes: { internalOrderId: 'internal-order-0001' }, partial_payment: false });
      expect(request.headers.Authorization).toMatch(/^Basic /);
      return jsonResponse({ entity: 'order', id: 'order_12345678', amount: body.amount, currency: body.currency, receipt: body.receipt, status: 'created' });
    });
    const provider = new RazorpayPaymentProvider({ environment, fetchImpl });
    expect(await provider.createOrder({ amountMinor: 49_900, currency: 'INR', receipt: 'order_receipt_0001', notes: { internalOrderId: 'internal-order-0001' } })).toMatchObject({ providerOrderId: 'order_12345678', amountMinor: 49_900, currency: 'INR' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('verifies checkout with the server order identity and rejects tampering', async () => {
    const provider = new RazorpayPaymentProvider({ environment, fetchImpl: vi.fn() });
    const signature = createHmac('sha256', environment.RAZORPAY_KEY_SECRET).update('order_12345678|pay_1234567890').digest('hex');
    await expect(provider.verifyCheckoutSignature({ serverOrderId: 'order_12345678', razorpayOrderId: 'order_12345678', razorpayPaymentId: 'pay_1234567890', razorpaySignature: signature })).resolves.toMatchObject({ providerPaymentId: 'pay_1234567890' });
    await expect(provider.verifyCheckoutSignature({ serverOrderId: 'order_12345678', razorpayOrderId: 'order_87654321', razorpayPaymentId: 'pay_1234567890', razorpaySignature: signature })).rejects.toMatchObject({ code: 'payment/invalid-callback' });
    await expect(provider.verifyCheckoutSignature({ serverOrderId: 'order_12345678', razorpayOrderId: 'order_12345678', razorpayPaymentId: 'pay_1234567890', razorpaySignature: '0'.repeat(64) })).rejects.toMatchObject({ code: 'payment/invalid-signature' });
  });

  it('verifies exact raw webhook bytes, allowlists events, and normalizes captured evidence', async () => {
    const provider = new RazorpayPaymentProvider({ environment, fetchImpl: vi.fn() });
    const rawBody = Buffer.from('{"event":"payment.captured","payload":{"payment":{"entity":{"entity":"payment","id":"pay_1234567890","order_id":"order_12345678","amount":49900,"currency":"INR","status":"captured","captured":true,"created_at":1}}}}');
    const signature = createHmac('sha256', environment.RAZORPAY_PAYMENT_WEBHOOK_SECRET).update(rawBody).digest('hex');
    const headers = { 'x-razorpay-signature': signature, 'x-razorpay-event-id': 'event_12345678' };
    await expect(provider.verifyWebhook({ rawBody, headers })).resolves.toMatchObject({ eventId: 'event_12345678', eventType: 'payment.captured', providerOrderId: 'order_12345678', providerPaymentId: 'pay_1234567890', amountMinor: 49_900, currency: 'INR', status: 'CAPTURED' });
    const byteDifferent = Buffer.from(rawBody.toString().replace('{"event"', '{ "event"'));
    await expect(provider.verifyWebhook({ rawBody: byteDifferent, headers })).rejects.toMatchObject({ code: 'payment/invalid-webhook-signature' });
  });

  it('keeps webhook HMAC verification whitespace and newline sensitive', async () => {
    const provider = new RazorpayPaymentProvider({ environment, fetchImpl: vi.fn() });
    const fixtures = [
      '{"event":"payment.captured","payload":{"payment":{"entity":{"entity":"payment","id":"pay_1234567890","order_id":"order_12345678","amount":49900,"currency":"INR","status":"captured","captured":true,"created_at":1}}}}',
      '{ "event" : "payment.captured", "payload" : { "payment" : { "entity" : { "entity" : "payment", "id" : "pay_1234567890", "order_id" : "order_12345678", "amount" : 49900, "currency" : "INR", "status" : "captured", "captured" : true, "created_at" : 1 } } } }',
      '{"payload":{"payment":{"entity":{"status":"captured","created_at":1,"currency":"INR","captured":true,"amount":49900,"order_id":"order_12345678","id":"pay_1234567890","entity":"payment"}}},"event":"payment.captured"}\n',
    ];
    for (const value of fixtures) {
      const rawBody = Buffer.from(value);
      const signature = createHmac('sha256', environment.RAZORPAY_PAYMENT_WEBHOOK_SECRET).update(rawBody).digest('hex');
      const headers = { 'x-razorpay-signature': signature, 'x-razorpay-event-id': 'event_12345678' };
      await expect(provider.verifyWebhook({ rawBody, headers })).resolves.toMatchObject({ eventType: 'payment.captured' });
      const reconstructed = Buffer.from(JSON.stringify(JSON.parse(value)));
      if (!rawBody.equals(reconstructed)) {
        await expect(provider.verifyWebhook({ rawBody: reconstructed, headers })).rejects.toMatchObject({ code: 'payment/invalid-webhook-signature' });
      }
    }
  });

  it('rejects missing and incorrect webhook signatures', async () => {
    const provider = new RazorpayPaymentProvider({ environment, fetchImpl: vi.fn() });
    const rawBody = Buffer.from('{"event":"payment.captured"}');
    await expect(provider.verifyWebhook({ rawBody, headers: { 'x-razorpay-event-id': 'event_12345678' } })).rejects.toMatchObject({ code: 'payment/invalid-webhook-signature', status: 401 });
    await expect(provider.verifyWebhook({ rawBody, headers: { 'x-razorpay-signature': '0'.repeat(64), 'x-razorpay-event-id': 'event_12345678' } })).rejects.toMatchObject({ code: 'payment/invalid-webhook-signature', status: 401 });
  });

  it('normalizes provider failures without returning credentials or raw bodies', async () => {
    const provider = new RazorpayPaymentProvider({ environment, fetchImpl: async () => jsonResponse({ secret: environment.RAZORPAY_KEY_SECRET }, 400) });
    const error = await provider.fetchPayment('pay_1234567890').catch((value) => value);
    expect(error).toMatchObject({ code: 'payment/provider-rejected' });
    expect(JSON.stringify(error)).not.toContain(environment.RAZORPAY_KEY_SECRET);
  });

  it('builds trusted reconciliation evidence only from a bound captured payment and paid order', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith('/orders/order_12345678')) return jsonResponse({ entity: 'order', id: 'order_12345678', amount: 49_900, amount_paid: 49_900, amount_due: 0, currency: 'INR', status: 'paid' });
      if (url.endsWith('/orders/order_12345678/payments')) return jsonResponse({ entity: 'collection', count: 2, items: [
        { entity: 'payment', id: 'pay_failed0001', order_id: 'order_12345678', amount: 49_900, currency: 'INR', status: 'failed', captured: false, created_at: 1 },
        { entity: 'payment', id: 'pay_captured01', order_id: 'order_12345678', amount: 49_900, currency: 'INR', status: 'captured', captured: true, created_at: 2 },
      ] });
      throw new Error('Unexpected provider request.');
    });
    const provider = new RazorpayPaymentProvider({ environment, fetchImpl });
    await expect(provider.fetchCanonicalEvidence({
      internalOrderId: `order_${'a'.repeat(64)}`, providerOrderId: 'order_12345678',
      provider: 'razorpay', amountMinor: 49_900, currency: 'INR',
    })).resolves.toMatchObject({
      provider: 'razorpay', providerOrderId: 'order_12345678', providerPaymentId: 'pay_captured01',
      status: 'CAPTURED', amountMinor: 49_900, currency: 'INR',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('fails reconciliation closed for monetary mismatch or incomplete capture evidence', async () => {
    const record = { internalOrderId: `order_${'a'.repeat(64)}`, providerOrderId: 'order_12345678', provider: 'razorpay', amountMinor: 49_900, currency: 'INR' };
    const mismatch = new RazorpayPaymentProvider({ environment, fetchImpl: vi.fn(async (url) => url.endsWith('/payments')
      ? jsonResponse({ entity: 'collection', items: [] })
      : jsonResponse({ entity: 'order', id: 'order_12345678', amount: 1, amount_paid: 1, amount_due: 0, currency: 'INR', status: 'paid' })) });
    await expect(mismatch.fetchCanonicalEvidence(record)).rejects.toMatchObject({ code: 'payment/provider-order-mismatch' });

    const incomplete = new RazorpayPaymentProvider({ environment, fetchImpl: vi.fn(async (url) => url.endsWith('/payments')
      ? jsonResponse({ entity: 'collection', items: [{ entity: 'payment', id: 'pay_captured01', order_id: 'order_12345678', amount: 49_900, currency: 'INR', status: 'captured', captured: true, created_at: 2 }] })
      : jsonResponse({ entity: 'order', id: 'order_12345678', amount: 49_900, amount_paid: 0, amount_due: 49_900, currency: 'INR', status: 'created' })) });
    await expect(incomplete.fetchCanonicalEvidence(record)).rejects.toMatchObject({ code: 'payment/provider-status-mismatch' });
  });

  it.each([
    { refundStatus: 'partial', paymentStatus: 'captured', refunded: 10_000, expected: 'PARTIALLY_REFUNDED' },
    { refundStatus: 'full', paymentStatus: 'refunded', refunded: 49_900, expected: 'REFUNDED' },
  ])('reconciles processed cumulative $expected evidence from Payment and Refund APIs', async ({ refundStatus, paymentStatus, refunded, expected }) => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith('/orders/order_12345678')) return jsonResponse({ entity: 'order', id: 'order_12345678', amount: 49_900, amount_paid: 49_900, amount_due: 0, currency: 'INR', status: 'paid' });
      if (url.endsWith('/orders/order_12345678/payments')) return jsonResponse({ entity: 'collection', items: [{ entity: 'payment', id: 'pay_refunded01', order_id: 'order_12345678', amount: 49_900, amount_refunded: refunded, refund_status: refundStatus, currency: 'INR', status: paymentStatus, captured: true, created_at: 2 }] });
      if (url.endsWith('/payments/pay_refunded01/refunds')) return jsonResponse({ entity: 'collection', items: [
        { entity: 'refund', id: 'rfnd_processed1', payment_id: 'pay_refunded01', amount: refunded, currency: 'INR', status: 'processed', created_at: 3 },
        { entity: 'refund', id: 'rfnd_failed0001', payment_id: 'pay_refunded01', amount: 100, currency: 'INR', status: 'failed', created_at: 4 },
      ] });
      throw new Error('Unexpected provider request.');
    });
    const provider = new RazorpayPaymentProvider({ environment, fetchImpl });
    await expect(provider.fetchCanonicalEvidence({ internalOrderId: `order_${'a'.repeat(64)}`, providerOrderId: 'order_12345678', provider: 'razorpay', amountMinor: 49_900, currency: 'INR' })).resolves.toMatchObject({ status: expected, refundedAmountMinor: refunded });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('rejects pending/processed refund disagreement and cumulative refund overflow', async () => {
    const record = { internalOrderId: `order_${'a'.repeat(64)}`, providerOrderId: 'order_12345678', provider: 'razorpay', amountMinor: 49_900, currency: 'INR' };
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith('/orders/order_12345678')) return jsonResponse({ entity: 'order', id: 'order_12345678', amount: 49_900, amount_paid: 49_900, amount_due: 0, currency: 'INR', status: 'paid' });
      if (url.endsWith('/orders/order_12345678/payments')) return jsonResponse({ entity: 'collection', items: [{ entity: 'payment', id: 'pay_refunded01', order_id: 'order_12345678', amount: 49_900, amount_refunded: 10_000, refund_status: 'partial', currency: 'INR', status: 'captured', captured: true }] });
      return jsonResponse({ entity: 'collection', items: [{ entity: 'refund', id: 'rfnd_pending001', payment_id: 'pay_refunded01', amount: 10_000, currency: 'INR', status: 'pending' }] });
    });
    await expect(new RazorpayPaymentProvider({ environment, fetchImpl }).fetchCanonicalEvidence(record)).rejects.toMatchObject({ code: 'payment/provider-refund-mismatch' });
  });

  it('normalizes signed refund and dispute lifecycle events including adverse dispute loss', async () => {
    const provider = new RazorpayPaymentProvider({ environment, fetchImpl: vi.fn() });
    const verify = (payload, eventId = 'event_lifecycle01') => {
      const rawBody = Buffer.from(JSON.stringify(payload));
      const signature = createHmac('sha256', environment.RAZORPAY_PAYMENT_WEBHOOK_SECRET).update(rawBody).digest('hex');
      return provider.verifyWebhook({ rawBody, headers: { 'x-razorpay-signature': signature, 'x-razorpay-event-id': eventId } });
    };
    const payment = { entity: 'payment', id: 'pay_refunded01', order_id: 'order_12345678', amount: 49_900, amount_refunded: 10_000, refund_status: 'partial', currency: 'INR', status: 'captured', captured: true, created_at: 1 };
    await expect(verify({ event: 'refund.processed', payload: { payment: { entity: payment }, refund: { entity: { entity: 'refund', id: 'rfnd_processed1', payment_id: payment.id, amount: 10_000, currency: 'INR', status: 'processed', created_at: 2 } } } })).resolves.toMatchObject({ status: 'PARTIALLY_REFUNDED', refundedAmountMinor: 10_000 });
    const disputedPayment = { ...payment, amount_refunded: 0, refund_status: null };
    const dispute = { entity: 'dispute', id: 'disp_12345678', payment_id: payment.id, amount: 49_900, currency: 'INR', status: 'open', created_at: 3 };
    await expect(verify({ event: 'payment.dispute.created', payload: { payment: { entity: disputedPayment }, dispute: { entity: dispute } } }, 'event_dispute001')).resolves.toMatchObject({ status: 'DISPUTED' });
    await expect(verify({ event: 'payment.dispute.won', payload: { payment: { entity: disputedPayment }, dispute: { entity: { ...dispute, status: 'won' } } } }, 'event_disputewon1')).resolves.toMatchObject({ status: 'CAPTURED', favorableResolution: true });
    await expect(verify({ event: 'payment.dispute.lost', payload: { payment: { entity: disputedPayment }, dispute: { entity: { ...dispute, amount: 1, status: 'lost' } } } }, 'event_disputelost')).resolves.toMatchObject({ status: 'REVERSED' });
  });

  it('records a signed failed-refund notification without advancing financial state', async () => {
    const provider = new RazorpayPaymentProvider({ environment, fetchImpl: vi.fn() });
    const payload = { event: 'refund.failed', payload: {
      payment: { entity: { entity: 'payment', id: 'pay_1234567890', order_id: 'order_12345678', amount: 49_900, amount_refunded: 0, refund_status: null, currency: 'INR', status: 'captured', captured: true } },
      refund: { entity: { entity: 'refund', id: 'rfnd_failed0001', payment_id: 'pay_1234567890', status: 'failed', created_at: 2 } },
    } };
    const rawBody = Buffer.from(JSON.stringify(payload));
    const signature = createHmac('sha256', environment.RAZORPAY_PAYMENT_WEBHOOK_SECRET).update(rawBody).digest('hex');
    await expect(provider.verifyWebhook({ rawBody, headers: { 'x-razorpay-signature': signature, 'x-razorpay-event-id': 'event_refundfail' } })).resolves.toMatchObject({ eventType: 'refund.failed', status: 'CAPTURED', refundedAmountMinor: 0 });
  });

  it('reads bounded webhook bytes without parsing or re-serializing them', async () => {
    const request = new EventEmitter(); request.destroy = vi.fn();
    const result = readRawBody(request, 32); request.emit('data', Buffer.from('{ "exact":')); request.emit('data', Buffer.from(' true }')); request.emit('end');
    await expect(result).resolves.toEqual(Buffer.from('{ "exact": true }'));
    const oversized = new EventEmitter(); oversized.destroy = vi.fn();
    const rejected = readRawBody(oversized, 2); oversized.emit('data', Buffer.from('abc'));
    await expect(rejected).rejects.toMatchObject({ code: 'payment/webhook-too-large', status: 413 });
  });
});
