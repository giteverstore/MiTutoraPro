import { explainCode, publicAIError } from '../../server/ai/explainHandler.js';
import { explainProjectMentor } from '../../server/ai/project/projectMentorHandler.js';
import { firebaseAITutorAuthenticator } from '../../server/ai/auth/FirebaseAITutorAuthenticator.js';
import { createHttpRequestLifecycle } from '../../server/ai/httpRequestLifecycle.js';
import { createVercelGoogleCredentialContext } from '../../server/auth/VercelGoogleCredentialAdapter.js';
import { createDefaultTutorQuotaGuard } from '../../server/ai/tutor/tutorQuota.js';
import { createTutorQuotaFirestore } from '../../server/ai/quota/createTutorQuotaFirestore.js';
import { createRequestTutorFeatureGate } from '../../server/ai/tutor/tutorSmokeAuthorization.js';
import { createPremiumAccessGuard } from '../../server/subscriptions/PremiumAccessGuard.js';
import { createTutorScopeResolver } from '../../server/ai/tutor/resolveTutorScope.js';
import { FirestoreTutorExperienceStore } from '../../server/ai/tutor/FirestoreTutorExperienceStore.js';
import { TutorExperienceService } from '../../server/ai/tutor/TutorExperienceService.js';

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

function createRequestExperience(environment, googleCredentials, quotaGuard) {
  const db = createTutorQuotaFirestore(environment, { authClient: googleCredentials.authClient });
  return new TutorExperienceService({ store: new FirestoreTutorExperienceStore({ db }), identityKey: (uid) => quotaGuard.identityKey(uid) });
}

export function createAIExplainHandler({
  authenticator = firebaseAITutorAuthenticator,
  explain = (body, options) => String(body?.requestType ?? '').startsWith('project-') ? explainProjectMentor(body, options) : explainCode(body, options),
  environment = process.env,
  credentialFactory = createVercelGoogleCredentialContext,
  quotaGuardFactory = createRequestQuotaGuard,
  featureGateFactory = createRequestFeatureGate,
  premiumAccessGuardFactory = (currentEnvironment, credentials) => createPremiumAccessGuard(currentEnvironment, { authClient: credentials.authClient }),
  scopeResolver = createTutorScopeResolver(),
  experienceFactory = createRequestExperience,
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
      const entitlement = await premiumAccessGuard.assertPremium(principal);
      const tutorScope = await scopeResolver({ body: request.body, principal, signal: lifecycle.signal, environment, credentials: googleCredentials });
      const quotaGuard = quotaGuardFactory(environment, googleCredentials);
      const featureGate = featureGateFactory(environment, googleCredentials, request);
      const experience = experienceFactory(environment, googleCredentials, quotaGuard);
      let prepared;
      try {
        prepared = await experience.prepare({ principal, entitlement, scope: tutorScope, body: request.body });
        const result = await explain(request.body, { principal, signal: lifecycle.signal, quotaGuard, featureGate, tutorScope, cachedResponse: prepared.cachedResponse, cacheEligible: prepared.cache?.eligible === true });
        const usage = await experience.complete(prepared, { scope: tutorScope, body: request.body, response: result });
        response.setHeader('X-AI-Messages-Used', String(usage.usedMessages));
        response.setHeader('X-AI-Messages-Limit', usage.unlimited ? 'unlimited' : String(usage.includedLimit));
        response.setHeader('X-AI-Cache', prepared?.cachedResponse ? 'hit' : prepared?.cache?.eligible ? 'miss' : 'none');
        if (!lifecycle.signal.aborted && !response.writableEnded) return response.status(200).json(result);
        return undefined;
      } catch (error) {
        await experience.release(prepared);
        throw error;
      }
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
