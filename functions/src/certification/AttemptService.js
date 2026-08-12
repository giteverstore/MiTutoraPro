import { randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { CertificationEngine, DECISION } from './CertificationEngine.js';
import { CertificateIssuer } from './CertificateIssuer.js';
import { ExamScoringEngine } from './ExamScoringEngine.js';
import { IntegrityEvaluationEngine } from './IntegrityEvaluationEngine.js';
import { IntegrityReportEngine } from './IntegrityReportEngine.js';
import { CourseCompletionService } from './CourseCompletionService.js';
import { ReviewService } from './ReviewService.js';
import { AuditTrail } from './AuditTrail.js';
import { candidateExam, getTrustedExamDefinition } from './trustedExamDefinitions.js';

const ACTIVE_STATES = new Set(['CREATED', 'SCHEDULED', 'VERIFYING', 'READY', 'RUNNING', 'SUBMITTED', 'EVALUATING']);
const TERMINAL_STATES = new Set(['FINALIZED', 'CANCELLED', 'EXPIRED', 'ABANDONED']);
const allowedTransitions = Object.freeze({
  CREATED: new Set(['SCHEDULED', 'VERIFYING', 'CANCELLED', 'EXPIRED']),
  SCHEDULED: new Set(['VERIFYING', 'CANCELLED', 'EXPIRED']),
  VERIFYING: new Set(['READY', 'CANCELLED', 'EXPIRED']),
  READY: new Set(['RUNNING', 'CANCELLED', 'EXPIRED']),
  RUNNING: new Set(['SUBMITTED', 'ABANDONED']),
  SUBMITTED: new Set(['EVALUATING']), EVALUATING: new Set(['FINALIZED']),
  FINALIZED: new Set(), CANCELLED: new Set(), EXPIRED: new Set(), ABANDONED: new Set(),
});

function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
function assertTransition(from, to) { if (!allowedTransitions[from]?.has(to)) fail('failed-precondition', `Invalid attempt transition: ${from} -> ${to}`); }
function timestampMillis(value) { return typeof value?.toMillis === 'function' ? value.toMillis() : new Date(value).getTime(); }
function projectionPath(uid, courseId) { return `users/${uid}/certifications/${courseId}`; }
function projectionChanged(current, next) {
  const fields = ['eligibilityStatus', 'activeAttemptId', 'latestAttemptId', 'latestDecision', 'attemptCount', 'certificateId', 'reviewId', 'courseProgressVersion', 'completionPercentage', 'requiredLessons', 'completedLessons', 'eligibilityPolicyVersion'];
  return fields.some((field) => JSON.stringify(current[field] ?? null) !== JSON.stringify(next[field] ?? null));
}

function sanitizeEnvironment(summary = {}) {
  return {
    ready: summary.ready === true,
    readinessScore: Math.max(0, Math.min(100, Number(summary.readinessScore) || 0)),
    verificationTimeMs: Math.max(0, Number(summary.verificationTimeMs) || 0),
    verifiedAt: summary.verifiedAt ?? null,
    checks: Object.fromEntries(Object.entries(summary.checks ?? {}).slice(0, 16).map(([key, value]) => [key, {
      status: String(value?.status ?? '').slice(0, 64), severity: String(value?.severity ?? '').slice(0, 32), quality: Math.max(0, Math.min(100, Number(value?.quality) || 0)),
    }])),
  };
}

function sanitizeEvidence(evidence = {}) {
  const allowedMeasurements = new Set(['yaw', 'pitch', 'roll', 'faceCount', 'poseStatus', 'condition', 'status', 'count']);
  return {
    detectorId: String(evidence.detectorId ?? '').slice(0, 64),
    type: String(evidence.type ?? '').slice(0, 64),
    confidence: Number.isFinite(evidence.confidence) ? evidence.confidence : null,
    stability: Number.isFinite(evidence.stability) ? evidence.stability : 0,
    quality: Number.isFinite(evidence.quality) ? evidence.quality : 0,
    durationMs: Number.isFinite(evidence.durationMs ?? evidence.duration) ? evidence.durationMs ?? evidence.duration : 0,
    version: String(evidence.version ?? '').slice(0, 64),
    labels: (evidence.labels ?? []).slice(0, 8).map((value) => String(value).slice(0, 64)),
    measurements: Object.fromEntries(Object.entries(evidence.measurements ?? evidence.metadata ?? {}).filter(([key, value]) => allowedMeasurements.has(key) && (value == null || ['string', 'number', 'boolean'].includes(typeof value))).map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 64) : value])),
  };
}

function sanitizeIntegrityEvent(event, now) {
  const startedAt = Number(event.startedAt);
  if (!event.id || !event.type || !Number.isFinite(startedAt)) fail('invalid-argument', 'Integrity events require id, type, and startedAt.');
  return {
    id: String(event.id).slice(0, 160), type: String(event.type).slice(0, 80),
    status: ['ACTIVE', 'RECOVERED', 'DISMISSED'].includes(event.status) ? event.status : 'ACTIVE',
    startedAt, endedAt: Number.isFinite(event.endedAt) ? event.endedAt : null,
    durationMs: Math.max(0, Number(event.durationMs ?? event.duration) || 0),
    severity: String(event.severity ?? 'medium').slice(0, 32),
    warningLevel: String(event.warningLevel ?? '').slice(0, 32),
    deductions: [], evidence: sanitizeEvidence(event.evidence ?? event.metadata?.evidence),
    detectorId: String(event.detectorId ?? event.metadata?.detector ?? '').slice(0, 64),
    detectorVersion: String(event.detectorVersion ?? event.evidence?.version ?? '').slice(0, 64),
    modelVersion: String(event.modelVersion ?? '').slice(0, 64),
    ruleSetVersion: '1.0.0', schemaVersion: '1.0.0', updatedAt: now,
  };
}

export class AttemptService {
  constructor({ db, bucket, logger = console, recoveryWindowMs = 2 * 60 * 1000, leaseStaleMs = 30 * 1000 } = {}) {
    this.db = db; this.logger = logger; this.recoveryWindowMs = recoveryWindowMs; this.leaseStaleMs = leaseStaleMs;
    this.scoring = new ExamScoringEngine(); this.integrity = new IntegrityEvaluationEngine(); this.integrityReports = new IntegrityReportEngine(this.integrity.policy); this.certification = new CertificationEngine(); this.issuer = new CertificateIssuer();
    this.completion = new CourseCompletionService({ db, bucket }); this.audit = new AuditTrail(db); this.reviews = new ReviewService({ db, issuer: this.issuer, audit: this.audit });
  }

  async examDefinition(examId) {
    const metadataSnapshot = await this.db.doc(`certificationExams/${examId}`).get();
    if (!metadataSnapshot.exists) fail('not-found', 'Certification exam metadata was not found.');
    const metadata = metadataSnapshot.data();
    if (!metadata.published) fail('failed-precondition', 'Certification exam is not published.');
    const definition = getTrustedExamDefinition(examId);
    if (metadata.version !== definition.version) fail('failed-precondition', 'Certification exam version is unavailable.');
    return definition;
  }

  async getCandidateExam(examId) { return candidateExam(await this.examDefinition(examId)); }

  async getCertification(uid, courseId) {
    const reference = this.db.doc(projectionPath(uid, courseId));
    const [snapshot, evaluation] = await Promise.all([reference.get(), this.completion.evaluateEligibility(uid, courseId)]);
    const current = snapshot.data() ?? {};
    const now = Timestamp.now();
    const outcomeStatus = current.certificateId ? 'CERTIFIED'
      : current.activeAttemptId ? 'ATTEMPT_IN_PROGRESS'
        : ['NOT_CERTIFIED', 'REVIEW_REQUIRED'].includes(current.latestDecision) ? current.latestDecision
          : evaluation.eligibilityStatus;
    const projection = {
      courseId, eligibilityStatus: outcomeStatus, eligibleAt: evaluation.eligibilityStatus === 'ELIGIBLE' ? current.eligibleAt ?? now : null,
      activeAttemptId: current.activeAttemptId ?? null, latestAttemptId: current.latestAttemptId ?? null,
      latestDecision: current.latestDecision ?? null, attemptCount: current.attemptCount ?? 0,
      certificateId: current.certificateId ?? null, reviewId: current.reviewId ?? null,
      evaluatedAt: current.evaluatedAt ?? now, courseProgressVersion: evaluation.courseProgressVersion,
      completionPercentage: evaluation.completionPercentage, requiredLessons: evaluation.requiredLessons,
      completedLessons: evaluation.completedLessons, eligibilityPolicyVersion: evaluation.eligibilityPolicyVersion,
      updatedAt: now, schemaVersion: '1.0.0',
    };
    if (projectionChanged(current, projection)) {
      projection.evaluatedAt = now; projection.updatedAt = now;
      await reference.set(projection, { merge: true });
    } else {
      projection.evaluatedAt = current.evaluatedAt ?? now; projection.updatedAt = current.updatedAt ?? now;
    }
    return this.withActiveAttemptState(uid, projection);
  }

  async withActiveAttemptState(uid, projection) {
    if (!projection.activeAttemptId) return { ...projection, activeAttemptState: null };
    const snapshot = await this.db.doc(`examAttempts/${projection.activeAttemptId}`).get();
    if (!snapshot.exists || snapshot.data().ownerUid !== uid) return { ...projection, activeAttemptState: null };
    return { ...projection, activeAttemptState: snapshot.data().state };
  }

  async getAttempt(uid, attemptId) {
    const reference = this.db.doc(`examAttempts/${attemptId}`);
    const [attemptSnapshot, responseSnapshot] = await Promise.all([reference.get(), reference.collection('responses').doc('current').get()]);
    if (!attemptSnapshot.exists) fail('not-found', 'Exam attempt not found.');
    const attempt = attemptSnapshot.data();
    if (attempt.ownerUid !== uid) fail('permission-denied', 'Exam attempt is not owned by this user.');
    const eventSnapshot = attempt.state === 'RUNNING' ? await reference.collection('integrityEvents').get() : null;
    const reportSnapshot = attempt.integrityReportId ? await this.db.doc(`integrityReports/${attempt.integrityReportId}`).get() : null;
    return { attempt, responses: responseSnapshot.exists ? responseSnapshot.data() : null, integrityEvents: eventSnapshot?.docs.map((document) => document.data()) ?? [], integrityReport: reportSnapshot?.exists ? reportSnapshot.data() : null };
  }

  async createAttempt(uid, { courseId, examId, scheduledFor = null }) {
    const definition = await this.examDefinition(examId);
    if (definition.courseId !== courseId) fail('invalid-argument', 'Exam does not belong to the requested course.');
    const courseManifest = await this.completion.manifest(courseId);
    const attemptRef = this.db.collection('examAttempts').doc();
    const result = await this.db.runTransaction(async (transaction) => {
      const projectionRef = this.db.doc(projectionPath(uid, courseId));
      const trustedProgressRef = this.db.doc(`users/${uid}/trustedCourseProgress/${courseId}`);
      const [projectionSnapshot, trustedProgressSnapshot] = await Promise.all([transaction.get(projectionRef), transaction.get(trustedProgressRef)]);
      const eligibility = this.completion.engine.evaluate(courseManifest, trustedProgressSnapshot.data());
      if (eligibility.eligibilityStatus !== 'ELIGIBLE' || !trustedProgressSnapshot.exists) fail('permission-denied', 'Complete the course before starting certification.');
      const projection = projectionSnapshot.data() ?? {};
      if (projection.activeAttemptId) {
        const activeSnapshot = await transaction.get(this.db.doc(`examAttempts/${projection.activeAttemptId}`));
        if (activeSnapshot.exists && ACTIVE_STATES.has(activeSnapshot.data().state)) return activeSnapshot.data();
      }
      const now = Timestamp.now();
      const attempt = {
        id: attemptRef.id, ownerUid: uid, courseId, examId, examVersion: definition.version,
        state: scheduledFor ? 'SCHEDULED' : 'CREATED', createdAt: now,
        scheduledFor: scheduledFor ? Timestamp.fromMillis(new Date(scheduledFor).getTime()) : null,
        verificationStartedAt: null, verifiedAt: null, startedAt: null, expiresAt: null,
        submittedAt: null, finalizedAt: null, sessionId: null, lastHeartbeatAt: null,
        heartbeatSequence: 0, recoveryDeadline: null, environmentSummary: null,
        submissionId: null, submissionReason: null, responseRevision: 0, submittedResponseRevision: null,
        examResult: null, integrityResult: null, certificationDecision: null,
        configVersions: { exam: definition.version, integrity: this.integrity.policy.version, certification: this.certification.policy.version, eligibility: eligibility.courseProgressVersion },
        schemaVersion: '1.0.0', updatedAt: now,
      };
      transaction.set(attemptRef, attempt);
      transaction.set(projectionRef, {
        courseId, eligibilityStatus: 'ATTEMPT_IN_PROGRESS', eligibleAt: projection.eligibleAt ?? now,
        activeAttemptId: attempt.id, latestAttemptId: attempt.id, latestDecision: projection.latestDecision ?? null,
        attemptCount: (projection.attemptCount ?? 0) + 1, certificateId: projection.certificateId ?? null,
        updatedAt: now, schemaVersion: '1.0.0',
      }, { merge: true });
      return attempt;
    });
    this.logger.info?.('certification.attempt.created', { attemptId: result.id, uid, courseId, state: result.state });
    await this.audit.record(result.id, 'ATTEMPT_CREATED', { actorType: 'CANDIDATE', actorId: uid, metadata: { courseId, examId } });
    return result;
  }

  async transition(uid, attemptId, fromStates, toState, updates = {}) {
    const reference = this.db.doc(`examAttempts/${attemptId}`);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference); if (!snapshot.exists) fail('not-found', 'Exam attempt not found.');
      const attempt = snapshot.data(); if (attempt.ownerUid !== uid) fail('permission-denied', 'Exam attempt is not owned by this user.');
      if (!fromStates.includes(attempt.state)) fail('failed-precondition', `Attempt is ${attempt.state}.`);
      assertTransition(attempt.state, toState);
      const next = { ...updates, state: toState, updatedAt: Timestamp.now() };
      transaction.update(reference, next); return { ...attempt, ...next };
    });
  }

  beginVerification(uid, attemptId) { return this.transition(uid, attemptId, ['CREATED', 'SCHEDULED'], 'VERIFYING', { verificationStartedAt: Timestamp.now() }); }

  completeVerification(uid, attemptId, summary) {
    const environmentSummary = sanitizeEnvironment(summary);
    if (!environmentSummary.ready) fail('failed-precondition', 'Environment verification did not pass.');
    return this.transition(uid, attemptId, ['VERIFYING'], 'READY', { verifiedAt: Timestamp.now(), environmentSummary });
  }

  async startAttempt(uid, attemptId) {
    const reference = this.db.doc(`examAttempts/${attemptId}`); const definitionCache = new Map();
    const result = await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference); if (!snapshot.exists) fail('not-found', 'Exam attempt not found.');
      const attempt = snapshot.data(); if (attempt.ownerUid !== uid) fail('permission-denied', 'Exam attempt is not owned by this user.');
      if (attempt.state === 'RUNNING') return attempt;
      assertTransition(attempt.state, 'RUNNING');
      const definition = definitionCache.get(attempt.examId) ?? getTrustedExamDefinition(attempt.examId); definitionCache.set(attempt.examId, definition);
      const now = Timestamp.now(); const sessionId = randomUUID();
      const updates = { state: 'RUNNING', startedAt: now, expiresAt: Timestamp.fromMillis(now.toMillis() + definition.durationMs), sessionId, lastHeartbeatAt: now, heartbeatSequence: 0, recoveryDeadline: Timestamp.fromMillis(now.toMillis() + definition.durationMs + this.recoveryWindowMs), updatedAt: now };
      transaction.update(reference, updates); return { ...attempt, ...updates };
    });
    this.logger.info?.('certification.attempt.started', { attemptId, uid, expiresAt: result.expiresAt.toMillis() });
    await this.audit.record(attemptId, 'ATTEMPT_STARTED', { actorType: 'CANDIDATE', actorId: uid, metadata: { expiresAt: result.expiresAt.toMillis() } });
    return result;
  }

  async acquireLease(uid, attemptId, previousSessionId = null) {
    const reference = this.db.doc(`examAttempts/${attemptId}`);
    const result = await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference); if (!snapshot.exists) fail('not-found', 'Exam attempt not found.');
      const attempt = snapshot.data(); if (attempt.ownerUid !== uid) fail('permission-denied', 'Exam attempt is not owned by this user.');
      if (attempt.state !== 'RUNNING') fail('failed-precondition', `Attempt cannot be recovered from ${attempt.state}.`);
      const now = Timestamp.now(); if (now.toMillis() > timestampMillis(attempt.recoveryDeadline)) fail('deadline-exceeded', 'The exam recovery window has expired.');
      const sameSession = previousSessionId && previousSessionId === attempt.sessionId;
      const stale = !attempt.lastHeartbeatAt || now.toMillis() - timestampMillis(attempt.lastHeartbeatAt) >= this.leaseStaleMs;
      if (!sameSession && !stale) fail('already-exists', 'Another browser session currently owns this exam.');
      const sessionId = sameSession ? attempt.sessionId : randomUUID();
      const updates = { sessionId, lastHeartbeatAt: now, heartbeatSequence: attempt.heartbeatSequence ?? 0, updatedAt: now };
      transaction.update(reference, updates); return { ...attempt, ...updates };
    });
    this.logger.info?.('certification.attempt.recovered', { attemptId, uid });
    await this.audit.record(attemptId, 'ATTEMPT_RECOVERED', { eventId: `attempt-recovered-${result.sessionId}`, actorType: 'CANDIDATE', actorId: uid });
    return result;
  }

  async heartbeat(uid, attemptId, sessionId, sequence) {
    const reference = this.db.doc(`examAttempts/${attemptId}`);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference); if (!snapshot.exists) fail('not-found', 'Exam attempt not found.');
      const attempt = snapshot.data();
      if (attempt.ownerUid !== uid || attempt.sessionId !== sessionId) fail('permission-denied', 'Invalid exam session lease.');
      if (attempt.state !== 'RUNNING') fail('failed-precondition', 'Heartbeat is not accepted for this attempt.');
      if (!Number.isInteger(sequence) || sequence <= (attempt.heartbeatSequence ?? -1)) fail('aborted', 'Stale heartbeat sequence.');
      const now = Timestamp.now(); transaction.update(reference, { heartbeatSequence: sequence, lastHeartbeatAt: now, updatedAt: now });
      return { sequence, serverTime: now, expiresAt: attempt.expiresAt };
    });
  }

  async saveResponses(uid, attemptId, sessionId, payload) {
    const attemptRef = this.db.doc(`examAttempts/${attemptId}`); const responseRef = attemptRef.collection('responses').doc('current');
    return this.db.runTransaction(async (transaction) => {
      const [attemptSnapshot, responseSnapshot] = await Promise.all([transaction.get(attemptRef), transaction.get(responseRef)]);
      if (!attemptSnapshot.exists) fail('not-found', 'Exam attempt not found.'); const attempt = attemptSnapshot.data();
      if (attempt.ownerUid !== uid || attempt.sessionId !== sessionId) fail('permission-denied', 'Invalid exam session lease.');
      if (attempt.state !== 'RUNNING') fail('failed-precondition', 'Answers are immutable after submission.');
      const currentRevision = responseSnapshot.data()?.revision ?? 0;
      if (!Number.isInteger(payload.revision) || payload.revision <= currentRevision) fail('aborted', 'A newer answer revision already exists.');
      const definition = getTrustedExamDefinition(attempt.examId); const questionIds = new Set(definition.questions.map(({ id }) => id));
      const answers = Object.fromEntries(Object.entries(payload.answers ?? {}).filter(([questionId, optionId]) => questionIds.has(questionId) && typeof optionId === 'string'));
      const response = { answers, currentQuestionId: questionIds.has(payload.currentQuestionId) ? payload.currentQuestionId : null, revision: payload.revision, updatedAt: Timestamp.now(), schemaVersion: '1.0.0' };
      transaction.set(responseRef, response); transaction.update(attemptRef, { responseRevision: payload.revision, updatedAt: response.updatedAt }); return response;
    });
  }

  async saveIntegrityEvents(uid, attemptId, sessionId, events) {
    if (!Array.isArray(events) || events.length > 50) fail('invalid-argument', 'At most 50 integrity events may be synchronized at once.');
    const attemptSnapshot = await this.db.doc(`examAttempts/${attemptId}`).get(); if (!attemptSnapshot.exists) fail('not-found', 'Exam attempt not found.');
    const attempt = attemptSnapshot.data(); if (attempt.ownerUid !== uid || attempt.sessionId !== sessionId || attempt.state !== 'RUNNING') fail('permission-denied', 'Integrity events are not accepted for this session.');
    const now = Timestamp.now(); const batch = this.db.batch(); const normalized = events.map((event) => sanitizeIntegrityEvent(event, now));
    normalized.forEach((event) => batch.set(
      this.db.doc(`examAttempts/${attemptId}/integrityEvents/${event.id}`),
      { ...event, createdAt: Timestamp.fromMillis(event.startedAt) },
      { merge: true },
    ));
    await batch.commit(); return { synchronized: normalized.length };
  }

  async submit(uid, attemptId, sessionId, submissionId, requestedReason = 'MANUAL') {
    if (!submissionId) fail('invalid-argument', 'A stable submissionId is required.'); const reference = this.db.doc(`examAttempts/${attemptId}`);
    const submitted = await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference); if (!snapshot.exists) fail('not-found', 'Exam attempt not found.'); const attempt = snapshot.data();
      if (attempt.ownerUid !== uid) fail('permission-denied', 'Exam attempt is not owned by this user.');
      if (['SUBMITTED', 'EVALUATING', 'FINALIZED'].includes(attempt.state)) {
        if (attempt.submissionId && attempt.submissionId !== submissionId) return attempt;
        return attempt;
      }
      if (attempt.state !== 'RUNNING' || attempt.sessionId !== sessionId) fail('failed-precondition', 'Attempt cannot be submitted from this session.');
      const now = Timestamp.now(); const timedOut = now.toMillis() >= timestampMillis(attempt.expiresAt);
      const updates = { state: 'SUBMITTED', submittedAt: now, submissionId, submissionReason: timedOut ? 'TIMEOUT' : 'MANUAL', submittedResponseRevision: attempt.responseRevision ?? 0, updatedAt: now };
      transaction.update(reference, updates); return { ...attempt, ...updates };
    });
    this.logger.info?.('certification.attempt.submitted', { attemptId, uid, submissionId: submitted.submissionId, reason: submitted.submissionReason });
    await this.audit.record(attemptId, 'SUBMITTED', { eventId: `submitted-${submitted.submissionId}`, actorType: 'CANDIDATE', actorId: uid, metadata: { reason: submitted.submissionReason, responseRevision: submitted.submittedResponseRevision } });
    return this.finalize(attemptId);
  }

  async finalize(attemptId) {
    const reference = this.db.doc(`examAttempts/${attemptId}`);
    await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference); if (!snapshot.exists) fail('not-found', 'Exam attempt not found.');
      if (snapshot.data().state === 'SUBMITTED') transaction.update(reference, { state: 'EVALUATING', updatedAt: Timestamp.now() });
      else if (!['EVALUATING', 'FINALIZED'].includes(snapshot.data().state)) fail('failed-precondition', 'Attempt is not ready for evaluation.');
    });
    await this.audit.record(attemptId, 'EVALUATION_STARTED');
    let attemptSnapshot = await reference.get(); let attempt = attemptSnapshot.data();
    if (attempt.state === 'FINALIZED') {
      const report = attempt.integrityReportId ? await this.db.doc(`integrityReports/${attempt.integrityReportId}`).get() : null;
      await this.recordFinalizationAudit(attempt);
      return { ...attempt, integrityReport: report?.exists ? report.data() : null };
    }
    const [responseSnapshot, eventSnapshot, projectionSnapshot] = await Promise.all([
      reference.collection('responses').doc('current').get(), reference.collection('integrityEvents').get(), this.db.doc(projectionPath(attempt.ownerUid, attempt.courseId)).get(),
    ]);
    const definition = getTrustedExamDefinition(attempt.examId);
    const examResult = this.scoring.evaluate(definition, responseSnapshot.data()?.answers ?? {});
    const events = eventSnapshot.docs.map((document) => document.data());
    const monitoringDurationMs = attempt.startedAt && attempt.submittedAt ? timestampMillis(attempt.submittedAt) - timestampMillis(attempt.startedAt) : 0;
    const integrityResult = this.integrity.evaluate(events, monitoringDurationMs);
    const now = Timestamp.now();
    const integrityReport = this.integrityReports.create({ attempt, events, integrityResult, certificationPolicyVersion: this.certification.policy.version, createdAt: now });
    const decision = this.certification.evaluate({ eligible: ['ELIGIBLE', 'ATTEMPT_IN_PROGRESS', 'NOT_CERTIFIED', 'REVIEW_REQUIRED'].includes(projectionSnapshot.data()?.eligibilityStatus), attemptState: attempt.state, examResult, integrityResult: { ...integrityResult, overallStatus: integrityReport.overallStatus }, decidedAt: now.toMillis() });
    let certificate = null;
    if (decision.status === DECISION.CERTIFIED) {
      try { certificate = this.issuer.create(attempt, now, { courseTitle: definition.title.replace(/ Certification$/, '') }); }
      catch (error) {
        this.logger.error?.('certification.certificate.issuance_failed', { attemptId, code: error.code, message: error.message });
        throw error;
      }
    }
    const result = await this.db.runTransaction(async (transaction) => {
      const latest = await transaction.get(reference); if (latest.data().state === 'FINALIZED') return latest.data();
      if (latest.data().state !== 'EVALUATING') fail('failed-precondition', 'Attempt evaluation ownership was lost.');
      const projectionRef = this.db.doc(projectionPath(attempt.ownerUid, attempt.courseId));
      const updates = { state: 'FINALIZED', examResult, integrityResult, integrityReportId: integrityReport.reportId, certificationDecision: decision, evaluationVersions: { exam: attempt.examVersion, integrityPolicy: integrityResult.policyVersion, certificationPolicy: decision.policyVersion, reportSchema: integrityReport.schemaVersion }, finalizedAt: now, updatedAt: now };
      transaction.update(reference, updates);
      transaction.set(projectionRef, { eligibilityStatus: decision.status, activeAttemptId: null, latestAttemptId: attempt.id, latestDecision: decision.status, certificateId: certificate?.credentialId ?? null, reviewId: decision.status === DECISION.REVIEW_REQUIRED ? `review-${attempt.id}` : null, updatedAt: now }, { merge: true });
      transaction.create(this.db.doc(`integrityReports/${integrityReport.reportId}`), integrityReport);
      if (decision.status === DECISION.REVIEW_REQUIRED) transaction.create(this.db.doc(`certificationReviews/review-${attempt.id}`), this.reviews.createRecord(attempt, integrityReport, decision.explanation.headline, now));
      if (certificate) transaction.set(this.db.doc(`certificates/${certificate.credentialId}`), certificate);
      return { ...latest.data(), ...updates };
    });
    await this.recordFinalizationAudit({ ...result, integrityReportId: integrityReport.reportId });
    this.logger.info?.('certification.attempt.finalized', { attemptId, decision: result.certificationDecision.status, certificateId: certificate?.credentialId ?? null }); return { ...result, integrityReport };
  }

  async recordFinalizationAudit(attempt) {
    await this.audit.record(attempt.id, 'EVALUATION_COMPLETED', { metadata: { integrityReportId: attempt.integrityReportId } });
    await this.audit.record(attempt.id, 'DECISION_MADE', { metadata: { decision: attempt.certificationDecision?.status } });
    if (attempt.certificationDecision?.status === DECISION.REVIEW_REQUIRED) await this.audit.record(attempt.id, 'REVIEW_CREATED', { metadata: { reviewId: `review-${attempt.id}` } });
    const certificateId = attempt.certificationDecision?.status === DECISION.CERTIFIED ? this.issuer.credentialId(attempt) : null;
    if (certificateId) await this.audit.record(attempt.id, 'CERTIFICATE_ISSUED', { eventId: `certificate-issued-${certificateId}`, metadata: { credentialId: certificateId } });
  }

  async abandon(uid, attemptId, sessionId) {
    const snapshot = await this.db.doc(`examAttempts/${attemptId}`).get();
    if (!snapshot.exists) fail('not-found', 'Exam attempt not found.');
    if (snapshot.data().ownerUid !== uid || snapshot.data().sessionId !== sessionId) fail('permission-denied', 'Invalid exam session lease.');
    const result = await this.transition(uid, attemptId, ['RUNNING'], 'ABANDONED', { sessionId: null, finalizedAt: Timestamp.now(), certificationDecision: { schemaVersion: '1.0.0', policyVersion: '1.0.0', status: DECISION.INCOMPLETE, reasons: ['ATTEMPT_ABANDONED'], decidedAt: Date.now() } });
    await this.db.doc(projectionPath(uid, result.courseId)).set({ activeAttemptId: null, latestAttemptId: attemptId, latestDecision: DECISION.INCOMPLETE, updatedAt: Timestamp.now() }, { merge: true }); return result;
  }

  async expireOverdue() {
    const now = Timestamp.now(); const snapshot = await this.db.collection('examAttempts').where('state', '==', 'RUNNING').where('expiresAt', '<=', now).limit(100).get();
    const results = []; for (const document of snapshot.docs) { const attempt = document.data(); try { results.push(await this.submit(attempt.ownerUid, attempt.id, attempt.sessionId, attempt.submissionId ?? `timeout-${attempt.id}`, 'TIMEOUT')); } catch (error) { this.logger.error?.('certification.attempt.expiry_failed', { attemptId: attempt.id, code: error.code, message: error.message }); } } return results;
  }

  async finalizePending() {
    const snapshot = await this.db.collection('examAttempts').where('state', '==', 'EVALUATING').limit(100).get();
    const results = [];
    for (const document of snapshot.docs) {
      try { results.push(await this.finalize(document.id)); }
      catch (error) { this.logger.error?.('certification.attempt.finalization_retry_failed', { attemptId: document.id, code: error.code, message: error.message }); }
    }
    return results;
  }
}
