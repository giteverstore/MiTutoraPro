export const REMOTE_COMPILER_LANGUAGES = Object.freeze({
  go: Object.freeze({ label: 'Go', fileName: 'main.go', featureFlag: 'GO_RUNTIME_ENABLED' }),
  rust: Object.freeze({ label: 'Rust', fileName: 'main.rs', featureFlag: 'RUST_RUNTIME_ENABLED' }),
});

export const REMOTE_COMPILER_LIMITS = Object.freeze({
  sourceBytes: 64 * 1024,
  stdinBytes: 64 * 1024,
  outputBytes: 1024 * 1024,
  compileTimeoutMs: 15_000,
  executionTimeoutMs: 10_000,
});

export function assertRemoteCompilerRequest(body, environment = process.env) {
  const language = String(body?.language ?? '').trim().toLowerCase();
  const definition = REMOTE_COMPILER_LANGUAGES[language];
  if (!definition) return { error: ['remote-compiler/language-not-supported', 'Only Go and Rust use this execution service.'] };
  if (environment[definition.featureFlag] !== 'true') return { error: ['remote-compiler/language-disabled', `${definition.label} execution is not enabled.`] };
  if (typeof body.source !== 'string' || !body.source.trim()) return { error: ['remote-compiler/invalid-source', 'Source code is required.'] };
  if (Buffer.byteLength(body.source, 'utf8') > REMOTE_COMPILER_LIMITS.sourceBytes) return { error: ['remote-compiler/source-too-large', 'Source code exceeds the 64 KiB limit.'] };
  const stdin = typeof body.stdin === 'string' ? body.stdin : '';
  if (Buffer.byteLength(stdin, 'utf8') > REMOTE_COMPILER_LIMITS.stdinBytes) return { error: ['remote-compiler/stdin-too-large', 'Input exceeds the 64 KiB limit.'] };
  return { language, definition, source: body.source, stdin };
}
