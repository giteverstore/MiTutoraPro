const normalizeStream = (value) => String(value ?? '')
  .replace(/\r\n?/g, '\n')
  .replace(/\n$/, '');

export function createJavaExecutionResult(payload) {
  const stdout = normalizeStream(payload.stdout);
  const stderr = normalizeStream(payload.stderr);

  return {
    status: payload.status === 'success' ? 'success' : 'error',
    output: stdout,
    errors: stderr ? [stderr] : [],
    executionTimeMs: payload.executionTimeMs ?? 0,
  };
}
