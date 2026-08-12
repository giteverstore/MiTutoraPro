import { Timestamp } from 'firebase-admin/firestore';
import { CertificateIssuer } from './CertificateIssuer.js';
import { AuditTrail } from './AuditTrail.js';

function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
function reviewer(auth) { return auth?.token?.admin === true || auth?.token?.certificationReviewer === true; }

export class ReviewService {
  constructor({ db, issuer = new CertificateIssuer(), audit = new AuditTrail(db) }) { this.db = db; this.issuer = issuer; this.audit = audit; }

  createRecord(attempt, integrityReport, reasonSummary, createdAt) {
    return Object.freeze({
      reviewId: `review-${attempt.id}`, attemptId: attempt.id, candidateUid: attempt.ownerUid,
      courseId: attempt.courseId, status: 'PENDING', resolution: null,
      reasonSummary, integrityReportId: integrityReport.reportId,
      createdAt, updatedAt: createdAt, resolvedAt: null, resolvedBy: null, schemaVersion: '1.0.0',
    });
  }

  async begin(auth, reviewId) {
    if (!reviewer(auth)) fail('permission-denied', 'Certification reviewer privileges are required.');
    const reference = this.db.doc(`certificationReviews/${reviewId}`);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference); if (!snapshot.exists) fail('not-found', 'Certification review was not found.');
      const review = snapshot.data();
      if (review.status === 'IN_REVIEW') return review;
      if (review.status !== 'PENDING') fail('failed-precondition', 'Certification review is already resolved.');
      const updates = { status: 'IN_REVIEW', updatedAt: Timestamp.now() };
      transaction.update(reference, updates); return { ...review, ...updates };
    });
  }

  async resolve(auth, reviewId, resolution) {
    if (!reviewer(auth)) fail('permission-denied', 'Certification reviewer privileges are required.');
    if (!['CERTIFIED', 'NOT_CERTIFIED'].includes(resolution)) fail('invalid-argument', 'Review resolution must be CERTIFIED or NOT_CERTIFIED.');
    const reference = this.db.doc(`certificationReviews/${reviewId}`); const now = Timestamp.now();
    const result = await this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference); if (!snapshot.exists) fail('not-found', 'Certification review was not found.');
      const review = snapshot.data();
      if (review.status === 'RESOLVED') {
        if (review.resolution !== resolution) fail('failed-precondition', 'Certification review already has a different resolution.');
        return review;
      }
      if (!['PENDING', 'IN_REVIEW'].includes(review.status)) fail('failed-precondition', 'Certification review cannot be resolved.');
      const attemptRef = this.db.doc(`examAttempts/${review.attemptId}`); const attemptSnapshot = await transaction.get(attemptRef);
      if (!attemptSnapshot.exists || attemptSnapshot.data().state !== 'FINALIZED') fail('failed-precondition', 'The reviewed attempt is not finalized.');
      const attempt = attemptSnapshot.data(); let certificate = null;
      if (resolution === 'CERTIFIED') {
        certificate = this.issuer.create(attempt, now);
        transaction.set(this.db.doc(`certificates/${certificate.credentialId}`), certificate, { merge: false });
      }
      const resolved = { status: 'RESOLVED', resolution, resolvedAt: now, resolvedBy: auth.uid, updatedAt: now };
      transaction.update(reference, resolved);
      transaction.set(this.db.doc(`users/${attempt.ownerUid}/certifications/${attempt.courseId}`), {
        eligibilityStatus: resolution, latestDecision: resolution, certificateId: certificate?.credentialId ?? null,
        reviewId, updatedAt: now,
      }, { merge: true });
      return { ...review, ...resolved, certificateId: certificate?.credentialId ?? null };
    });
    await this.audit.record(result.attemptId, 'REVIEW_RESOLVED', { eventId: `review-resolved-${reviewId}`, actorType: 'REVIEWER', actorId: auth.uid, metadata: { resolution } });
    if (result.certificateId) await this.audit.record(result.attemptId, 'CERTIFICATE_ISSUED', { eventId: `certificate-issued-${result.certificateId}`, metadata: { credentialId: result.certificateId, source: 'REVIEW_RESOLUTION' } });
    return result;
  }
}
