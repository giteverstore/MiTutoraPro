import { AIServiceError } from './ai/AIServiceError.js';
import { randomUUID } from 'node:crypto';
import {
  requiresFederatedTutorCredentials,
  resolveTutorRuntimeProfile,
} from './ai/tutor/tutorRuntimeConfig.js';

let appPromise;

function configurationError(cause) {
  return new AIServiceError('ai/server-unavailable', 'AI Tutor server configuration is unavailable.', { status: 503, cause });
}

export function resolveFirebaseAdminConfiguration(environment = process.env) {
  const profile = resolveTutorRuntimeProfile(environment);
  const federated = requiresFederatedTutorCredentials(environment);
  const projectId = String(environment.FIREBASE_PROJECT_ID || environment.GCLOUD_PROJECT || '').trim();
  if (federated && !projectId) throw configurationError();
  if (profile && projectId !== profile.projectId) throw configurationError();

  const serialized = environment.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (profile && serialized) throw configurationError();
  if (!serialized) return Object.freeze({ projectId: projectId || undefined, serviceAccount: null });
  try {
    const serviceAccount = JSON.parse(serialized);
    if (!serviceAccount || typeof serviceAccount !== 'object' || Array.isArray(serviceAccount)) throw new TypeError('Invalid service account configuration.');
    const credentialProjectId = String(serviceAccount.project_id || '').trim();
    if (projectId && credentialProjectId && credentialProjectId !== projectId) throw new TypeError('Firebase project configuration mismatch.');
    return Object.freeze({ projectId: projectId || credentialProjectId || undefined, serviceAccount });
  } catch (cause) {
    throw configurationError(cause);
  }
}

export async function createRequestFirebaseApp(environment = process.env, {
  firebaseCredential,
  appModule: providedAppModule,
} = {}) {
  const configuration = resolveFirebaseAdminConfiguration(environment);
  const appModule = providedAppModule ?? await import('firebase-admin/app');
  if (requiresFederatedTutorCredentials(environment) && !firebaseCredential) throw configurationError();
  const credential = firebaseCredential ?? credentialFromConfiguration(appModule, configuration);
  const app = appModule.initializeApp({
    credential,
    projectId: configuration.projectId,
  }, `mitutora-request-${randomUUID()}`);
  return Object.freeze({
    app,
    async close() {
      await appModule.deleteApp(app);
    },
  });
}

function credentialFromConfiguration(appModule, configuration) {
  return configuration.serviceAccount
    ? appModule.cert(configuration.serviceAccount)
    : appModule.applicationDefault();
}

export function getServerFirebaseApp(environment = process.env) {
  if (requiresFederatedTutorCredentials(environment)) throw configurationError();
  const configuration = resolveFirebaseAdminConfiguration(environment);
  if (!appPromise) {
    appPromise = import('firebase-admin/app').then((appModule) => {
      const name = 'mitutora-server';
      const existing = appModule.getApps().find((app) => app.name === name);
      return existing ?? appModule.initializeApp({
        credential: credentialFromConfiguration(appModule, configuration),
        projectId: configuration.projectId,
      }, name);
    });
  }
  return appPromise;
}
