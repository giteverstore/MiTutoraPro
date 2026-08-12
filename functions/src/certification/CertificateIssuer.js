import { createHash } from 'node:crypto';

export class CertificateIssuer {
  credentialId(attempt) {
    const digest = createHash('sha256').update(`${attempt.ownerUid}:${attempt.id}:${attempt.examVersion}`).digest('hex').slice(0, 16).toUpperCase();
    return `MIT-${attempt.courseId.toUpperCase()}-${digest}`;
  }

  create(attempt, issuedAt, { courseTitle } = {}) {
    const credentialId = this.credentialId(attempt);
    return Object.freeze({
      credentialId,
      ownerUid: attempt.ownerUid,
      courseId: attempt.courseId,
      courseTitle: courseTitle ?? attempt.courseId,
      examAttemptId: attempt.id,
      examVersion: attempt.examVersion,
      issuedAt,
      status: 'ACTIVE',
      verificationCode: createHash('sha256').update(credentialId).digest('hex'),
      certificateVersion: '1.0.0',
    });
  }
}
