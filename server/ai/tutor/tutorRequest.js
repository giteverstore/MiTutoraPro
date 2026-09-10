import { Buffer } from 'node:buffer';
import { AIServiceError } from '../AIServiceError.js';
import {
  TUTOR_REQUEST_LIMITS,
  TUTOR_REQUEST_TYPES,
} from './tutorConfig.js';
import { resolveHintLevel } from './tutorActivityPolicy.js';
import { createSourceSnapshotHash } from './sourceSnapshot.js';

const REQUEST_TYPE_ALIASES = new Map([
  ['explain-selection', TUTOR_REQUEST_TYPES.explainSelection],
  ['explain_selection', TUTOR_REQUEST_TYPES.explainSelection],
  ['explain-full-code', TUTOR_REQUEST_TYPES.explainFullCode],
  ['explain_full_code', TUTOR_REQUEST_TYPES.explainFullCode],
]);
const SUPPORTED_LANGUAGES = new Set(['python', 'java']);
const COMPLETED_SUCCESS = new Set(['success', 'completed']);
const COMPLETED_FAILURE = new Set(['error', 'failed']);
const NON_EXECUTED = new Set(['idle', 'ready', 'running', 'not-run', 'unknown', '']);

function boundedText(value, field, limit, { required = false } = {}) {
  const normalized = typeof value === 'string' ? value : '';
  if (normalized.length > limit) {
    throw new AIServiceError('ai/request-too-large', 'The code context is too large to explain in one request.', { status: 413 });
  }
  if (required && !normalized.trim()) {
    throw new AIServiceError('ai/invalid-request', `A valid ${field} is required.`, { status: 400 });
  }
  return normalized;
}

function validateSelection(body, operation, code, language) {
  if (operation !== TUTOR_REQUEST_TYPES.explainSelection) return { selectedCode: '', selection: null };
  const selectedCode = boundedText(body.selectedCode, 'selected code', TUTOR_REQUEST_LIMITS.selectedCode);
  if (!selectedCode.trim()) throw new AIServiceError('ai/selection-required', 'Select code before requesting a selection explanation.', { status: 400 });
  const snapshot = body.selectionSnapshot;
  const startOffset = Number(snapshot?.startOffset);
  const endOffset = Number(snapshot?.endOffset);
  const sourceHash = boundedText(snapshot?.sourceHash, 'selection source hash', TUTOR_REQUEST_LIMITS.sourceHash).toLowerCase();
  const selectionHash = boundedText(snapshot?.selectionHash, 'selection hash', TUTOR_REQUEST_LIMITS.sourceHash).toLowerCase();
  const snapshotLanguage = boundedText(snapshot?.language, 'selection language', TUTOR_REQUEST_LIMITS.language).toLowerCase();
  const valid = snapshot && Number.isInteger(startOffset) && Number.isInteger(endOffset)
    && startOffset >= 0 && endOffset > startOffset && endOffset <= code.length
    && sourceHash === createSourceSnapshotHash(code)
    && selectionHash === createSourceSnapshotHash(selectedCode)
    && snapshotLanguage === language
    && code.slice(startOffset, endOffset) === selectedCode;
  if (!valid) throw new AIServiceError('ai/stale-selection', 'Your selection changed. Please select the code again.', { status: 409 });
  return { selectedCode, selection: Object.freeze({ startOffset, endOffset, sourceHash, selectionHash, language }) };
}

function normalizeCompilerStatus(value) {
  const status = String(value ?? '').trim().toLowerCase();
  if (COMPLETED_SUCCESS.has(status)) return 'success';
  if (COMPLETED_FAILURE.has(status)) return 'failed';
  if (status === 'running') return 'running';
  if (NON_EXECUTED.has(status)) return status === 'running' ? 'running' : 'not-run';
  return 'unknown';
}

function deriveEvidence(body, code, language) {
  const currentSourceHash = createSourceSnapshotHash(code);
  const currentStatus = normalizeCompilerStatus(boundedText(body.compilerStatus, 'compiler status', TUTOR_REQUEST_LIMITS.compilerStatus));
  const evidence = body.compilerEvidence;
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence) || currentStatus === 'running') {
    return {
      compilerStatus: currentStatus,
      compilerOutput: '',
      currentSourceHash,
      evidence: Object.freeze({
        basis: 'static',
        note: currentStatus === 'running'
          ? 'Execution is still running; reason only from the code snapshot.'
          : 'No source-bound completed execution evidence is available; reason only from the code snapshot.',
        stale: false,
      }),
    };
  }

  const executedSource = boundedText(evidence.source, 'executed source', TUTOR_REQUEST_LIMITS.evidenceSource, { required: true });
  const claimedHash = boundedText(evidence.sourceHash, 'source hash', TUTOR_REQUEST_LIMITS.sourceHash, { required: true }).trim().toLowerCase();
  const evidenceLanguage = boundedText(evidence.language, 'evidence language', TUTOR_REQUEST_LIMITS.language, { required: true }).trim().toLowerCase();
  const evidenceStatus = normalizeCompilerStatus(boundedText(evidence.status, 'evidence status', TUTOR_REQUEST_LIMITS.compilerStatus));
  const evidenceOutput = boundedText(evidence.output, 'compiler output', TUTOR_REQUEST_LIMITS.compilerOutput);
  const executedHash = createSourceSnapshotHash(executedSource);
  const isCurrent = claimedHash === executedHash
    && executedHash === currentSourceHash
    && evidenceLanguage === language
    && (evidenceStatus === 'success' || evidenceStatus === 'failed')
    && currentStatus !== 'running';

  if (!isCurrent) {
    return {
      compilerStatus: currentStatus,
      compilerOutput: '',
      currentSourceHash,
      evidence: Object.freeze({
        basis: 'static',
        note: 'Earlier compiler evidence does not match the current source snapshot or language and was omitted.',
        stale: true,
      }),
    };
  }

  return {
    compilerStatus: evidenceStatus,
    compilerOutput: evidenceOutput,
    currentSourceHash,
    evidence: Object.freeze({
      basis: evidenceStatus === 'failed' && !evidenceOutput ? 'mixed' : 'runtime',
      note: evidenceStatus === 'success'
        ? evidenceOutput
          ? 'The supplied output is bound to a completed execution of this exact source snapshot.'
          : 'The supplied status reports a successful execution of this exact source snapshot with no output.'
        : evidenceOutput
          ? 'The supplied diagnostic is bound to a failed execution of this exact source snapshot.'
          : 'The supplied status reports a failed execution of this exact source snapshot without a diagnostic.',
      stale: false,
    }),
  };
}

export function normalizeTutorRequest(body, { activityPolicy } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AIServiceError('ai/invalid-request', 'The explanation request is invalid.', { status: 400 });
  }
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > TUTOR_REQUEST_LIMITS.totalBytes) {
    throw new AIServiceError('ai/request-too-large', 'The code context is too large to explain in one request.', { status: 413 });
  }

  const operation = REQUEST_TYPE_ALIASES.get(String(body.requestType ?? '').trim());
  if (!operation) {
    throw new AIServiceError('ai/invalid-request', 'Choose a supported explanation action.', { status: 400 });
  }

  const language = boundedText(body.language, 'programming language', TUTOR_REQUEST_LIMITS.language, { required: true }).trim().toLowerCase();
  if (!SUPPORTED_LANGUAGES.has(language)) {
    throw new AIServiceError('ai/invalid-request', 'Choose a supported programming language.', { status: 400 });
  }
  const code = boundedText(body.code, 'code', TUTOR_REQUEST_LIMITS.code, { required: true });
  const selection = validateSelection(body, operation, code, language);

  const lessonContext = boundedText(body.lessonContext, 'lesson context', TUTOR_REQUEST_LIMITS.lessonContext);
  const compiler = deriveEvidence(body, code, language);
  const assessment = Object.freeze(activityPolicy ?? { activityType: 'unknown', solutionPolicy: 'hints-only', maximumHintLevel: 1 });
  const hintLevel = resolveHintLevel(body.requestedHintLevel, assessment);

  return Object.freeze({
    operation,
    language,
    code,
    selectedCode: selection.selectedCode,
    selection: selection.selection,
    compilerOutput: compiler.compilerOutput,
    compilerStatus: compiler.compilerStatus,
    lessonContext,
    currentSourceHash: compiler.currentSourceHash,
    evidence: compiler.evidence,
    hintLevel,
    assessment,
  });
}
