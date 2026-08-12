export const EXAM_ATTEMPT_SCHEMA_VERSION = '1.0.0';

export const EXAM_ATTEMPT_STATES = Object.freeze({
  CREATED: 'CREATED',
  SCHEDULED: 'SCHEDULED',
  VERIFYING: 'VERIFYING',
  READY: 'READY',
  RUNNING: 'RUNNING',
  SUBMITTED: 'SUBMITTED',
  EVALUATING: 'EVALUATING',
  FINALIZED: 'FINALIZED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  ABANDONED: 'ABANDONED',
});

const transitions = Object.freeze({
  CREATED: new Set(['SCHEDULED', 'VERIFYING', 'CANCELLED', 'EXPIRED']),
  SCHEDULED: new Set(['VERIFYING', 'CANCELLED', 'EXPIRED']),
  VERIFYING: new Set(['READY', 'CANCELLED', 'EXPIRED']),
  READY: new Set(['RUNNING', 'CANCELLED', 'EXPIRED']),
  RUNNING: new Set(['SUBMITTED', 'ABANDONED']),
  SUBMITTED: new Set(['EVALUATING']),
  EVALUATING: new Set(['FINALIZED']),
  FINALIZED: new Set(),
  CANCELLED: new Set(),
  EXPIRED: new Set(),
  ABANDONED: new Set(),
});

export const TERMINAL_ATTEMPT_STATES = Object.freeze([
  EXAM_ATTEMPT_STATES.FINALIZED,
  EXAM_ATTEMPT_STATES.CANCELLED,
  EXAM_ATTEMPT_STATES.EXPIRED,
  EXAM_ATTEMPT_STATES.ABANDONED,
]);

export function canTransitionAttempt(from, to) {
  return transitions[from]?.has(to) ?? false;
}

export function assertAttemptTransition(from, to) {
  if (!canTransitionAttempt(from, to)) throw new Error(`Invalid exam attempt transition: ${from} -> ${to}`);
}

export function createExamAttempt(record) {
  if (!record?.id || !record.ownerUid || !record.courseId || !record.examId) {
    throw new TypeError('ExamAttempt requires id, ownerUid, courseId, and examId.');
  }
  if (!Object.values(EXAM_ATTEMPT_STATES).includes(record.state)) {
    throw new TypeError(`Unsupported exam attempt state: ${record.state}`);
  }
  return Object.freeze({
    schemaVersion: EXAM_ATTEMPT_SCHEMA_VERSION,
    examVersion: '1.0.0',
    scheduledFor: null,
    verificationStartedAt: null,
    verifiedAt: null,
    startedAt: null,
    expiresAt: null,
    submittedAt: null,
    finalizedAt: null,
    sessionId: null,
    lastHeartbeatAt: null,
    heartbeatSequence: 0,
    recoveryDeadline: null,
    environmentSummary: null,
    submissionId: null,
    submissionReason: null,
    submittedResponseRevision: null,
    examResult: null,
    integrityResult: null,
    certificationDecision: null,
    configVersions: Object.freeze({}),
    ...record,
  });
}
