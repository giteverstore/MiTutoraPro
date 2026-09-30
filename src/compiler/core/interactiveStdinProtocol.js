export const COMPILER_EXECUTION_EVENTS = Object.freeze({
  START: 'execution-start',
  STDOUT: 'stdout',
  STDERR: 'stderr',
  STDIN_REQUEST: 'stdin-request',
  COMPLETE: 'execution-complete',
  ERROR: 'execution-error',
  CANCELLED: 'execution-cancelled',
});

export const INTERACTIVE_STDIN_WAIT_TIMEOUT_MS = 90_000;
export const INTERACTIVE_STDIN_BUFFER_BYTES = 64 * 1024;

export function compilerExecutionEvent(type, executionId, detail = {}) {
  return Object.freeze({ type, executionId: String(executionId ?? ''), ...detail });
}
