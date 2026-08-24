export const COMPILER_EVENTS = Object.freeze({
  run: 'learning-platform:compiler-run',
  executionComplete: 'learning-platform:compiler-execution-complete',
});

export function dispatchCompilerRun(instanceId, source = 'keyboard') {
  if (!instanceId) throw new Error('A compiler instance ID is required to dispatch a run.');
  window.dispatchEvent(new CustomEvent(COMPILER_EVENTS.run, {
    detail: { instanceId, source },
  }));
}

export function createCompilerExecutionEvent(instanceId, execution, context = {}) {
  return new CustomEvent(COMPILER_EVENTS.executionComplete, {
    detail: {
      instanceId,
      source: context.source ?? 'editor',
      language: context.language,
      execution,
    },
  });
}
