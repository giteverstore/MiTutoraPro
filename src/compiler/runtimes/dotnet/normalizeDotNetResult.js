const normalizeStream = (value) => String(value ?? '').replace(/\r\n?/g, '\n').replace(/\n$/, '');

export function normalizeDotNetResult(payload, language = 'csharp') {
  const stdout = normalizeStream(payload.stdout);
  const stderr = normalizeStream(payload.stderr);
  const diagnostics = payload.diagnostics ?? [];
  const warnings = diagnostics.filter(({ severity }) => severity === 'warning');
  const compileErrors = diagnostics.filter(({ severity }) => severity === 'error');
  const runtimeError = normalizeStream(payload.runtimeError);
  const nonzeroExit = Number.isInteger(payload.exitCode) && payload.exitCode !== 0;
  const formattedDiagnostics = compileErrors.map(({ code, line, column, message }) => (
    `${code}${line ? ` (${line},${column})` : ''}: ${message}`
  ));
  const errors = [...formattedDiagnostics];
  if (runtimeError) errors.push(runtimeError);
  if (stderr && payload.status !== 'success') errors.push(stderr);
  if (nonzeroExit) errors.push(`Program exited with code ${payload.exitCode}.`);

  return {
    status: payload.status === 'success' && !nonzeroExit ? 'success' : 'error',
    phase: payload.phase ?? (compileErrors.length ? 'compile' : 'runtime'),
    output: stdout,
    stdout,
    stderr,
    errors,
    diagnostics,
    warnings,
    runtimeError: runtimeError || null,
    exitCode: Object.hasOwn(payload, 'exitCode') ? payload.exitCode : null,
    executionTimeMs: payload.executionTimeMs ?? 0,
    dotnet: {
      runtimeVersion: '10.0.12',
      compilerVersion: '5.9.0',
      language,
      languageVersion: language === 'visualbasic' ? '16.9' : '14.0',
    },
  };
}
