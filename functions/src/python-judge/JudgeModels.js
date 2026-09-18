import { createHash, randomUUID } from 'node:crypto';
import { PYTHON_EXECUTION_POLICY_VERSION, PYTHON_JUDGE_LIMITS, PYTHON_JUDGE_VERSION, PYTHON_RUNTIME } from './JudgePolicy.js';

export const JUDGE_STATUSES = Object.freeze([
  'PASS', 'FAIL', 'TIMEOUT', 'MEMORY_LIMIT', 'PID_LIMIT', 'OUTPUT_LIMIT', 'DISK_LIMIT',
  'FD_LIMIT', 'SYNTAX_ERROR', 'RUNTIME_ERROR', 'JUDGE_ERROR', 'CLEANUP_FAILURE',
]);

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/;
const HASH = /^[a-f0-9]{64}$/;
const VERSION = /^v[1-9][0-9]*$/;
const REQUEST_FIELDS = new Set(['activityId', 'activityVersion', 'contentHash', 'language', 'runtimeVersion', 'sourceCode', 'protectedSuiteId', 'protectedSuiteVersion', 'runtimeImageDigest', 'executionPolicyVersion', 'executionId']);

function required(value, pattern, field) {
  if (typeof value !== 'string' || !pattern.test(value)) throw Object.assign(new Error(`${field} is invalid.`), { code: 'judge/invalid-request' });
  return value;
}

export function normalizeJudgeRequest(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object') throw Object.assign(new Error('Judge request is invalid.'), { code: 'judge/invalid-request' });
  if (Object.keys(value).some((field) => !REQUEST_FIELDS.has(field))) throw Object.assign(new Error('Judge request contains unexpected authority.'), { code: 'judge/unexpected-field' });
  if (Buffer.byteLength(value.sourceCode ?? '', 'utf8') > PYTHON_JUDGE_LIMITS.maxSourceBytes) throw Object.assign(new Error('Source exceeds the judge limit.'), { code: 'judge/source-too-large' });
  if (typeof value.sourceCode !== 'string' || !value.sourceCode.trim()) throw Object.assign(new Error('Source is required.'), { code: 'judge/source-required' });
  const normalized = {
    activityId: required(value.activityId, ID, 'activityId'),
    activityVersion: required(value.activityVersion, VERSION, 'activityVersion'),
    contentHash: required(value.contentHash, HASH, 'contentHash'),
    language: required(value.language, ID, 'language').toLowerCase(),
    runtimeVersion: required(value.runtimeVersion, ID, 'runtimeVersion'),
    sourceCode: value.sourceCode,
    protectedSuiteId: required(value.protectedSuiteId, ID, 'protectedSuiteId'),
    protectedSuiteVersion: required(value.protectedSuiteVersion, VERSION, 'protectedSuiteVersion'),
    runtimeImageDigest: required(value.runtimeImageDigest, HASH, 'runtimeImageDigest'),
    executionPolicyVersion: required(value.executionPolicyVersion, ID, 'executionPolicyVersion'),
    executionId: required(value.executionId, ID, 'executionId'),
  };
  if (normalized.language !== PYTHON_RUNTIME.language || normalized.runtimeVersion !== PYTHON_RUNTIME.version
    || normalized.executionPolicyVersion !== PYTHON_EXECUTION_POLICY_VERSION) {
    throw Object.assign(new Error('Judge runtime policy binding failed.'), { code: 'judge/policy-mismatch' });
  }
  return Object.freeze(normalized);
}

export function newExecutionId() { return `py-${randomUUID()}`; }

export function sourceDigest(source) { return createHash('sha256').update(source, 'utf8').digest('hex'); }

export function trustedJudgeResult(request, values) {
  if (!JUDGE_STATUSES.includes(values.status)) throw Object.assign(new Error('Judge status is invalid.'), { code: 'judge/invalid-result' });
  if (!Number.isSafeInteger(values.testsPassed) || !Number.isSafeInteger(values.testsTotal)
    || values.testsPassed < 0 || values.testsTotal < 0 || values.testsPassed > values.testsTotal) {
    throw Object.assign(new Error('Judge counts are invalid.'), { code: 'judge/invalid-result' });
  }
  return Object.freeze({
    executionId: request.executionId,
    activityId: request.activityId,
    activityVersion: request.activityVersion,
    contentHash: request.contentHash,
    language: PYTHON_RUNTIME.language,
    runtimeVersion: PYTHON_RUNTIME.version,
    protectedSuiteVersion: request.protectedSuiteVersion,
    runtimeImageDigest: request.runtimeImageDigest,
    executionPolicyVersion: request.executionPolicyVersion,
    status: values.status,
    reasonCode: values.reasonCode,
    testsPassed: values.testsPassed,
    testsTotal: values.testsTotal,
    durationMs: Math.max(0, Math.min(PYTHON_JUDGE_LIMITS.totalWallTimeMs, Math.trunc(values.durationMs ?? 0))),
    resourceClass: 'python-1vcpu-256m',
    cleanupStatus: values.cleanupStatus,
    judgeVersion: PYTHON_JUDGE_VERSION,
  });
}
