import { describe, expect, it, vi } from 'vitest';
import { createDefaultFirestore } from '../../server/firestore/createDefaultFirestore.js';

const production = Object.freeze({
  NODE_ENV: 'production',
  AI_TUTOR_RUNTIME_BOUNDARY: 'production',
  FIREBASE_PROJECT_ID: 'mi-tutora-pro',
  GOOGLE_WIF_AUDIENCE: '//iam.googleapis.com/projects/196429461457/locations/global/workloadIdentityPools/ai-tutor-vercel/providers/vercel-production',
  GOOGLE_WIF_SERVICE_ACCOUNT_EMAIL: 'ai-tutor-runtime@mi-tutora-pro.iam.gserviceaccount.com',
});

describe('shared default Firestore WIF boundary', () => {
  it('uses the federated auth client directly against the default database', async () => {
    const authClient = {};
    const terminate = vi.fn(async () => {});
    const firebaseAppFactory = vi.fn();
    const FirestoreClient = vi.fn(function FirestoreClient(options) {
      this.options = options;
      this.terminate = terminate;
    });

    const session = await createDefaultFirestore(production, { authClient }, { FirestoreClient, firebaseAppFactory });

    expect(session.db.options).toEqual({ projectId: 'mi-tutora-pro', databaseId: '(default)', authClient });
    expect(firebaseAppFactory).not.toHaveBeenCalled();
    await session.close();
    expect(terminate).toHaveBeenCalledOnce();
  });
});
