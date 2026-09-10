import { explainCode, publicAIError } from '../../server/ai/explainHandler.js';
import { firebaseAITutorAuthenticator } from '../../server/ai/auth/FirebaseAITutorAuthenticator.js';
import { createHttpRequestLifecycle } from '../../server/ai/httpRequestLifecycle.js';
import { createVercelGoogleCredentialContext } from '../../server/auth/VercelGoogleCredentialAdapter.js';
import { createDefaultTutorQuotaGuard } from '../../server/ai/tutor/tutorQuota.js';
import { createTutorQuotaFirestore } from '../../server/ai/quota/createTutorQuotaFirestore.js';
import { createRequestTutorFeatureGate } from '../../server/ai/tutor/tutorSmokeAuthorization.js';
import { createPremiumAccessGuard } from '../../server/subscriptions/PremiumAccessGuard.js';

function createRequestQuotaGuard(environment, googleCredentials) {
  return createDefaultTutorQuotaGuard(environment, {
    createFirestore: (currentEnvironment) => createTutorQuotaFirestore(currentEnvironment, {
      authClient: googleCredentials.authClient,
    }),
  });
}

function createRequestFeatureGate(environment, googleCredentials, request) {
  return createRequestTutorFeatureGate(environment, {
    request,
    createFirestore: (currentEnvironment) => createTutorQuotaFirestore(currentEnvironment, {
      authClient: googleCredentials.authClient,
    }),
  });
}

export function createAIExplainHandler({
  authenticator = firebaseAITutorAuthenticator,
  explain = explainCode,
  environment = process.env,
  credentialFactory = createVercelGoogleCredentialContext,
  quotaGuardFactory = createRequestQuotaGuard,
  featureGateFactory = createRequestFeatureGate,
  premiumAccessGuardFactory = (currentEnvironment, credentials) => createPremiumAccessGuard(currentEnvironment, { authClient: credentials.authClient }),
} = {}) {
  return async function handler(request, response) {
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return response.status(405).json({ error: { code: 'ai/method-not-allowed', message: 'Use POST for AI explanations.' } });
    }
    const lifecycle = createHttpRequestLifecycle(request, response);
    try {
      const googleCredentials = credentialFactory({ request, environment });
      await googleCredentials.preflight();
      const principal = await authenticator.authenticate(request, { environment, googleCredentials });
      const premiumAccessGuard = premiumAccessGuardFactory(environment, googleCredentials);
      await premiumAccessGuard.assertPremium(principal);
      const quotaGuard = quotaGuardFactory(environment, googleCredentials);
      const featureGate = featureGateFactory(environment, googleCredentials, request);
      const result = await explain(request.body, { principal, signal: lifecycle.signal, quotaGuard, featureGate });
      if (!lifecycle.signal.aborted && !response.writableEnded) return response.status(200).json(result);
      return undefined;
    } catch (error) {
      if (lifecycle.signal.aborted || response.writableEnded) return undefined;
      const sanitized = publicAIError(error);
      return response.status(sanitized.status).json(sanitized.body);
    } finally {
      lifecycle.cleanup();
    }
  };
}

export default createAIExplainHandler();
