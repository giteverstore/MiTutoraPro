export function createPythonExecutionResult(payload) {
  const stdout = String(payload.stdout ?? '').replace(/\r\n?/g, '\n').replace(/\n$/, '');
  const stderr = String(payload.stderr ?? '').replace(/\r\n?/g, '\n').replace(/\n$/, '');

  return {
    status: payload.status === 'success' ? 'success' : 'error',
    output: stdout,
    errors: stderr ? [stderr] : [],
    executionTimeMs: payload.executionTimeMs ?? 0,
  };
}
