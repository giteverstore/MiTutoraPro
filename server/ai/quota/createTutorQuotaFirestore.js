import { Firestore } from '@google-cloud/firestore';
import {
  createTutorQuotaFirestoreConfiguration,
  requiresFederatedTutorCredentials,
} from '../tutor/tutorRuntimeConfig.js';

/**
 * Creates the server-only Firestore client used for AI Tutor quota state.
 * Production receives the request-scoped WIF AuthClient explicitly. Local
 * development may continue to use Application Default Credentials.
 */
export function createTutorQuotaFirestore(environment = process.env, { FirestoreClient = Firestore, authClient = null } = {}) {
  const configuration = createTutorQuotaFirestoreConfiguration(environment);
  if (requiresFederatedTutorCredentials(environment) && !authClient) {
    throw new TypeError('A deployed WIF credential is required.');
  }
  return new FirestoreClient({
    projectId: configuration.projectId,
    databaseId: configuration.databaseId,
    ...(authClient ? { authClient } : {}),
  });
}
