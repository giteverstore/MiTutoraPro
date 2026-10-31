const REASONS = new Set([
  'canonical-miss',
  'fallback-config-missing',
  'metadata-read-failed',
  'publication-not-found',
  'version-invalid',
  'metadata-identity-mismatch',
  'manifest-read-failed',
  'storage-object-missing',
  'storage-read-denied',
  'integrity-mismatch',
  'content-identity-mismatch',
  'lesson-not-found',
  'practice-question-not-found',
]);

const SURFACES = new Set(['course', 'practice', 'project']);
const SOURCES = new Set(['admin', 'legacy-course', 'firebase-practice', 'firebase-fallback']);

export function attachTutorContentFailure(error, reason) {
  if (error && typeof error === 'object' && REASONS.has(reason)) error.tutorContentFailureReason = reason;
  return error;
}

export function createTutorContentFailureLog({ reason, surface, source = 'firebase-fallback' } = {}) {
  if (!REASONS.has(reason) || !SURFACES.has(surface) || !SOURCES.has(source)) return null;
  return Object.freeze({
    operation: 'ai-tutor-content-resolution',
    reason,
    surface,
    source,
  });
}

export function reportTutorContentFailure(logger, fields) {
  const event = createTutorContentFailureLog(fields);
  if (!event) return null;
  try { logger?.(event); } catch { /* Diagnostics must never alter content authorization. */ }
  return event;
}

export const tutorContentDiagnosticInternals = Object.freeze({ REASONS });
