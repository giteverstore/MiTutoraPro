export const CERTIFICATION_DECISIONS = Object.freeze({
  CERTIFIED: 'CERTIFIED',
  NOT_CERTIFIED: 'NOT_CERTIFIED',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  INCOMPLETE: 'INCOMPLETE',
});

export const CERTIFICATION_DECISION_SCHEMA_VERSION = '1.0.0';

export function createCertificationDecision(record) {
  if (!record || !Object.values(CERTIFICATION_DECISIONS).includes(record.status)) {
    throw new TypeError(`Unsupported certification decision: ${record?.status}`);
  }
  return Object.freeze({
    schemaVersion: CERTIFICATION_DECISION_SCHEMA_VERSION,
    policyVersion: record.policyVersion ?? '1.0.0',
    status: record.status,
    reasons: Object.freeze([...(record.reasons ?? [])]),
    explanation: record.explanation ? Object.freeze({ ...record.explanation, statements: Object.freeze([...(record.explanation.statements ?? [])]) }) : null,
    decidedAt: record.decidedAt ?? null,
  });
}
