export const COMPILER_RESOURCE_LIMITS = Object.freeze({
  sourceBytes: 512 * 1024,
  bufferedStdinBytes: 256 * 1024,
  interactiveStdinSubmissionBytes: 32 * 1024,
  interactiveStdinExecutionBytes: 512 * 1024,
  stdoutBytes: 2 * 1024 * 1024,
  stderrBytes: 1024 * 1024,
  transcriptBytes: 4 * 1024 * 1024,
  databaseResultRows: 1000,
});

export const COMPILER_RESOURCE_ERROR_CODES = Object.freeze({
  SOURCE: 'source_limit_exceeded',
  STDIN: 'stdin_limit_exceeded',
  OUTPUT: 'output_limit_exceeded',
  STDERR: 'stderr_limit_exceeded',
});

export const COMPILER_RESOURCE_MESSAGES = Object.freeze({
  [COMPILER_RESOURCE_ERROR_CODES.SOURCE]: 'Source code exceeds the compiler limit (512 KiB).',
  [COMPILER_RESOURCE_ERROR_CODES.STDIN]: 'Program input exceeds the compiler limit.',
  [COMPILER_RESOURCE_ERROR_CODES.OUTPUT]: 'Program stopped because it produced too much output.',
  [COMPILER_RESOURCE_ERROR_CODES.STDERR]: 'Program stopped because it produced too much error output.',
});

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function utf8ByteLength(value) {
  return encoder.encode(String(value ?? '')).byteLength;
}

export function utf8Prefix(value, maximumBytes) {
  const bytes = encoder.encode(String(value ?? ''));
  if (bytes.byteLength <= maximumBytes) return String(value ?? '');
  return decoder.decode(bytes.slice(0, Math.max(0, maximumBytes)));
}

export class CompilerResourceLimitError extends Error {
  constructor(code, message = COMPILER_RESOURCE_MESSAGES[code]) {
    super(message);
    this.name = 'CompilerResourceLimitError';
    this.code = code;
  }
}

export function assertCompilerRequestLimits({ source = '', stdin = '', setupSql = '' }) {
  if (utf8ByteLength(source) > COMPILER_RESOURCE_LIMITS.sourceBytes
    || utf8ByteLength(setupSql) > COMPILER_RESOURCE_LIMITS.sourceBytes) {
    throw new CompilerResourceLimitError(COMPILER_RESOURCE_ERROR_CODES.SOURCE);
  }
  if (utf8ByteLength(stdin) > COMPILER_RESOURCE_LIMITS.bufferedStdinBytes) {
    throw new CompilerResourceLimitError(COMPILER_RESOURCE_ERROR_CODES.STDIN);
  }
}

export function compilerResourceFailure(error, { stdout = '', stderr = '', executionTimeMs = 0 } = {}) {
  const message = error?.message || COMPILER_RESOURCE_MESSAGES[error?.code] || 'Compiler resource limit exceeded.';
  return {
    status: 'error',
    code: error?.code,
    output: stdout,
    stdout,
    stderr,
    errors: [message],
    executionTimeMs,
    truncated: true,
  };
}

export function createCompilerOutputBudget({ onLimit } = {}) {
  const state = { stdoutBytes: 0, stderrBytes: 0, stdout: '', stderr: '', exceeded: null };
  const accept = (stream, value) => {
    if (state.exceeded) return '';
    const key = stream === 'stderr' ? 'stderrBytes' : 'stdoutBytes';
    const limit = stream === 'stderr' ? COMPILER_RESOURCE_LIMITS.stderrBytes : COMPILER_RESOURCE_LIMITS.stdoutBytes;
    const text = String(value ?? '');
    const bytes = utf8ByteLength(text);
    const remaining = limit - state[key];
    const accepted = remaining > 0 ? utf8Prefix(text, remaining) : '';
    state[key] += utf8ByteLength(accepted);
    state[stream] += accepted;
    if (bytes > remaining) {
      state.exceeded = new CompilerResourceLimitError(
        stream === 'stderr' ? COMPILER_RESOURCE_ERROR_CODES.STDERR : COMPILER_RESOURCE_ERROR_CODES.OUTPUT,
      );
      onLimit?.(state.exceeded);
    }
    return accepted;
  };
  return { state, accept };
}

const TRANSCRIPT_MARKER = '[Earlier terminal output truncated]\n';

export function appendBoundedTranscript(current, chunk, maximumBytes = COMPILER_RESOURCE_LIMITS.transcriptBytes) {
  const next = `${current?.text ?? ''}${String(chunk ?? '')}`;
  const nextBytes = utf8ByteLength(next);
  if (nextBytes <= maximumBytes) return { text: next, bytes: nextBytes, truncated: Boolean(current?.truncated) };
  const markerBytes = utf8ByteLength(TRANSCRIPT_MARKER);
  const encoded = encoder.encode(next);
  const available = Math.max(0, maximumBytes - markerBytes);
  let tail = decoder.decode(encoded.slice(Math.max(0, encoded.byteLength - available)));
  while (tail && utf8ByteLength(tail) > available) tail = tail.slice(1);
  const text = `${TRANSCRIPT_MARKER}${tail}`;
  return { text, bytes: utf8ByteLength(text), truncated: true };
}
