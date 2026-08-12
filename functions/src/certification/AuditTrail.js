import { Timestamp } from 'firebase-admin/firestore';

const ALLOWED_TYPES = new Set(['ATTEMPT_CREATED', 'ATTEMPT_STARTED', 'ATTEMPT_RECOVERED', 'SUBMITTED', 'EVALUATION_STARTED', 'EVALUATION_COMPLETED', 'DECISION_MADE', 'REVIEW_CREATED', 'REVIEW_RESOLVED', 'CERTIFICATE_ISSUED']);

export class AuditTrail {
  constructor(db) { this.db = db; }
  async record(attemptId, type, { eventId = `${type.toLowerCase()}-${attemptId}`, actorType = 'SYSTEM', actorId = null, metadata = {} } = {}) {
    if (!ALLOWED_TYPES.has(type)) throw new TypeError(`Unsupported certification audit event: ${type}`);
    const reference = this.db.doc(`examAttempts/${attemptId}/auditEvents/${eventId}`);
    const document = { eventId, attemptId, type, actorType, actorId, timestamp: Timestamp.now(), metadata, schemaVersion: '1.0.0' };
    try { await reference.create(document); } catch (error) { if (error.code !== 6 && error.code !== 'already-exists') throw error; }
    return document;
  }
}
