import { assertFunctionExecutionContract } from './functionExecutionContract';
import { createPracticeFunctionHarness, parseFunctionHarnessResult } from './containsDuplicateHarness';
import { compareFunctionResult } from './functionResultComparison';

function classifyFailure(error, execution) {
  const message = error?.message || execution?.errors?.join('\n') || 'Function execution failed.';
  if (error?.name === 'AbortError') return { status: 'cancelled', message };
  if (/timed? out|exceeded/i.test(message)) return { status: 'timeout', message };
  if (error?.code === 'FUNCTION_SERIALIZATION_ERROR' || /serializ|non-boolean|json/i.test(message)) return { status: 'serialization_error', message };
  if (execution?.status === 'error') {
    const compile = /\b(?:compile|compilation|syntax|diagnostic)\b|parse error/i.test(message);
    return { status: compile ? 'compilation_error' : 'runtime_error', message };
  }
  return { status: 'adapter_error', message };
}

export function createFunctionExecutionStrategy(contractInput) {
  const contract = assertFunctionExecutionContract(contractInput);
  return Object.freeze({
    mode: 'function',
    contract,
    async execute({ compilerManager, definition, source, signal, instanceId }) {
      const fixtureResults = [];
      let totalTime = 0;
      for (const [index, fixture] of contract.fixtures.entries()) {
        if (signal.aborted) throw signal.reason ?? new DOMException('Execution cancelled.', 'AbortError');
        try {
          const harness = createPracticeFunctionHarness({ language: definition.language, source, fixture, contract });
          const execution = await compilerManager.execute({
            language: definition.language,
            source: harness,
            filename: definition.language === 'java' ? 'Solution.java' : definition.editor.fileName,
            timeoutMs: definition.timeoutMs,
            signal,
            instanceId: `${instanceId}-fixture-${index + 1}`,
          });
          totalTime += execution.executionTimeMs ?? 0;
          if (execution.status !== 'success') {
            const failure = classifyFailure(null, execution);
            fixtureResults.push({ id: fixture.name, fixture, ...failure });
            continue;
          }
          const actual = parseFunctionHarnessResult(execution.output);
          const passed = compareFunctionResult({ policy: contract.validation.type, actual, expected: fixture.expected, fixture });
          fixtureResults.push({ id: fixture.name, fixture, status: passed ? 'passed' : 'wrong_answer', passed, actual, expected: fixture.expected });
        } catch (error) {
          const failure = classifyFailure(error);
          fixtureResults.push({ id: fixture.name, fixture, ...failure });
          if (failure.status === 'cancelled') throw error;
        }
      }
      const allPassed = fixtureResults.length === contract.fixtures.length && fixtureResults.every(({ passed }) => passed);
      const failure = fixtureResults.find(({ passed }) => !passed);
      return {
        status: allPassed ? 'success' : 'error',
        output: `${fixtureResults.filter(({ passed }) => passed).length}/${fixtureResults.length} public tests passed`,
        stdout: '', stderr: '', errors: failure && failure.status !== 'wrong_answer' ? [failure.message] : [],
        executionTimeMs: totalTime,
        functionResults: fixtureResults,
        allPassed,
      };
    },
    validate(record) { return record?.execution?.allPassed === true; },
  });
}
