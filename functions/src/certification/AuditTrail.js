import { Timestamp } from 'firebase-admin/firestore';

const ALLOWED_TYPES = new Set(['ATTEMPT_CREATED', 'VERIFICATION_STARTED', 'VERIFICATION_COMPLETED', 'ATTEMPT_STARTED', 'ATTEMPT_RECOVERED', 'SUBMITTED', 'EVALUATION_STARTED', 'EVALUATION_COMPLETED', 'DECISION_MADE', 'REVIEW_CREATED', 'REVIEW_STARTED', 'REVIEW_RESOLVED', 'CERTIFICATE_ISSUED']);

export class AuditTrail {
  constructor(db) { this.db = db; }
  createDocument(attemptId, type, { eventId = `${type.toLowerCase()}-${attemptId}`, actorType = 'SYSTEM', actorId = null, metadata = {}, timestamp = Timestamp.now() } = {}) {
    if (!ALLOWED_TYPES.has(type)) throw new TypeError(`Unsupported certification audit event: ${type}`);
    return {
      reference: this.db.doc(`examAttempts/${attemptId}/auditEvents/${eventId}`),
      document: { eventId, attemptId, type, actorType, actorId, timestamp, metadata, schemaVersion: '1.0.0' },
    };
  }

  write(transaction, attemptId, type, options = {}) {
    const { reference, document } = this.createDocument(attemptId, type, options);
    transaction.create(reference, document);
    return document;
  }

  async record(attemptId, type, { eventId = `${type.toLowerCase()}-${attemptId}`, actorType = 'SYSTEM', actorId = null, metadata = {} } = {}) {
    const { reference, document } = this.createDocument(attemptId, type, { eventId, actorType, actorId, metadata });
    try { await reference.create(document); } catch (error) { if (error.code !== 6 && error.code !== 'already-exists') throw error; }
    return document;
  }
}
