import { Firestore } from '@google-cloud/firestore';
import { requiresFederatedTutorCredentials } from '../ai/tutor/tutorRuntimeConfig.js';

export const COMPILER_PUBLIC_DATABASE_ID = '(default)';

export function createCompilerPublicFirestore(environment = process.env, {
  authClient = null,
  FirestoreClient = Firestore,
} = {}) {
  const projectId = String(environment.FIREBASE_PROJECT_ID || environment.GCLOUD_PROJECT || '').trim();
  if (!projectId) throw new TypeError('A Firebase project ID is required.');
  if (requiresFederatedTutorCredentials(environment) && !authClient) {
    throw new TypeError('A deployed WIF auth client is required.');
  }
  return new FirestoreClient({
    projectId,
    databaseId: COMPILER_PUBLIC_DATABASE_ID,
    ...(authClient ? { authClient } : {}),
  });
}

export async function closeCompilerPublicFirestore(firestore) {
  if (typeof firestore?.terminate === 'function') await firestore.terminate();
}
