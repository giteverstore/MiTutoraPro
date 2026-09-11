import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { firebaseAITutorAuthenticator } from '../ai/auth/FirebaseAITutorAuthenticator.js';
import { createVercelGoogleCredentialContext } from '../auth/VercelGoogleCredentialAdapter.js';
import { createRequestFirebaseApp } from '../firebaseAdminApp.js';
import { PaymentService } from '../../functions/src/payments/PaymentService.js';
import { PaymentActivationCoordinator } from '../../functions/src/payments/PaymentActivationCoordinator.js';
import { RazorpayPaymentCoordinator } from '../../functions/src/payments/RazorpayPaymentCoordinator.js';
import { RazorpayPaymentProvider } from '../../functions/src/payments/providers/razorpay/RazorpayPaymentProvider.js';
import { PaymentFinancialLifecycleCoordinator } from '../../functions/src/payments/PaymentFinancialLifecycleCoordinator.js';
import { ReferralSettlementService } from '../../functions/src/payments/ReferralSettlementService.js';
import { SubscriptionService } from '../../functions/src/subscriptions/SubscriptionService.js';
import { WalletService } from '../../functions/src/wallet/WalletService.js';
import { CallableAbuseGuard } from '../../functions/src/security/CallableAbuseGuard.js';
import { PaymentReconciliationService } from '../../functions/src/payments/PaymentReconciliationService.js';
import { FirestorePaymentReconciliationRepository } from '../../functions/src/payments/FirestorePaymentReconciliationRepository.js';
import { timingSafeEqual } from 'node:crypto';

const MAX_WEBHOOK_BYTES = 256 * 1024;
const publicError = (error) => {
  const code = String(error?.code ?? 'payment/unavailable');
  const status = Number(error?.status) || (code === 'resource-exhausted' ? 429 : code.includes('auth') ? 401 : code.includes('not-found') ? 404 : code.includes('conflict') || code.includes('pending') ? 409 : code.startsWith('payment/invalid') || code.includes('mismatch') ? 400 : 503);
  return { status, body: { error: { code, message: status < 500 ? error.message : 'Payment processing is temporarily unavailable.' } } };
};

const PAYMENT_LIMITS = Object.freeze({
  order: Object.freeze({ limit: 5, windowMs: 10 * 60_000 }),
  verify: Object.freeze({ limit: 20, windowMs: 10 * 60_000 }),
});

function reportOperationalFailure(logger, operation, error) {
  logger?.error?.('payment-operation-failed', {
    operation,
    errorCode: String(error?.code ?? 'payment/unavailable'),
    status: Number(error?.status) || 503,
  });
}

async function dependencies(request, environment, authenticator, credentialFactory, providerFactory, operation) {
  const googleCredentials = credentialFactory({ request, environment });
  await googleCredentials.preflight();
  const principal = await authenticator.authenticate(request, { environment, googleCredentials });
  const session = await createRequestFirebaseApp(environment, { firebaseCredential: googleCredentials.firebaseCredential });
  try {
    const db = getFirestore(session.app); const paymentService = new PaymentService({ db, timestamp: Timestamp });
    await new CallableAbuseGuard({ db }).enforce(principal.uid, `payment-${operation}`, PAYMENT_LIMITS[operation]);
    const activationCoordinator = new PaymentActivationCoordinator({ db, timestamp: Timestamp, pendingRewardCoordinator: new WalletService({ db, timestamp: Timestamp }) });
    return { principal, session, coordinator: new RazorpayPaymentCoordinator({ paymentService, provider: providerFactory(environment), activationCoordinator }) };
  } catch (error) {
    await session.close();
    throw error;
  }
}

export function createPaymentOrderHandler({ environment = process.env, authenticator = firebaseAITutorAuthenticator, credentialFactory = createVercelGoogleCredentialContext, providerFactory = (env) => new RazorpayPaymentProvider({ environment: env }), logger = console } = {}) {
  return async (request, response) => {
    if (request.method !== 'POST') return response.status(405).json({ error: { code: 'payment/method-not-allowed', message: 'Use POST.' } });
    let session;
    try { const context = await dependencies(request, environment, authenticator, credentialFactory, providerFactory, 'order'); session = context.session; return response.status(200).json(await context.coordinator.createOrder({ principal: context.principal, request: request.body })); }
    catch (error) { reportOperationalFailure(logger, 'order-create', error); const safe = publicError(error); return response.status(safe.status).json(safe.body); }
    finally { await session?.close(); }
  };
}

export function createPaymentVerifyHandler(options = {}) {
  const { environment = process.env, authenticator = firebaseAITutorAuthenticator, credentialFactory = createVercelGoogleCredentialContext, providerFactory = (env) => new RazorpayPaymentProvider({ environment: env }), logger = console } = options;
  return async (request, response) => {
    if (request.method !== 'POST') return response.status(405).json({ error: { code: 'payment/method-not-allowed', message: 'Use POST.' } });
    let session;
    try { const context = await dependencies(request, environment, authenticator, credentialFactory, providerFactory, 'verify'); session = context.session; const result = await context.coordinator.verifyCheckout({ principal: context.principal, request: request.body }); return response.status(result.status === 'CAPTURED' ? 200 : 202).json({ paymentId: result.paymentId, status: result.status }); }
    catch (error) { reportOperationalFailure(logger, 'checkout-verify', error); const safe = publicError(error); return response.status(safe.status).json(safe.body); }
    finally { await session?.close(); }
  };
}

export function readRawBody(request, maximum = MAX_WEBHOOK_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0; let settled = false;
    request.on('data', (chunk) => { size += chunk.length; if (size > maximum) { settled = true; reject(Object.assign(new Error('Webhook is too large.'), { code: 'payment/webhook-too-large', status: 413 })); request.destroy(); } else chunks.push(chunk); });
    request.on('end', () => { if (!settled) resolve(Buffer.concat(chunks)); });
    request.on('error', () => { if (!settled) reject(Object.assign(new Error('Webhook body is unavailable.'), { code: 'payment/invalid-webhook' })); });
  });
}

export function createRazorpayWebhookHandler({ environment = process.env, credentialFactory = createVercelGoogleCredentialContext, providerFactory = (env) => new RazorpayPaymentProvider({ environment: env }), bodyReader = readRawBody, logger = console } = {}) {
  return async (request, response) => {
    if (request.method !== 'POST') return response.status(405).json({ error: { code: 'payment/method-not-allowed', message: 'Use POST.' } });
    let session;
    try {
      const rawBody = await bodyReader(request);
      const googleCredentials = credentialFactory({ request, environment }); await googleCredentials.preflight();
      session = await createRequestFirebaseApp(environment, { firebaseCredential: googleCredentials.firebaseCredential });
      const db = getFirestore(session.app); const paymentService = new PaymentService({ db, timestamp: Timestamp });
      const entitlementService = new SubscriptionService({ db, timestamp: Timestamp });
      const coordinator = new RazorpayPaymentCoordinator({
        paymentService,
        provider: providerFactory(environment),
        activationCoordinator: new PaymentActivationCoordinator({ db, timestamp: Timestamp, pendingRewardCoordinator: new WalletService({ db, timestamp: Timestamp }) }),
        lifecycleCoordinator: new PaymentFinancialLifecycleCoordinator({
          referralSettlementService: new ReferralSettlementService({ db, timestamp: Timestamp, entitlementService, recomputeEntitlement: false }),
          entitlementService,
        }),
      });
      await coordinator.processWebhook({ rawBody, headers: request.headers });
      return response.status(200).json({ received: true });
    } catch (error) { reportOperationalFailure(logger, 'webhook-process', error); const safe = publicError(error); return response.status(safe.status).json(safe.body); }
    finally { await session?.close(); }
  };
}

function authorizedCron(request, environment) {
  const secret = String(environment.CRON_SECRET ?? '');
  const supplied = String(request.headers?.authorization ?? '');
  const expected = `Bearer ${secret}`;
  if (secret.length < 16 || Buffer.byteLength(supplied) !== Buffer.byteLength(expected)) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

async function reconciliationContext(request, environment, credentialFactory, providerFactory) {
  const googleCredentials = credentialFactory({ request, environment });
  await googleCredentials.preflight();
  const session = await createRequestFirebaseApp(environment, { firebaseCredential: googleCredentials.firebaseCredential });
  try {
    const db = getFirestore(session.app);
    const paymentService = new PaymentService({ db, timestamp: Timestamp });
    const entitlementService = new SubscriptionService({ db, timestamp: Timestamp });
    const activationCoordinator = new PaymentActivationCoordinator({ db, timestamp: Timestamp, pendingRewardCoordinator: new WalletService({ db, timestamp: Timestamp }) });
    const lifecycleCoordinator = new PaymentFinancialLifecycleCoordinator({
      referralSettlementService: new ReferralSettlementService({ db, timestamp: Timestamp, entitlementService, recomputeEntitlement: false }),
      entitlementService,
    });
    return {
      session,
      service: new PaymentReconciliationService({
        paymentRepository: new FirestorePaymentReconciliationRepository({ db }),
        providerAdapter: providerFactory(environment),
        paymentService,
        purchaseCoordinator: activationCoordinator,
        lifecycleCoordinator,
      }),
    };
  } catch (error) {
    await session.close();
    throw error;
  }
}

export function createPaymentReconciliationHandler({ environment = process.env, credentialFactory = createVercelGoogleCredentialContext, providerFactory = (env) => new RazorpayPaymentProvider({ environment: env }), contextFactory = reconciliationContext, logger = console } = {}) {
  return async (request, response) => {
    if (request.method !== 'GET') return response.status(405).json({ error: { code: 'payment/method-not-allowed', message: 'Use GET.' } });
    if (!authorizedCron(request, environment)) return response.status(401).json({ error: { code: 'payment/unauthorized', message: 'Unauthorized.' } });
    let session;
    try {
      const context = await contextFactory(request, environment, credentialFactory, providerFactory);
      session = context.session;
      const results = await context.service.reconcile({ limit: 25 });
      return response.status(200).json({ processed: results.length });
    } catch (error) {
      reportOperationalFailure(logger, 'provider-reconcile', error);
      const safe = publicError(error);
      return response.status(safe.status).json(safe.body);
    } finally {
      await session?.close();
    }
  };
}
