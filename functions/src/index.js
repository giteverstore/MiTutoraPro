import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { AttemptService } from './certification/AttemptService.js';

initializeApp();
const service = new AttemptService({ db: getFirestore(), bucket: getStorage().bucket(), logger });

function authenticated(request) {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Sign in to access certification.');
  return request.auth.uid;
}

function endpoint(handler) {
  return onCall(async (request) => {
    try { return await handler(authenticated(request), request.data ?? {}); }
    catch (error) {
      logger.error('certification.endpoint.failed', { code: error.code, message: error.message });
      const supported = new Set(['invalid-argument', 'not-found', 'permission-denied', 'failed-precondition', 'already-exists', 'aborted', 'deadline-exceeded', 'unavailable']);
      throw new HttpsError(supported.has(error.code) ? error.code : 'internal', supported.has(error.code) ? error.message : 'Certification operation failed.');
    }
  });
}

export const getCertificationStatus = endpoint((uid, { courseId }) => service.getCertification(uid, courseId));
export const getExamAttempt = endpoint((uid, { attemptId }) => service.getAttempt(uid, attemptId));
export const getCandidateExam = endpoint((_uid, { examId }) => service.getCandidateExam(examId));
export const createExamAttempt = endpoint((uid, data) => service.createAttempt(uid, data));
export const beginExamVerification = endpoint((uid, { attemptId }) => service.beginVerification(uid, attemptId));
export const completeExamVerification = endpoint((uid, { attemptId, summary }) => service.completeVerification(uid, attemptId, summary));
export const startExamAttempt = endpoint((uid, { attemptId }) => service.startAttempt(uid, attemptId));
export const acquireExamLease = endpoint((uid, { attemptId, sessionId }) => service.acquireLease(uid, attemptId, sessionId));
export const heartbeatExamAttempt = endpoint((uid, { attemptId, sessionId, sequence }) => service.heartbeat(uid, attemptId, sessionId, sequence));
export const saveExamResponses = endpoint((uid, { attemptId, sessionId, ...payload }) => service.saveResponses(uid, attemptId, sessionId, payload));
export const saveIntegrityEvents = endpoint((uid, { attemptId, sessionId, events }) => service.saveIntegrityEvents(uid, attemptId, sessionId, events));
export const submitExamAttempt = endpoint((uid, { attemptId, sessionId, submissionId, reason }) => service.submit(uid, attemptId, sessionId, submissionId, reason));
export const abandonExamAttempt = endpoint((uid, { attemptId, sessionId }) => service.abandon(uid, attemptId, sessionId));
export const recordTrustedLessonCompletion = endpoint((uid, data) => service.completion.recordLessonCompletion(uid, data));

function reviewerEndpoint(handler) {
  return onCall(async (request) => {
    authenticated(request);
    try { return await handler(request.auth, request.data ?? {}); }
    catch (error) {
      logger.error('certification.review_endpoint.failed', { code: error.code, message: error.message });
      const supported = new Set(['invalid-argument', 'not-found', 'permission-denied', 'failed-precondition', 'already-exists']);
      throw new HttpsError(supported.has(error.code) ? error.code : 'internal', supported.has(error.code) ? error.message : 'Certification review operation failed.');
    }
  });
}

export const beginCertificationReview = reviewerEndpoint((auth, { reviewId }) => service.reviews.begin(auth, reviewId));
export const resolveCertificationReview = reviewerEndpoint((auth, { reviewId, resolution }) => service.reviews.resolve(auth, reviewId, resolution));

export const expireCertificationAttempts = onSchedule('every 1 minutes', async () => {
  const [expired, finalized] = await Promise.all([service.expireOverdue(), service.finalizePending()]);
  logger.info('certification.maintenance.completed', { expired: expired.length, finalized: finalized.length });
});
