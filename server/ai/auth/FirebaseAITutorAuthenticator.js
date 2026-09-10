import { AIServiceError } from '../AIServiceError.js';
import { getServerFirebaseApp } from '../../firebaseAdminApp.js';
import { createRequestFirebaseApp } from '../../firebaseAdminApp.js';
import { requiresFederatedTutorCredentials } from '../tutor/tutorRuntimeConfig.js';

let adminAuthPromise;

async function loadAdminAuth(environment = process.env) {
  if (!adminAuthPromise) {
    adminAuthPromise = Promise.all([
      getServerFirebaseApp(environment),
      import('firebase-admin/auth'),
    ]).then(([app, authModule]) => {
      return authModule.getAuth(app);
    });
  }
  return adminAuthPromise;
}

export async function verifyFirebaseIdToken(token, { environment = process.env, googleCredentials } = {}) {
  if (!requiresFederatedTutorCredentials(environment)) {
    const auth = await loadAdminAuth(environment);
    return auth.verifyIdToken(token, true);
  }
  const session = await createRequestFirebaseApp(environment, {
    firebaseCredential: googleCredentials?.firebaseCredential,
  });
  try {
    const authModule = await import('firebase-admin/auth');
    return await authModule.getAuth(session.app).verifyIdToken(token, true);
  } finally {
    await session.close();
  }
}

function bearerToken(request) {
  const header = request?.headers?.authorization ?? request?.headers?.Authorization;
  if (typeof header !== 'string' || !header.trim()) {
    throw new AIServiceError('ai/auth-required', 'Sign in to use the AI Tutor.', { status: 401 });
  }
  const match = header.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) throw new AIServiceError('ai/auth-invalid', 'Your AI Tutor session is no longer valid. Sign in again.', { status: 401 });
  return match[1];
}

export class FirebaseAITutorAuthenticator {
  constructor({ verifyToken = verifyFirebaseIdToken } = {}) {
    this.verifyToken = verifyToken;
  }

  async authenticate(request, options = {}) {
    const token = bearerToken(request);
    try {
      const decoded = await this.verifyToken(token, options);
      if (!decoded || typeof decoded.uid !== 'string' || !decoded.uid) throw new Error('Verified token has no subject.');
      return Object.freeze({ uid: decoded.uid });
    } catch (error) {
      if (error instanceof AIServiceError) throw error;
      throw new AIServiceError('ai/auth-invalid', 'Your AI Tutor session is no longer valid. Sign in again.', { status: 401, cause: error });
    }
  }
}

export const firebaseAITutorAuthenticator = new FirebaseAITutorAuthenticator();
