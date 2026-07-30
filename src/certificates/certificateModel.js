export const CERTIFICATE_STATUS = Object.freeze({
  earned: 'earned',
  inProgress: 'in-progress',
});

export function createCertificate(record) {
  if (!record.id || !record.courseId || !record.courseTitle) {
    throw new Error('Certificate records require id, courseId, and courseTitle.');
  }
  return {
    id: record.id,
    courseId: record.courseId,
    courseTitle: record.courseTitle,
    description: record.description ?? '',
    status: record.status,
    language: record.language ?? '',
    progress: record.progress ?? 0,
    certifiedHours: record.certifiedHours ?? 0,
    completionDate: record.completionDate ?? null,
    issueDate: record.issueDate ?? record.completionDate ?? null,
    credentialId: record.credentialId ?? null,
    verificationStatus: record.verificationStatus ?? 'pending',
    verificationUrl: record.verificationUrl ?? null,
  };
}
