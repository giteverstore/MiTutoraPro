import { createCertificationEligibility } from '../models/CertificationEligibility';
import { createExamAttempt } from '../models/ExamAttempt';
import { CertificationApiRepository } from '../repositories/CertificationApiRepository';

function milliseconds(value) {
  if (value == null) return null;
  if (Number.isFinite(value)) return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (Number.isFinite(value.seconds ?? value._seconds)) return (value.seconds ?? value._seconds) * 1000 + Math.floor((value.nanoseconds ?? value._nanoseconds ?? 0) / 1e6);
  const parsed = new Date(value).getTime(); return Number.isFinite(parsed) ? parsed : null;
}

function normalizeAttempt(record) {
  if (!record) return null;
  const timestamps = ['createdAt', 'scheduledFor', 'verificationStartedAt', 'verifiedAt', 'startedAt', 'expiresAt', 'submittedAt', 'finalizedAt', 'lastHeartbeatAt', 'recoveryDeadline', 'updatedAt'];
  const normalized = { ...record };
  timestamps.forEach((field) => { normalized[field] = milliseconds(record[field]); });
  return createExamAttempt(normalized);
}

function friendly(error) {
  const code = String(error?.code ?? '').replace('functions/', '');
  const messages = {
    unauthenticated: 'Sign in to access certification.',
    'permission-denied': error?.message || 'You are not eligible for this certification yet.',
    'failed-precondition': error?.message || 'This certification action is not currently available.',
    'already-exists': 'Another browser session currently owns this exam.',
    'deadline-exceeded': 'The exam recovery window has expired.',
    unavailable: 'Certification services are temporarily unavailable. Please reconnect and try again.',
  };
  const normalized = new Error(messages[code] ?? error?.message ?? 'Certification could not be completed.');
  normalized.code = code || 'unknown'; normalized.cause = error; return normalized;
}

export class CertificationService {
  constructor(repository = new CertificationApiRepository()) { this.repository = repository; }
  async run(operation) { try { return await operation(); } catch (error) { throw friendly(error); } }
  getStatus(courseId) { return this.run(async () => createCertificationEligibility(await this.repository.getStatus(courseId))); }
  getCandidateExam(examId) { return this.run(() => this.repository.getCandidateExam(examId)); }
  getAttempt(attemptId) { return this.run(async () => { const result = await this.repository.getAttempt(attemptId); return { attempt: normalizeAttempt(result.attempt), responses: result.responses, integrityEvents: result.integrityEvents ?? [], integrityReport: result.integrityReport ?? null }; }); }
  createAttempt(data) { return this.run(async () => normalizeAttempt(await this.repository.createAttempt(data))); }
  beginVerification(id) { return this.run(async () => normalizeAttempt(await this.repository.beginVerification(id))); }
  completeVerification(id, summary) { return this.run(async () => normalizeAttempt(await this.repository.completeVerification(id, summary))); }
  startAttempt(id) { return this.run(async () => normalizeAttempt(await this.repository.startAttempt(id))); }
  acquireLease(id, sessionId) { return this.run(async () => normalizeAttempt(await this.repository.acquireLease(id, sessionId))); }
  heartbeat(id, sessionId, sequence) { return this.run(() => this.repository.heartbeat(id, sessionId, sequence)); }
  saveResponses(payload) { return this.run(() => this.repository.saveResponses(payload)); }
  saveIntegrityEvents(payload) { return this.run(() => this.repository.saveIntegrityEvents(payload)); }
  submit(payload) { return this.run(async () => normalizeAttempt(await this.repository.submit(payload))); }
  abandon(id, sessionId) { return this.run(async () => normalizeAttempt(await this.repository.abandon(id, sessionId))); }
}

export const certificationService = new CertificationService();
