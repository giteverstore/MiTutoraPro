export function normalizeAssemblyResult(result = {}) {
  const errors = Array.isArray(result.errors) ? result.errors : [];
  const output = String(result.stdout ?? '');
  return {
    status: result.status === 'success' ? 'success' : 'error',
    output,
    stdout: output,
    stderr: String(result.stderr ?? ''),
    errors,
    diagnostics: Array.isArray(result.diagnostics) ? result.diagnostics : [],
    executionTimeMs: Number(result.executionTimeMs ?? 0),
    exitCode: result.exitCode ?? (result.status === 'success' ? 0 : 1),
    emulator: result.emulator ?? null,
    metadata: {
      runtime: 'blink-x86-64',
      assembler: 'NASM 3.00',
      architecture: 'x86-64',
      syntax: 'Intel/NASM',
      ...(result.metadata ?? {}),
    },
  };
}
