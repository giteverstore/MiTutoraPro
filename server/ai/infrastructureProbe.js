import { timingSafeEqual, randomBytes } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { getAuth } from 'firebase-admin/auth';
import {
  createVercelGoogleCredentialContext,
  readVercelPlatformOidcToken,
  resolveGoogleWifConfiguration,
} from '../auth/VercelGoogleCredentialAdapter.js';
import { createRequestFirebaseApp } from '../firebaseAdminApp.js';
import { createTutorQuotaFirestore } from './quota/createTutorQuotaFirestore.js';
import { FirestoreTutorQuotaStore } from './quota/FirestoreTutorQuotaStore.js';

const PROJECT_ID = 'mi-tutora-pro';
const QUOTA_DATABASE = 'ai-tutor-quota';
const STORAGE_BUCKET = 'mi-tutora-pro.firebasestorage.app';
const RUNTIME_ACCOUNT = 'ai-tutor-runtime@mi-tutora-pro.iam.gserviceaccount.com';
const UNRELATED_ACCOUNT = 'mi-tutora-pro@appspot.gserviceaccount.com';
const PROBE_PREFIX = 'phase47d3-';
const DIAGNOSTIC_STAGES = Object.freeze([
  'request-start',
  'probe-authentication',
  'vercel-oidc-acquired',
  'google-wif-credential-created',
  'firebase-auth-initialized',
  'quota-firestore-initialized',
  'positive-quota-operation',
  'negative-permission-tests',
  'cleanup',
  'probe-complete',
]);

const pass = Object.freeze({ pass: true });

function authorized(request, environment) {
  const expected = String(environment.AI_TUTOR_INFRA_PROBE_SECRET || '');
  const supplied = String(request?.headers?.['x-ai-tutor-infra-probe'] || '');
  if (expected.length < 32 || supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

function denied(error) {
  const code = Number(error?.response?.status || error?.code || 0);
  return code === 401 || code === 403 || code === 7 || /permission.denied|forbidden/i.test(String(error?.message || ''));
}

async function assertReadDenied(db, collection, document) {
  try {
    await db.collection(collection).doc(document).get();
    return false;
  } catch (error) {
    return denied(error);
  }
}

async function projectPermissions(authClient) {
  const permissions = [
    'datastore.databases.create',
    'firebaserules.rulesets.create',
    'cloudfunctions.functions.update',
    'resourcemanager.projects.setIamPolicy',
  ];
  const response = await authClient.request({
    url: `https://cloudresourcemanager.googleapis.com/v1/projects/${PROJECT_ID}:testIamPermissions`,
    method: 'POST',
    data: { permissions },
  });
  return new Set(response?.data?.permissions || []);
}

async function serviceAccountPermissions(authClient) {
  const response = await authClient.request({
    url: `https://iam.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(UNRELATED_ACCOUNT)}:testIamPermissions`,
    method: 'POST',
    data: { permissions: ['iam.serviceAccountKeys.create', 'iam.serviceAccounts.getAccessToken'] },
  });
  return new Set(response?.data?.permissions || []);
}

export async function runInfrastructureProbe({ request, environment = process.env, advanceStage = () => {} } = {}) {
  const credentials = createVercelGoogleCredentialContext({
    request,
    environment,
    tokenSource: async () => {
      const token = await readVercelPlatformOidcToken();
      advanceStage('vercel-oidc-acquired');
      return token;
    },
  });
  await credentials.preflight();
  advanceStage('google-wif-credential-created');
  const wif = resolveGoogleWifConfiguration(environment);
  if (wif?.serviceAccountEmail !== RUNTIME_ACCOUNT || wif?.projectId !== PROJECT_ID) throw new Error('Unexpected workload identity.');

  const firebaseSession = await createRequestFirebaseApp(environment, { firebaseCredential: credentials.firebaseCredential });
  try { getAuth(firebaseSession.app); } finally { await firebaseSession.close(); }
  advanceStage('firebase-auth-initialized');

  const db = createTutorQuotaFirestore(environment, { authClient: credentials.authClient });
  advanceStage('quota-firestore-initialized');
  const suffix = randomBytes(18).toString('hex');
  const identityKey = `${PROBE_PREFIX}${suffix}`;
  const requestId = `${PROBE_PREFIX}${suffix}-reservation`;
  const store = new FirestoreTutorQuotaStore({ db });
  const policy = {
    burst: { requests: 10, windowMs: 60_000 },
    sustained: { requests: 10, windowMs: 60_000 },
    hourly: { requests: 10, windowMs: 3_600_000 },
    daily: { requests: 10, inputTokens: 1_000, outputTokens: 1_000, costMicros: 1_000 },
  };
  const estimate = { inputTokens: 1, outputTokens: 1, costMicros: 1 };
  const reservation = await store.reserve({ identityKey, requestId, policy, estimate, maximum: estimate });
  const quotaSnapshot = await db.collection('aiTutorQuotas').doc(identityKey).get();
  const reservationSnapshot = await db.collection('aiTutorQuotaReservations').doc(requestId).get();
  if (!quotaSnapshot.exists || !reservationSnapshot.exists) throw new Error('Quota probe failed.');
  const duplicate = await store.reserve({ identityKey, requestId, policy, estimate, maximum: estimate });
  if (duplicate.requestId !== requestId) throw new Error('Idempotency probe failed.');
  let conflict = false;
  try { await store.reserve({ identityKey: `${identityKey}-conflict`, requestId, policy, estimate, maximum: estimate }); }
  catch (error) { conflict = error?.code === 'ai/idempotency-conflict'; }
  if (!conflict) throw new Error('Idempotency conflict probe failed.');
  await store.settle(reservation, { inputTokens: 1, outputTokens: 1, costMicros: 1, outcome: 'probe' });
  advanceStage('positive-quota-operation');

  const defaultDb = new Firestore({ projectId: PROJECT_ID, databaseId: '(default)', authClient: credentials.authClient });
  const defaultDenied = await assertReadDenied(defaultDb, 'aiTutorInfrastructureProbe', 'phase47d3');
  if (!defaultDenied) throw new Error('Default database access unexpectedly succeeded.');
  const unrelatedDenied = await assertReadDenied(defaultDb, 'users', 'phase47d3-synthetic');
  if (!unrelatedDenied) throw new Error('Unrelated data access unexpectedly succeeded.');

  let storageDenied = false;
  try {
    await credentials.authClient.request({
      url: `https://storage.googleapis.com/storage/v1/b/${STORAGE_BUCKET}/o`,
      method: 'GET',
      params: { maxResults: 1 },
    });
  } catch (error) { storageDenied = denied(error); }
  if (!storageDenied) throw new Error('Storage access unexpectedly succeeded.');

  const granted = await projectPermissions(credentials.authClient);
  const serviceAccountGranted = await serviceAccountPermissions(credentials.authClient);
  advanceStage('negative-permission-tests');
  return Object.freeze({
    probe: 'ai-tutor-infrastructure',
    status: 'verification-complete-pending-cleanup',
    firebaseAuth: 'pass',
    wifIdentity: 'pass',
    quotaFirestore: 'pass',
    positiveQuota: 'pass',
    defaultDatabaseDenied: 'pass',
    unrelatedDataDenied: 'pass',
    storageDenied: 'pass',
    firestoreAdminDenied: granted.has('datastore.databases.create') ? 'fail' : 'pass',
    rulesAdminDenied: granted.has('firebaserules.rulesets.create') ? 'fail' : 'pass',
    functionsAdminDenied: granted.has('cloudfunctions.functions.update') ? 'fail' : 'pass',
    iamAdminDenied: granted.has('resourcemanager.projects.setIamPolicy') ? 'fail' : 'pass',
    serviceAccountKeyDenied: serviceAccountGranted.has('iam.serviceAccountKeys.create') ? 'fail' : 'pass',
    unrelatedServiceAccountDenied: serviceAccountGranted.has('iam.serviceAccounts.getAccessToken') ? 'fail' : 'pass',
  });
}

export function createInfrastructureProbeHandler({ environment = process.env, runner = runInfrastructureProbe } = {}) {
  return async function handler(request, response) {
    let lastCompletedStage = 'request-start';
    const advanceStage = (stage) => {
      const currentIndex = DIAGNOSTIC_STAGES.indexOf(lastCompletedStage);
      const nextIndex = DIAGNOSTIC_STAGES.indexOf(stage);
      if (nextIndex !== currentIndex + 1) throw new Error('Invalid diagnostic stage transition.');
      lastCompletedStage = stage;
    };
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return response.status(405).json({ error: { code: 'probe/method-not-allowed' } });
    }
    if (!authorized(request, environment)) return response.status(401).json({ error: { code: 'probe/unauthorized' } });
    advanceStage('probe-authentication');
    if (request.body && Object.keys(request.body).length) return response.status(400).json({ error: { code: 'probe/invalid-request' } });
    try {
      const result = await runner({
        request,
        environment,
        advanceStage,
      });
      return response.status(200).json(result);
    } catch {
      return response.status(503).json({
        probe: 'ai-tutor-infrastructure',
        status: 'runtime-failure',
        lastCompletedStage,
        failureCategory: 'runtime-failure',
      });
    }
  };
}

export const infrastructureProbeInternals = Object.freeze({ authorized, DIAGNOSTIC_STAGES });
