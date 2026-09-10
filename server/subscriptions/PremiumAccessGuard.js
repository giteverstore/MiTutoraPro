import { Firestore, Timestamp } from '@google-cloud/firestore';
import { AIServiceError } from '../ai/AIServiceError.js';
import { SubscriptionService } from '../../functions/src/subscriptions/SubscriptionService.js';

export function createPremiumAccessGuard(environment = process.env, { FirestoreClient = Firestore, authClient = null } = {}) {
  const projectId = String(environment.FIREBASE_PROJECT_ID ?? environment.GCLOUD_PROJECT ?? '').trim();
  if (!projectId) throw new AIServiceError('ai/server-unavailable', 'AI Tutor server configuration is unavailable.', { status: 503 });
  const db = new FirestoreClient({ projectId, databaseId: '(default)', ...(authClient ? { authClient } : {}) });
  const service = new SubscriptionService({ db, timestamp: Timestamp, now: () => new Date() });
  return Object.freeze({
    async assertPremium({ uid }) {
      let entitlement;
      try { entitlement = await service.hasPremiumAccess(uid); }
      catch (cause) { throw new AIServiceError('ai/server-unavailable', 'AI Tutor access could not be verified.', { status: 503, cause }); }
      if (entitlement.tier !== 'PREMIUM') {
        throw new AIServiceError('ai/premium-required', 'Premium is required to use the AI Tutor.', { status: 403 });
      }
      return entitlement;
    },
  });
}
