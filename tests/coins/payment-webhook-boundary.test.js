import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createRazorpayWebhookHandler } from '../../server/payments/paymentHandlers.js';
import { createPaymentFirestore } from '../../server/payments/paymentFirestore.js';

const environment = Object.freeze({
  PAYMENT_PROVIDER: 'razorpay',
  RAZORPAY_PAYMENT_WEBHOOK_SECRET: 'synthetic-webhook-secret-0001',
});

function response() {
  return { statusCode: null, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function capturedWebhook() {
  return Buffer.from(JSON.stringify({
    event: 'payment.captured',
    payload: { payment: { entity: {
      entity: 'payment', id: 'pay_12345678', order_id: 'order_12345678', status: 'captured', captured: true,
      amount: 49_900, currency: 'INR', created_at: 1_700_000_000,
    } } },
  }));
}

function signedRequest(rawBody, signature = createHmac('sha256', environment.RAZORPAY_PAYMENT_WEBHOOK_SECRET).update(rawBody).digest('hex')) {
  return { method: 'POST', headers: { 'x-razorpay-signature': signature, 'x-razorpay-event-id': 'event_12345678' } };
}

describe('payment webhook pre-authentication boundary', () => {
  it.each([
    ['missing', undefined],
    ['malformed', 'not-a-signature'],
  ])('rejects a %s signature before authoritative initialization', async (_label, signature) => {
    const rawBody = capturedWebhook();
    const credentialFactory = vi.fn();
    const firestoreFactory = vi.fn();
    const providerFactory = vi.fn();
    const contextFactory = vi.fn();
    const handler = createRazorpayWebhookHandler({
      environment, credentialFactory, firestoreFactory, providerFactory, contextFactory,
      bodyReader: vi.fn(async () => rawBody), logger: { error: vi.fn() },
    });
    const reply = response();

    const request = signature === undefined
      ? { method: 'POST', headers: { 'x-razorpay-event-id': 'event_12345678' } }
      : signedRequest(rawBody, signature);
    await handler(request, reply);

    expect(reply).toMatchObject({ statusCode: 401, body: { error: { code: 'payment/invalid-webhook-signature' } } });
    expect(credentialFactory).not.toHaveBeenCalled();
    expect(firestoreFactory).not.toHaveBeenCalled();
    expect(providerFactory).not.toHaveBeenCalled();
    expect(contextFactory).not.toHaveBeenCalled();
  });

  it('verifies exact raw bytes before creating authoritative dependencies', async () => {
    const calls = []; const rawBody = capturedWebhook();
    const close = vi.fn(async () => calls.push('close'));
    const processVerifiedWebhook = vi.fn(async (evidence) => {
      calls.push('orchestrate');
      expect(evidence).toMatchObject({ provider: 'razorpay', status: 'CAPTURED', providerOrderId: 'order_12345678' });
    });
    const contextFactory = vi.fn(async () => { calls.push('initialize'); return { session: { close }, coordinator: { processVerifiedWebhook } }; });
    const handler = createRazorpayWebhookHandler({ environment, bodyReader: vi.fn(async () => rawBody), contextFactory });
    const reply = response();

    await handler(signedRequest(rawBody), reply);

    expect(calls).toEqual(['initialize', 'orchestrate', 'close']);
    expect(reply).toMatchObject({ statusCode: 200, body: { received: true } });
  });

  it('sanitizes dependency failures after a valid signature without orchestration', async () => {
    const rawBody = capturedWebhook(); const logger = { error: vi.fn() }; const processVerifiedWebhook = vi.fn();
    const handler = createRazorpayWebhookHandler({
      environment, bodyReader: vi.fn(async () => rawBody), logger,
      contextFactory: vi.fn(async () => { throw Object.assign(new Error('credential material must stay private'), { code: 'firestore/invalid-credential' }); }),
    });
    const reply = response();

    await handler(signedRequest(rawBody), reply);

    expect(reply).toEqual(expect.objectContaining({ statusCode: 503, body: { error: { code: 'firestore/invalid-credential', message: 'Payment processing is temporarily unavailable.' } } }));
    expect(JSON.stringify(reply.body)).not.toContain('credential material');
    expect(processVerifiedWebhook).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('payment-operation-failed', expect.objectContaining({ operation: 'webhook-process', errorCode: 'firestore/invalid-credential' }));
  });
});

describe('payment Firestore WIF boundary', () => {
  it('uses the WIF auth client directly for the default database', async () => {
    const authClient = {}; const terminate = vi.fn(async () => {});
    const FirestoreClient = vi.fn(function FirestoreClient(options) { this.options = options; this.terminate = terminate; });
    const result = await createPaymentFirestore({
      NODE_ENV: 'production', AI_TUTOR_RUNTIME_BOUNDARY: 'production', FIREBASE_PROJECT_ID: 'mi-tutora-pro',
      GOOGLE_WIF_AUDIENCE: '//iam.googleapis.com/projects/196429461457/locations/global/workloadIdentityPools/ai-tutor-vercel/providers/vercel-production',
      GOOGLE_WIF_SERVICE_ACCOUNT_EMAIL: 'ai-tutor-runtime@mi-tutora-pro.iam.gserviceaccount.com',
    }, { authClient }, { FirestoreClient });

    expect(result.db.options).toEqual({ projectId: 'mi-tutora-pro', databaseId: '(default)', authClient });
    await result.close();
    expect(terminate).toHaveBeenCalledOnce();
  });
});
