export const ELIGIBILITY_STATUS = Object.freeze({
  LOCKED: 'LOCKED', ELIGIBLE: 'ELIGIBLE', ATTEMPT_IN_PROGRESS: 'ATTEMPT_IN_PROGRESS',
  CERTIFIED: 'CERTIFIED', NOT_CERTIFIED: 'NOT_CERTIFIED', REVIEW_REQUIRED: 'REVIEW_REQUIRED',
});
export const CERTIFICATION_ELIGIBILITY_SCHEMA_VERSION = '1.0.0';

export function createCertificationEligibility(record) {
  if (!record?.courseId || !Object.values(ELIGIBILITY_STATUS).includes(record.eligibilityStatus)) {
    throw new TypeError('CertificationEligibility requires courseId and a valid eligibilityStatus.');
  }
  return Object.freeze({
    schemaVersion: CERTIFICATION_ELIGIBILITY_SCHEMA_VERSION,
    eligibleAt: null,
    activeAttemptId: null,
    latestAttemptId: null,
    latestDecision: null,
    attemptCount: 0,
    certificateId: null,
    updatedAt: null,
    evaluatedAt: null,
    completionPercentage: 0,
    requiredLessons: 0,
    completedLessons: 0,
    eligibilityPolicyVersion: '1.0.0',
    ...record,
  });
}
