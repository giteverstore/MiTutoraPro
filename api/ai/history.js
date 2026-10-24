import { firebaseAITutorAuthenticator } from '../../server/ai/auth/FirebaseAITutorAuthenticator.js';
import { createVercelGoogleCredentialContext } from '../../server/auth/VercelGoogleCredentialAdapter.js';
import { createPremiumAccessGuard } from '../../server/subscriptions/PremiumAccessGuard.js';
import { createTutorScopeResolver } from '../../server/ai/tutor/resolveTutorScope.js';
import { createTutorQuotaFirestore } from '../../server/ai/quota/createTutorQuotaFirestore.js';
import { FirestoreTutorExperienceStore } from '../../server/ai/tutor/FirestoreTutorExperienceStore.js';
import { createDefaultTutorQuotaGuard } from '../../server/ai/tutor/tutorQuota.js';
import { publicAIError } from '../../server/ai/explainHandler.js';
import { AIServiceError } from '../../server/ai/AIServiceError.js';

export function createAIHistoryHandler({ environment = process.env, authenticator = firebaseAITutorAuthenticator, credentialFactory = createVercelGoogleCredentialContext, scopeResolver = createTutorScopeResolver(), storeFactory, premiumAccessGuardFactory = (env, credentials) => createPremiumAccessGuard(env, { authClient: credentials.authClient }) } = {}) {
  return async function handler(request, response) {
    if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); return response.status(405).json({ error: { code: 'ai/method-not-allowed', message: 'Use GET for Tutor history.' } }); }
    try {
      const credentials = credentialFactory({ request, environment }); await credentials.preflight(); const principal = await authenticator.authenticate(request, { environment, googleCredentials: credentials }); const entitlement = await premiumAccessGuardFactory(environment, credentials).assertPremium(principal);
      const version = request.query?.contentVersion == null ? undefined : Number(request.query.contentVersion); const body = { tutorScope: { surface: request.query?.surface, scopeId: request.query?.scopeId, activityId: request.query?.activityId, checkpointId: request.query?.checkpointId, taskId: request.query?.taskId, contentVersion: version } }; const scope = await scopeResolver({ body, principal });
      if (scope.surface === 'practice') throw new AIServiceError('ai/forbidden', 'Practice Tutor history is not available.', { status: 403 });
      const quota = createDefaultTutorQuotaGuard(environment, { createFirestore: (env) => createTutorQuotaFirestore(env, { authClient: credentials.authClient }) }); const ownerKey = quota.identityKey(principal.uid); const store = storeFactory ? storeFactory() : new FirestoreTutorExperienceStore({ db: createTutorQuotaFirestore(environment, { authClient: credentials.authClient }) });
      const page = await store.history({ ownerKey, scope, limit: 5, before: request.query?.before || null }); const usage = await store.usageSnapshot(ownerKey); return response.status(200).json({ ...page, usage: { usedMessages: usage.usedMessages ?? 0, includedLimit: entitlement.includedTutorMessages ?? 30, unlimited: entitlement.unlimitedTutorMessages === true, remainingMessages: entitlement.unlimitedTutorMessages === true ? null : Math.max(0, (entitlement.includedTutorMessages ?? 30) - (usage.usedMessages ?? 0)) } });
    } catch (error) { const safe = publicAIError(error); return response.status(safe.status).json(safe.body); }
  };
}
export default createAIHistoryHandler();
