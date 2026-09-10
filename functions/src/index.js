import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { logger } from 'firebase-functions';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { AttemptService } from './certification/AttemptService.js';
import { CallableAbuseGuard, CALLABLE_LIMITS, callableOptions } from './security/CallableAbuseGuard.js';
import { StructuredLogger, stableErrorCode } from './observability/StructuredLogger.js';
import { SubscriptionService } from './subscriptions/SubscriptionService.js';
import { PremiumAuthorization } from './subscriptions/PremiumAuthorization.js';
import { ReferralService } from './referrals/ReferralService.js';

initializeApp();
const telemetry = new StructuredLogger({ sink: logger, component: 'certification-functions' });
const service = new AttemptService({ db: getFirestore(), bucket: getStorage().bucket(), logger: telemetry });
const abuseGuard = new CallableAbuseGuard({ db: getFirestore() });
const premiumAuthorization = new PremiumAuthorization({ subscriptionService: new SubscriptionService({ db: getFirestore(), timestamp: Timestamp }) });
const referralService = new ReferralService({ db: getFirestore(), timestamp: Timestamp });

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
      const referralCodes = new Map([
        ['referral/invalid-code', 'invalid-argument'], ['referral/client-authority-rejected', 'invalid-argument'],
        ['referral/code-not-found', 'not-found'], ['referral/code-inactive', 'failed-precondition'],
        ['referral/self-referral', 'permission-denied'], ['referral/already-attributed', 'already-exists'],
      ]);
      const publicCode = supported.has(error.code) ? error.code : referralCodes.get(error.code);
      throw new HttpsError(publicCode ?? 'internal', publicCode ? error.message : 'Server operation failed.');
    }
  });
}

const guarded = (operation, limits, handler) => endpoint(async (uid, data) => {
  await abuseGuard.enforce(uid, operation, limits);
  return handler(uid, data);
});

const premiumGuarded = (operation, limits, handler) => endpoint(async (uid, data) => {
  await premiumAuthorization.assert(uid);
  await abuseGuard.enforce(uid, operation, limits);
  return handler(uid, data);
});

export const getCertificationStatus = premiumGuarded('getCertificationStatus', CALLABLE_LIMITS.read, (uid, { courseId }) => service.getCertification(uid, courseId));
export const getExamAttempt = premiumGuarded('getExamAttempt', CALLABLE_LIMITS.read, (uid, { attemptId }) => service.getAttempt(uid, attemptId));
export const getCandidateExam = premiumGuarded('getCandidateExam', CALLABLE_LIMITS.read, (_uid, { examId }) => service.getCandidateExam(examId));
export const createExamAttempt = premiumGuarded('createExamAttempt', CALLABLE_LIMITS.attemptCreate, (uid, data) => service.createAttempt(uid, data));
export const beginExamVerification = premiumGuarded('beginExamVerification', CALLABLE_LIMITS.verification, (uid, { attemptId }) => service.beginVerification(uid, attemptId));
export const completeExamVerification = premiumGuarded('completeExamVerification', CALLABLE_LIMITS.verification, (uid, { attemptId, ...protocol }) => service.completeVerification(uid, attemptId, protocol));
export const startExamAttempt = premiumGuarded('startExamAttempt', CALLABLE_LIMITS.verification, (uid, { attemptId }) => service.startAttempt(uid, attemptId));
export const acquireExamLease = premiumGuarded('acquireExamLease', CALLABLE_LIMITS.verification, (uid, { attemptId, sessionId }) => service.acquireLease(uid, attemptId, sessionId));
export const heartbeatExamAttempt = premiumGuarded('heartbeatExamAttempt', CALLABLE_LIMITS.heartbeat, (uid, { attemptId, sessionId, sequence }) => service.heartbeat(uid, attemptId, sessionId, sequence));
export const saveExamResponses = premiumGuarded('saveExamResponses', CALLABLE_LIMITS.responses, (uid, { attemptId, sessionId, ...payload }) => service.saveResponses(uid, attemptId, sessionId, payload));
export const saveIntegrityEvents = premiumGuarded('saveIntegrityEvents', CALLABLE_LIMITS.integrity, (uid, { attemptId, sessionId, ...batch }) => service.saveIntegrityEvents(uid, attemptId, sessionId, batch));
export const submitExamAttempt = premiumGuarded('submitExamAttempt', CALLABLE_LIMITS.submission, (uid, { attemptId, sessionId, submissionId, reason, telemetryFinalSequence }) => service.submit(uid, attemptId, sessionId, submissionId, reason, telemetryFinalSequence));
export const abandonExamAttempt = premiumGuarded('abandonExamAttempt', CALLABLE_LIMITS.submission, (uid, { attemptId, sessionId }) => service.abandon(uid, attemptId, sessionId));
export const beginTrustedLessonEvidence = guarded('beginTrustedLessonEvidence', CALLABLE_LIMITS.completion, (uid, data) => service.completion.beginLessonEvidence(uid, data));
export const recordTrustedLessonCompletion = guarded('recordTrustedLessonCompletion', CALLABLE_LIMITS.completion, (uid, data) => service.completion.recordLessonCompletion(uid, data));
export const ensureReferralIdentity = guarded('ensureReferralIdentity', CALLABLE_LIMITS.read, (uid) => referralService.ensureReferralIdentity({ uid }));
export const attributeReferral = guarded('attributeReferral', CALLABLE_LIMITS.completion, (uid, data) => referralService.attributeReferral({ principal: { uid }, request: data }));

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
