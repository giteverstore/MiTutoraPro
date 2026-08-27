export const PRACTICE_DIAGNOSTIC_STAGES = Object.freeze({
  publicationRead: 'publication-read',
  metadataQuery: 'metadata-query',
  metadataNormalization: 'metadata-normalization',
  storageDownload: 'storage-download',
});

const diagnostics = new WeakMap();
const reportedStages = new WeakMap();
const SAFE_CODE = /^[a-z0-9/_-]{1,80}$/i;
const SAFE_NAME = /^[a-z0-9_$.-]{1,80}$/i;

const normalizeCode = (value) => {
  const code = typeof value === 'string' ? value.toLowerCase() : 'unknown';
  return SAFE_CODE.test(code) ? code : 'unknown';
};

const normalizeName = (value) => (
  typeof value === 'string' && SAFE_NAME.test(value) ? value : 'Error'
);

function classify(code, name) {
  const signal = `${code} ${name}`.toLowerCase();
  if (signal.includes('permission-denied') || signal.includes('unauthenticated')) return { category: 'authorization', retryable: false };
  if (signal.includes('unavailable') || signal.includes('network-request-failed')
    || signal.includes('deadline-exceeded') || signal.includes('resource-exhausted')) return { category: 'availability', retryable: true };
  if (signal.includes('cancelled') || signal.includes('aborted')) return { category: 'interrupted', retryable: true };
  if (signal.includes('invalid-argument') || signal.includes('data-loss')
    || signal.includes('content-') || signal.includes('content/')
    || signal.includes('syntaxerror') || signal.includes('typeerror')) return { category: 'invalid-data', retryable: false };
  if (signal.includes('failed-precondition')) return { category: 'configuration', retryable: false };
  return { category: 'unexpected', retryable: false };
}

export function createPracticeDiagnostic(error, stage) {
  const code = normalizeCode(error?.code);
  const name = normalizeName(error?.name);
  return Object.freeze({ stage, code, name, ...classify(code, name) });
}

export function annotatePracticeError(error, stage) {
  if (error && (typeof error === 'object' || typeof error === 'function')) {
    if (!diagnostics.has(error)) diagnostics.set(error, createPracticeDiagnostic(error, stage));
  }
  return error;
}

export function getPracticeDiagnostic(error, fallbackStage) {
  if (error && (typeof error === 'object' || typeof error === 'function')) {
    return diagnostics.get(error) ?? createPracticeDiagnostic(error, fallbackStage);
  }
  return createPracticeDiagnostic(null, fallbackStage);
}

export function reportPracticeDiagnostic(error, fallbackStage, logger = (...values) => console.error(...values)) {
  const diagnostic = getPracticeDiagnostic(error, fallbackStage);
  if (error && (typeof error === 'object' || typeof error === 'function')) {
    const stages = reportedStages.get(error) ?? new Set();
    if (stages.has(diagnostic.stage)) return diagnostic;
    stages.add(diagnostic.stage);
    reportedStages.set(error, stages);
  }
  logger('[Practice content]', diagnostic);
  return diagnostic;
}
