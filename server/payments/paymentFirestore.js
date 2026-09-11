import { Firestore } from '@google-cloud/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequestFirebaseApp } from '../firebaseAdminApp.js';
import { requiresFederatedTutorCredentials } from '../ai/tutor/tutorRuntimeConfig.js';

export async function createPaymentFirestore(environment = process.env, googleCredentials, {
  FirestoreClient = Firestore,
  firebaseAppFactory = createRequestFirebaseApp,
} = {}) {
  const projectId = String(environment.FIREBASE_PROJECT_ID || environment.GCLOUD_PROJECT || '').trim();
  if (requiresFederatedTutorCredentials(environment)) {
    if (!projectId || !googleCredentials?.authClient) throw new TypeError('A deployed WIF credential is required.');
    const db = new FirestoreClient({ projectId, databaseId: '(default)', authClient: googleCredentials.authClient });
    return Object.freeze({ db, async close() { await db.terminate(); } });
  }

  const session = await firebaseAppFactory(environment, { firebaseCredential: googleCredentials?.firebaseCredential });
  return Object.freeze({ db: getFirestore(session.app), close: () => session.close() });
}
