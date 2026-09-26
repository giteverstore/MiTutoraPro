const normalizeStream = (value) => String(value ?? '')
  .replace(/\r\n?/g, '\n')
  .replace(/\n$/, '');

export function createPhpExecutionResult(payload) {
  const stdout = normalizeStream(payload.stdout);
  const stderr = normalizeStream(payload.stderr);
  const exitCode = Number.isInteger(payload.exitCode)
    ? payload.exitCode
    : payload.status === 'success' ? 0 : 1;

  return {
    status: payload.status === 'success' && exitCode === 0 ? 'success' : 'error',
    output: stdout,
    errors: stderr ? [stderr] : [],
    stdout,
    stderr,
    exitCode,
    executionTimeMs: payload.executionTimeMs ?? 0,
  };
}
