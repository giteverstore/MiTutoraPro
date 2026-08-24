import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { AttemptService } from './certification/AttemptService.js';
import { CallableAbuseGuard, CALLABLE_LIMITS, callableOptions } from './security/CallableAbuseGuard.js';
import { StructuredLogger, stableErrorCode } from './observability/StructuredLogger.js';

initializeApp();
const telemetry = new StructuredLogger({ sink: logger, component: 'certification-functions' });
const service = new AttemptService({ db: getFirestore(), bucket: getStorage().bucket(), logger: telemetry });
const abuseGuard = new CallableAbuseGuard({ db: getFirestore() });

function authenticated(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in to access certification.');
  return request.auth.uid;
}

function endpoint(handler) {
  return onCall(callableOptions(), async (request) => {
    try { return await handler(authenticated(request), request.data ?? {}); }
    catch (error) {
      telemetry.error('certification.callable.rejected', { operation: handler.name || 'callable', errorCode: stableErrorCode(error) });
      const supported = new Set(['invalid-argument', 'not-found', 'permission-denied', 'failed-precondition', 'already-exists', 'aborted', 'deadline-exceeded', 'unavailable', 'data-loss', 'resource-exhausted']);
      throw new HttpsError(supported.has(error.code) ? error.code : 'internal', supported.has(error.code) ? error.message : 'Certification operation failed.');
    }
  });
}

const guarded = (operation, limits, handler) => endpoint(async (uid, data) => {
  await abuseGuard.enforce(uid, operation, limits);
  return handler(uid, data);
});

export const getCertificationStatus = guarded('getCertificationStatus', CALLABLE_LIMITS.read, (uid, { courseId }) => service.getCertification(uid, courseId));
export const getExamAttempt = guarded('getExamAttempt', CALLABLE_LIMITS.read, (uid, { attemptId }) => service.getAttempt(uid, attemptId));
export const getCandidateExam = guarded('getCandidateExam', CALLABLE_LIMITS.read, (_uid, { examId }) => service.getCandidateExam(examId));
export const createExamAttempt = guarded('createExamAttempt', CALLABLE_LIMITS.attemptCreate, (uid, data) => service.createAttempt(uid, data));
export const beginExamVerification = guarded('beginExamVerification', CALLABLE_LIMITS.verification, (uid, { attemptId }) => service.beginVerification(uid, attemptId));
export const completeExamVerification = guarded('completeExamVerification', CALLABLE_LIMITS.verification, (uid, { attemptId, ...protocol }) => service.completeVerification(uid, attemptId, protocol));
export const startExamAttempt = guarded('startExamAttempt', CALLABLE_LIMITS.verification, (uid, { attemptId }) => service.startAttempt(uid, attemptId));
export const acquireExamLease = guarded('acquireExamLease', CALLABLE_LIMITS.verification, (uid, { attemptId, sessionId }) => service.acquireLease(uid, attemptId, sessionId));
export const heartbeatExamAttempt = guarded('heartbeatExamAttempt', CALLABLE_LIMITS.heartbeat, (uid, { attemptId, sessionId, sequence }) => service.heartbeat(uid, attemptId, sessionId, sequence));
export const saveExamResponses = guarded('saveExamResponses', CALLABLE_LIMITS.responses, (uid, { attemptId, sessionId, ...payload }) => service.saveResponses(uid, attemptId, sessionId, payload));
export const saveIntegrityEvents = guarded('saveIntegrityEvents', CALLABLE_LIMITS.integrity, (uid, { attemptId, sessionId, ...batch }) => service.saveIntegrityEvents(uid, attemptId, sessionId, batch));
export const submitExamAttempt = guarded('submitExamAttempt', CALLABLE_LIMITS.submission, (uid, { attemptId, sessionId, submissionId, reason, telemetryFinalSequence }) => service.submit(uid, attemptId, sessionId, submissionId, reason, telemetryFinalSequence));
export const abandonExamAttempt = guarded('abandonExamAttempt', CALLABLE_LIMITS.submission, (uid, { attemptId, sessionId }) => service.abandon(uid, attemptId, sessionId));
export const beginTrustedLessonEvidence = guarded('beginTrustedLessonEvidence', CALLABLE_LIMITS.completion, (uid, data) => service.completion.beginLessonEvidence(uid, data));
export const recordTrustedLessonCompletion = guarded('recordTrustedLessonCompletion', CALLABLE_LIMITS.completion, (uid, data) => service.completion.recordLessonCompletion(uid, data));

function reviewerEndpoint(operation, handler) {
  return onCall(callableOptions(), async (request) => {
    const uid = authenticated(request);
    try {
      await abuseGuard.enforce(uid, operation, CALLABLE_LIMITS.review);
      return await handler(request.auth, request.data ?? {});
    }
    catch (error) {
      telemetry.error('certification.review.rejected', { operation, errorCode: stableErrorCode(error) });
      const supported = new Set(['invalid-argument', 'not-found', 'permission-denied', 'failed-precondition', 'already-exists', 'resource-exhausted']);
      throw new HttpsError(supported.has(error.code) ? error.code : 'internal', supported.has(error.code) ? error.message : 'Certification review operation failed.');
    }
  });
}

export const beginCertificationReview = reviewerEndpoint('beginCertificationReview', (auth, { reviewId }) => service.reviews.begin(auth, reviewId));
export const resolveCertificationReview = reviewerEndpoint('resolveCertificationReview', (auth, { reviewId, resolution }) => service.reviews.resolve(auth, reviewId, resolution));

export const expireCertificationAttempts = onSchedule('every 1 minutes', async () => {
  const [expired, finalized] = await Promise.all([service.expireOverdue(), service.finalizePending()]);
  telemetry.info('certification.maintenance.completed', {
    expired: expired.results.length,
    expiryFailures: expired.failures.length,
    expiryExhausted: expired.exhausted,
    finalized: finalized.results.length,
    finalizationFailures: finalized.failures.length,
    finalizationExhausted: finalized.exhausted,
  });
});
