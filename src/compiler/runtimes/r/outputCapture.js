const normalizeStream = (value) => String(value ?? '')
  .replace(/\r\n?/g, '\n')
  .replace(/\n$/, '');

export function createRExecutionResult(payload) {
  const stdout = normalizeStream(payload.stdout);
  const stderr = normalizeStream(payload.stderr);
  const warnings = (payload.warnings ?? []).map(normalizeStream).filter(Boolean);
  const status = payload.status === 'success' ? 'success' : 'error';

  return {
    status,
    output: stdout,
    errors: stderr ? [stderr] : [],
    stdout,
    stderr,
    warnings,
    exitCode: Object.hasOwn(payload, 'exitCode') ? payload.exitCode : null,
    executionTimeMs: payload.executionTimeMs ?? 0,
    r: payload.r ?? undefined,
  };
}
