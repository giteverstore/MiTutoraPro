import { createPythonExecutionResult } from './runtimes/python/outputCapture.js';

export function createExecutionResult(payload, executionTimeMs) {
  return createPythonExecutionResult({
    ...payload,
    executionTimeMs: payload.executionTimeMs ?? executionTimeMs,
  });
}
