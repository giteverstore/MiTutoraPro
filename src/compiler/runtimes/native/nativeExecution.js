const RUNTIME_LABELS = Object.freeze({ c: 'C', cpp: 'C++' });

export function normalizeNativeExecutionResult(result, language) {
  const errors = Array.isArray(result?.errors) ? result.errors.filter(Boolean) : [];
  const stdout = String(result?.stdout ?? '');
  const stderr = String(result?.stderr ?? '');
  const exitCode = result?.exitCode ?? null;
  const compileFailed = errors.length > 0 || exitCode === null;
  const runtimeFailed = !compileFailed && exitCode !== 0;
  const label = RUNTIME_LABELS[language] ?? language;

  return {
    type: 'execution',
    status: compileFailed || runtimeFailed ? 'error' : 'success',
    phase: compileFailed ? 'compile' : runtimeFailed ? 'runtime' : 'complete',
    output: String(result?.output ?? stdout),
    stdout,
    stderr,
    errors: compileFailed
      ? errors
      : runtimeFailed
        ? [stderr.trim() || `${label} program exited with code ${exitCode}.`]
        : [],
    diagnostics: errors,
    warnings: [],
    exitCode,
    compileTimeMs: Math.max(0, Math.round(result?.compileMs ?? 0)),
    runtimeTimeMs: Math.max(0, Math.round(result?.runMs ?? 0)),
    executionTimeMs: Math.max(1, Math.round((result?.compileMs ?? 0) + (result?.runMs ?? 0))),
  };
}
