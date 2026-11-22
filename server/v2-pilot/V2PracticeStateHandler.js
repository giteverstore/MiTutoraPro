import { randomUUID } from 'node:crypto';
import { verifyFirebaseIdToken } from '../ai/auth/FirebaseAITutorAuthenticator.js';
import { createDefaultFirestore } from '../firestore/createDefaultFirestore.js';
import { assertPilotEntitlement, HttpV2DeliveryTransport, isServerV2PilotEnabled, V2PilotGatewayError } from './V2PilotGateway.js';
import { createV2GatewayFirebaseCredentialContext, createV2PracticeStateFirebaseCredentialContext } from './ServiceAssertion.js';
import { FirestoreV2PracticeStateStore, V2PracticeStateError } from './V2PracticeStateService.js';

function bearer(request) { const match = String(request.headers?.authorization ?? '').match(/^Bearer\s+([^\s]+)$/i); if (!match) throw new V2PracticeStateError('v2/auth-required', 'Sign in to access Practice state.', 401); return match[1]; }
const diagnostic = (error) => ({ errorName: String(error?.name ?? 'Error').slice(0, 80), errorCode: typeof error?.code === 'string' || typeof error?.code === 'number' ? String(error.code).slice(0, 80) : null });

export function createV2PracticeStateHandler({ environment = process.env, verifyToken = verifyFirebaseIdToken, store = null, transport = new HttpV2DeliveryTransport(environment), authCredentialFactory = createV2GatewayFirebaseCredentialContext, stateCredentialFactory = createV2PracticeStateFirebaseCredentialContext, firestoreFactory = createDefaultFirestore, logger = console } = {}) {
  return async function handler(request, response) {
    const correlationId = randomUUID(), requestId = String(request.body?.requestId ?? request.headers?.['x-request-id'] ?? randomUUID()).slice(0, 128); let session; let stage = 'request'; let uid = null; const contentId = String(request.query?.contentId ?? ''), publicationVersion = Number(request.query?.version), operation = request.query?.operation === 'complete' ? 'complete' : request.method === 'GET' ? 'read' : 'workspace';
    try {
      if (!isServerV2PilotEnabled(environment, 'practice')) throw new V2PracticeStateError('v2/pilot-disabled', 'V2 Practice pilot is disabled.', 404);
      stage = 'bearer'; const token = bearer(request); stage = 'firebase-token'; const decoded = await verifyToken(token, { environment, googleCredentials: authCredentialFactory({ request, environment }) }); uid = decoded?.uid; if (!uid) throw new V2PracticeStateError('v2/auth-invalid', 'The learner session is invalid.', 401);
      stage = 'pilot-authorization'; assertPilotEntitlement({ uid, contentId, contentType: 'practice' }, environment); const identity = { contentId, publicationVersion };
      let stateStore = store; if (!stateStore) { stage = 'practice-state-credential'; const credentials = stateCredentialFactory({ request, environment }); if (!credentials?.firebaseCredential) throw new V2PracticeStateError('v2/practice-state-auth-unavailable', 'Practice persistence identity is unavailable.', 503); stage = 'firestore-client'; session = await firestoreFactory(environment, credentials); stateStore = new FirestoreV2PracticeStateStore(session.db); }
      if (request.method === 'GET' && operation === 'read') { stage = 'state-read'; const data = await stateStore.load(uid, identity); logger.info?.('v2_practice_state', { requestId, correlationId, uid, contentId, publicationVersion, operation, outcome: 'success' }); return response.status(200).json({ ok: true, data }); }
      if (!['PUT', 'POST'].includes(request.method) || (operation === 'complete' ? request.method !== 'POST' : request.method !== 'PUT')) { response.setHeader('Allow', operation === 'complete' ? 'POST' : 'GET, PUT'); throw new V2PracticeStateError('v2/method-not-allowed', 'Use the supported Practice state method.', 405); }
      stage = 'exact-version'; const delivery = await transport.request({ kind: 'course', contentType: 'practice', contentId, publicationVersion, mode: 'exact' }, { correlationId }); if (!delivery.practice || delivery.publicationVersion !== publicationVersion) throw new V2PracticeStateError('v2/practice-version-invalid', 'The immutable Practice publication was not found.', 404); const practice = { ...delivery.practice, identity: { namespace: 'v2', contentType: 'practice', contentId, publicationVersion } };
      stage = operation === 'complete' ? 'completion-commit' : 'workspace-write'; const data = operation === 'complete' ? await stateStore.commit(uid, identity, request.body, practice) : await stateStore.saveWorkspace(uid, identity, request.body, practice);
      logger.info?.('v2_practice_state', { requestId, correlationId, uid, contentId, publicationVersion, operation, outcome: 'success' }); return response.status(200).json({ ok: true, data });
    } catch (error) {
      const typed = error instanceof V2PracticeStateError || error instanceof V2PilotGatewayError, authenticationStage = stage === 'bearer' || stage === 'firebase-token'; const publicError = typed ? error : authenticationStage ? new V2PracticeStateError('v2/auth-invalid', 'The learner session is invalid.', 401) : new V2PracticeStateError('v2/practice-state-unavailable', 'Practice state is temporarily unavailable.', 503);
      logger.warn?.('v2_practice_state', { requestId, correlationId, uid, contentId, publicationVersion, operation, outcome: 'failure', stage, ...diagnostic(error), publicCode: publicError.code }); return response.status(publicError.status).json({ ok: false, error: { code: publicError.code, message: publicError.message, correlationId } });
    } finally { await session?.close(); }
  };
}
