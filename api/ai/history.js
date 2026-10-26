import { firebaseAITutorAuthenticator } from '../../server/ai/auth/FirebaseAITutorAuthenticator.js';
import { createVercelGoogleCredentialContext } from '../../server/auth/VercelGoogleCredentialAdapter.js';
import { createPremiumAccessGuard } from '../../server/subscriptions/PremiumAccessGuard.js';
import { createTutorScopeResolver } from '../../server/ai/tutor/resolveTutorScope.js';
import { createTutorQuotaFirestore } from '../../server/ai/quota/createTutorQuotaFirestore.js';
import { FirestoreTutorExperienceStore } from '../../server/ai/tutor/FirestoreTutorExperienceStore.js';
import { createDefaultTutorQuotaGuard } from '../../server/ai/tutor/tutorQuota.js';
import { publicAIError } from '../../server/ai/explainHandler.js';
import { AIServiceError } from '../../server/ai/AIServiceError.js';
import { createServerTiming } from '../../server/http/serverTiming.js';

export function createAIHistoryHandler({ environment = process.env, authenticator = firebaseAITutorAuthenticator, credentialFactory = createVercelGoogleCredentialContext, scopeResolver = createTutorScopeResolver(), storeFactory, premiumAccessGuardFactory = (env, credentials) => createPremiumAccessGuard(env, { authClient: credentials.authClient }) } = {}) {
  return async function handler(request, response) {
    const timing = createServerTiming();
    if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); timing.apply(response, { include: ['total'] }); return response.status(405).json({ error: { code: 'ai/method-not-allowed', message: 'Use GET for Tutor history.' } }); }
    try {
      const finishWif = timing.start('wif'); const credentials = credentialFactory({ request, environment }); await credentials.preflight(); finishWif();
      const finishAuth = timing.start('auth'); const principal = await authenticator.authenticate(request, { environment, googleCredentials: credentials }); finishAuth();
      const finishPremium = timing.start('premium'); const entitlement = await premiumAccessGuardFactory(environment, credentials).assertPremium(principal); finishPremium();
      const version = request.query?.contentVersion == null ? undefined : Number(request.query.contentVersion); const body = { tutorScope: { surface: request.query?.surface, scopeId: request.query?.scopeId, activityId: request.query?.activityId, checkpointId: request.query?.checkpointId, taskId: request.query?.taskId, contentVersion: version } }; const finishScope = timing.start('scope'); const scope = await scopeResolver({ body, principal }); finishScope();
      if (scope.surface === 'practice') throw new AIServiceError('ai/forbidden', 'Practice Tutor history is not available.', { status: 403 });
      const finishClient = timing.start('client');
      const quota = createDefaultTutorQuotaGuard(environment, { createFirestore: (env) => createTutorQuotaFirestore(env, { authClient: credentials.authClient }) }); const ownerKey = quota.identityKey(principal.uid); const store = storeFactory ? storeFactory() : new FirestoreTutorExperienceStore({ db: createTutorQuotaFirestore(environment, { authClient: credentials.authClient }) });
      finishClient();
      const measure = async (name, operation) => {
        const finish = timing.start(name);
        try { return await operation(); }
        finally { finish(); }
      };
      const [historyResult, usageResult] = await Promise.allSettled([
        measure('history', () => store.history({ ownerKey, scope, limit: 5, before: request.query?.before || null })),
        measure('usage', () => store.usageSnapshot(ownerKey)),
      ]);
      if (historyResult.status === 'rejected') throw historyResult.reason;
      if (usageResult.status === 'rejected') throw usageResult.reason;
      const page = historyResult.value; const usage = usageResult.value;
      const payload = { ...page, usage: { usedMessages: usage.usedMessages ?? 0, includedLimit: entitlement.includedTutorMessages ?? 30, unlimited: entitlement.unlimitedTutorMessages === true, remainingMessages: entitlement.unlimitedTutorMessages === true ? null : Math.max(0, (entitlement.includedTutorMessages ?? 30) - (usage.usedMessages ?? 0)) } };
      timing.apply(response);
      return response.status(200).json(payload);
    } catch (error) { const safe = publicAIError(error); timing.apply(response, { include: ['total'] }); return response.status(safe.status).json(safe.body); }
  };
}
export default createAIHistoryHandler();
