export const INTEGRITY_REPORT_STATUSES = Object.freeze({
  CLEAN: 'CLEAN', MINOR_CONCERNS: 'MINOR_CONCERNS',
  SIGNIFICANT_CONCERNS: 'SIGNIFICANT_CONCERNS', REVIEW_REQUIRED: 'REVIEW_REQUIRED',
});

export function createIntegrityReport(record) {
  if (!record?.reportId || !record.attemptId || !Object.values(INTEGRITY_REPORT_STATUSES).includes(record.overallStatus)) {
    throw new TypeError('IntegrityReport requires reportId, attemptId, and a valid overallStatus.');
  }
  return Object.freeze({ ...record, violations: Object.freeze([...(record.violations ?? [])]), detectorSummary: Object.freeze([...(record.detectorSummary ?? [])]), schemaVersion: record.schemaVersion ?? '1.0.0' });
}
