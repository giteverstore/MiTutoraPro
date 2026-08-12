export const INTEGRITY_RESULT_SCHEMA_VERSION = '1.0.0';

export function createIntegrityResult(record) {
  if (!record || !Number.isFinite(record.score) || !Number.isFinite(record.warningCount)) {
    throw new TypeError('IntegrityResult requires score and warningCount.');
  }
  return Object.freeze({
    schemaVersion: INTEGRITY_RESULT_SCHEMA_VERSION,
    policyVersion: record.policyVersion ?? '1.0.0',
    score: Math.max(0, Math.min(100, record.score)),
    warningCount: Math.max(0, record.warningCount),
    violationCount: Math.max(0, record.violationCount ?? 0),
    criticalViolationCount: Math.max(0, record.criticalViolationCount ?? 0),
    deductions: Object.freeze([...(record.deductions ?? [])]),
    flags: Object.freeze([...(record.flags ?? [])]),
    monitoringDurationMs: Math.max(0, record.monitoringDurationMs ?? 0),
  });
}
