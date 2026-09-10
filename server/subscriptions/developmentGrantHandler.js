import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { SubscriptionService } from '../../functions/src/subscriptions/SubscriptionService.js';
import { firebaseAITutorAuthenticator } from '../ai/auth/FirebaseAITutorAuthenticator.js';
import { createRequestFirebaseApp } from '../firebaseAdminApp.js';

export function createDevelopmentGrantHandler({ environment = process.env, authenticator = firebaseAITutorAuthenticator } = {}) {
  return async function developmentGrantHandler(request, response) {
    if (environment.LOCAL_SUBSCRIPTION_GRANTS !== 'true' || environment.LOCAL_COIN_FULL_STACK !== 'true'
      || environment.FIREBASE_PROJECT_ID !== 'demo-mitutora-coins' || environment.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080') {
      return response.status(404).json({ error: { code: 'subscription/not-available', message: 'Subscription grants are unavailable.' } });
    }
    if (request.method !== 'POST') return response.status(405).json({ error: { code: 'subscription/method-not-allowed', message: 'Use POST.' } });
    let session;
    try {
      const principal = await authenticator.authenticate(request, { environment });
      session = await createRequestFirebaseApp(environment);
      const service = new SubscriptionService({ db: getFirestore(session.app), timestamp: Timestamp });
      const result = await service.grantDevelopmentPlan({ principal, request: request.body });
      return response.status(200).json({ tier: result.entitlement.tier, planId: result.entitlement.planId, expiresAt: result.entitlement.expiresAt.toISOString(), duplicate: result.duplicate });
    } catch (error) {
      const authentication = ['ai/auth-required', 'ai/auth-invalid', 'subscription/unauthenticated'].includes(error?.code);
      return response.status(authentication ? 401 : 400).json({ error: { code: authentication ? 'subscription/unauthenticated' : (error?.code || 'subscription/invalid-request'), message: authentication ? 'Sign in to manage your subscription.' : 'The development subscription grant was rejected.' } });
    } finally { await session?.close(); }
  };
}
