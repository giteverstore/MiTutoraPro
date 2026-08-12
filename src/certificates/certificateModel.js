export const CERTIFICATE_STATUS = Object.freeze({
  earned: 'earned',
  inProgress: 'in-progress',
});

export function normalizeCertificateDate(value) {
  if (value == null) return null;
  let candidate = value;
  if (typeof value.toDate === 'function') candidate = value.toDate();
  else if (typeof value.toMillis === 'function') candidate = value.toMillis();
  else if (Number.isFinite(value.seconds ?? value._seconds)) {
    const seconds = value.seconds ?? value._seconds;
    const nanoseconds = value.nanoseconds ?? value._nanoseconds ?? 0;
    candidate = seconds * 1000 + Math.floor(nanoseconds / 1e6);
  }
  const date = candidate instanceof Date ? candidate : new Date(candidate);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function formatCertificateDate(value, options = {}) {
  const normalized = normalizeCertificateDate(value);
  if (!normalized) return 'Date unavailable';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  }).format(new Date(normalized));
}

export function createCertificate(record) {
  const id = record.id ?? record.credentialId;
  if (!id || !record.courseId) {
    throw new Error('Certificate records require a credential ID and course ID.');
  }
  return {
    id,
    courseId: record.courseId,
    courseTitle: record.courseTitle ?? record.courseId,
    description: record.description ?? '',
    status: CERTIFICATE_STATUS.earned,
    language: record.language ?? '',
    progress: record.progress ?? 0,
    certifiedHours: record.certifiedHours ?? 0,
    completionDate: normalizeCertificateDate(record.completionDate ?? record.issuedAt),
    issueDate: normalizeCertificateDate(record.issueDate ?? record.issuedAt ?? record.completionDate),
    credentialId: record.credentialId ?? id,
    verificationStatus: record.status === 'ACTIVE' ? 'verified' : record.verificationStatus ?? 'pending',
    verificationUrl: record.verificationUrl ?? null,
  };
}
