import { randomUUID } from 'node:crypto';
import { verifyFirebaseIdToken } from '../ai/auth/FirebaseAITutorAuthenticator.js';
import { createDefaultFirestore } from '../firestore/createDefaultFirestore.js';
import { createV2ChallengeFirebaseCredentialContext, createV2GatewayFirebaseCredentialContext } from './ServiceAssertion.js';
import { DailyChallengeAssignmentService, FirestoreChallengeAssignmentContext, FirestoreDailyChallengeAssignmentRepository, HttpChallengeCandidateSource, V2ChallengeAssignmentError, publicAssignment } from './DailyChallengeAssignmentService.js';

const allowlist = (value) => new Set(String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean));
function bearer(request) { const match = String(request.headers?.authorization ?? '').match(/^Bearer\s+([^\s]+)$/i); if (!match) throw new V2ChallengeAssignmentError('v2/auth-required', 'Sign in to access the Daily Challenge.', 401); return match[1]; }

export function createV2DailyChallengeHandler({ environment = process.env, verifyToken = verifyFirebaseIdToken, firestoreFactory = createDefaultFirestore, authCredentialFactory = createV2GatewayFirebaseCredentialContext, challengeCredentialFactory = createV2ChallengeFirebaseCredentialContext, serviceFactory, logger = console } = {}) {
  return async function handler(request, response) {
    const correlationId = randomUUID(); let session; let stage = 'request';
    try {
      if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); throw new V2ChallengeAssignmentError('v2/method-not-allowed', 'Use GET for Daily Challenge assignment retrieval.', 405); }
      const deployment = String(environment.VERCEL_ENV ?? environment.YCODERS_ENVIRONMENT ?? '').toLowerCase();
      if (String(environment.V2_CHALLENGE_PILOT_ENABLED ?? '').toLowerCase() !== 'true' || !['preview', 'staging', 'development', 'test'].includes(deployment)) throw new V2ChallengeAssignmentError('v2/challenge-pilot-disabled', 'The Daily Challenge pilot is disabled.', 404);
      stage = 'firebase-token'; const decoded = await verifyToken(bearer(request), { environment, googleCredentials: authCredentialFactory({ request, environment }) });
      if (!decoded?.uid) throw new V2ChallengeAssignmentError('v2/auth-invalid', 'The learner session is invalid.', 401);
      const entitled = allowlist(environment.V2_CHALLENGE_PILOT_UIDS || environment.V2_PRACTICE_PILOT_UIDS); if (!entitled.has(decoded.uid)) throw new V2ChallengeAssignmentError('v2/access-denied', 'This account is not entitled to the Daily Challenge pilot.', 403);
      let service = serviceFactory?.({ correlationId });
      if (!service) { stage = 'challenge-credential'; const credentials = challengeCredentialFactory({ request, environment }); if (!credentials?.firebaseCredential) throw new V2ChallengeAssignmentError('v2/challenge-auth-unavailable', 'Challenge assignment identity is unavailable.', 503); session = await firestoreFactory(environment, credentials); const repository = new FirestoreDailyChallengeAssignmentRepository(session.db), candidateSource=new HttpChallengeCandidateSource(environment,globalThis.fetch,undefined,correlationId), context = new FirestoreChallengeAssignmentContext(session.db, environment, candidateSource); service = new DailyChallengeAssignmentService({ repository, context, correlationId: () => correlationId }); }
      stage = 'assignment'; const result = await service.getOrCreateToday(); logger.info?.('v2_daily_challenge', { correlationId, uid: decoded.uid, challengeDate: result.assignment.challengeDate, assignmentId: result.assignment.assignmentId, created: result.created, outcome: 'success' });
      response.setHeader('Cache-Control', 'private, no-store'); response.setHeader('X-Correlation-Id', correlationId); return response.status(200).json({ ok: true, data: publicAssignment(result.assignment), created: result.created });
    } catch (error) {
      const typed = error instanceof V2ChallengeAssignmentError, authentication = stage === 'firebase-token'; const failure = typed ? error : authentication ? new V2ChallengeAssignmentError('v2/auth-invalid', 'The learner session is invalid.', 401) : new V2ChallengeAssignmentError('v2/challenge-unavailable', 'The Daily Challenge is temporarily unavailable.', 503);
      logger.warn?.('v2_daily_challenge', { correlationId, stage, code: failure.code, candidateDiagnostics:failure.details, outcome: 'failure' }); return response.status(failure.status).json({ ok: false, error: { code: failure.code, message: failure.message, correlationId, ...(failure.details?{candidateDiagnostics:failure.details}:{}) } });
    } finally { await session?.close(); }
  };
}

