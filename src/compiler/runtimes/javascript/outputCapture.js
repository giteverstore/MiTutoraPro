const normalizeStream = (value) => String(value ?? '')
  .replace(/\r\n?/g, '\n')
  .replace(/\n$/, '');

export function createJavaScriptExecutionResult(payload) {
  const stdout = normalizeStream(payload.stdout);
  const stderr = normalizeStream(payload.stderr);
  const result = {
    status: payload.status === 'success' ? 'success' : 'error',
    output: stdout,
    errors: Array.isArray(payload.errors) && payload.errors.length ? payload.errors : stderr ? [stderr] : [],
    executionTimeMs: payload.executionTimeMs ?? 0,
  };
  if (payload.code) result.code = payload.code;
  if (payload.truncated) result.truncated = true;
  if (payload.projectFiles) { result.projectFiles = payload.projectFiles; result.filesystemSupported = payload.filesystemSupported === true; }
  return result;
}
