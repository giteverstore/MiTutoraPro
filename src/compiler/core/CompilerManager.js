import {
  assertCompilerRequestLimits,
  COMPILER_RESOURCE_ERROR_CODES,
  COMPILER_RESOURCE_LIMITS,
  CompilerResourceLimitError,
  compilerResourceFailure,
  createCompilerOutputBudget,
  utf8ByteLength,
  utf8Prefix,
} from './compilerResourcePolicy.js';

export function normalizeCompilerStdin(stdin) {
  if (Array.isArray(stdin)) return stdin.map((value) => String(value ?? '')).join('\n');
  return String(stdin ?? '');
}

export class CompilerManager {
  constructor({ runtimeRegistry, validatorRegistry }) {
    this.runtimeRegistry = runtimeRegistry;
    this.validatorRegistry = validatorRegistry;
    this.runtimeInitialization = new WeakMap();
    this.activeExecutions = new Map();
  }

  async initialize(language, options = {}) {
    const runtime = this.runtimeRegistry.resolve(language, options.instanceId);
    if (!this.runtimeInitialization.has(runtime)) {
      const initialization = runtime.initialize(options).catch((error) => {
        this.runtimeInitialization.delete(runtime);
        throw error;
      });
      this.runtimeInitialization.set(runtime, initialization);
    }
    await this.runtimeInitialization.get(runtime);
    return runtime;
  }

  async execute({ language, source, stdin, inputs, filename, execution, executionId, onExecutionEvent, setupSql, signal, timeoutMs, instanceId }) {
    if (!this.runtimeRegistry.has(language)) {
      return {
        status: 'error',
        output: '',
        errors: [`No compiler runtime is registered for "${language}".`],
        executionTimeMs: 0,
      };
    }
    const normalizedStdin = normalizeCompilerStdin(stdin ?? inputs);
    const normalizedSetupSql = setupSql ?? execution?.setupSql ?? '';
    try {
      assertCompilerRequestLimits({ source, stdin: normalizedStdin, setupSql: normalizedSetupSql });
    } catch (error) {
      if (error instanceof CompilerResourceLimitError) return compilerResourceFailure(error);
      throw error;
    }

    const key = `${String(instanceId ?? 'default')}::${String(language)}`;
    this.activeExecutions.get(key)?.controller.abort();
    const controller = new AbortController();
    const abortFromCaller = () => controller.abort(signal?.reason);
    signal?.addEventListener('abort', abortFromCaller, { once: true });
    if (signal?.aborted) controller.abort(signal.reason);
    const active = { controller, executionId: String(executionId ?? ''), interactiveBytes: 0, limitError: null };
    const outputBudget = createCompilerOutputBudget({ onLimit: (error) => { active.limitError = error; controller.abort(error); } });
    this.activeExecutions.set(key, active);
    const forwardEvent = (event) => {
      if (event?.type === 'stdout' || event?.type === 'stderr') {
        const accepted = outputBudget.accept(event.type, event.value);
        if (accepted) onExecutionEvent?.({ ...event, value: accepted });
        return;
      }
      onExecutionEvent?.(event);
    };

    try {
      const runtime = await this.initialize(language, { signal: controller.signal, instanceId, timeoutMs });
      const result = await runtime.execute({
        source,
        stdin: normalizedStdin,
        filename,
        execution,
        executionId,
        onExecutionEvent: onExecutionEvent ? forwardEvent : undefined,
        setupSql: normalizedSetupSql,
        signal: controller.signal,
        timeoutMs,
      });
      if (active.limitError) return compilerResourceFailure(active.limitError, outputBudget.state);
      const stdout = String(result.stdout ?? result.output ?? '');
      const stderr = String(result.stderr ?? result.errors?.join('\n') ?? '');
      if (utf8ByteLength(stdout) > COMPILER_RESOURCE_LIMITS.stdoutBytes) {
        return compilerResourceFailure(new CompilerResourceLimitError(COMPILER_RESOURCE_ERROR_CODES.OUTPUT), {
          ...outputBudget.state,
          stdout: utf8Prefix(stdout, COMPILER_RESOURCE_LIMITS.stdoutBytes),
          stderr: utf8Prefix(stderr, COMPILER_RESOURCE_LIMITS.stderrBytes),
        });
      }
      if (utf8ByteLength(stderr) > COMPILER_RESOURCE_LIMITS.stderrBytes) {
        return compilerResourceFailure(new CompilerResourceLimitError(COMPILER_RESOURCE_ERROR_CODES.STDERR), {
          ...outputBudget.state,
          stdout: utf8Prefix(stdout, COMPILER_RESOURCE_LIMITS.stdoutBytes),
          stderr: utf8Prefix(stderr, COMPILER_RESOURCE_LIMITS.stderrBytes),
        });
      }
      return result;
    } catch (error) {
      if (active.limitError) return compilerResourceFailure(active.limitError, outputBudget.state);
      throw error;
    } finally {
      signal?.removeEventListener('abort', abortFromCaller);
      if (this.activeExecutions.get(key) === active) this.activeExecutions.delete(key);
    }
  }

  submitStdin({ language, instanceId, executionId, value }) {
    if (!this.runtimeRegistry.has(language)) return false;
    const key = `${String(instanceId ?? 'default')}::${String(language)}`;
    const active = this.activeExecutions.get(key);
    if (!active || active.executionId !== String(executionId ?? '')) return false;
    const bytes = utf8ByteLength(value);
    if (bytes > COMPILER_RESOURCE_LIMITS.interactiveStdinSubmissionBytes) {
      throw new CompilerResourceLimitError(COMPILER_RESOURCE_ERROR_CODES.STDIN, 'Interactive input exceeds the per-submission compiler limit (32 KiB).');
    }
    if (active.interactiveBytes + bytes > COMPILER_RESOURCE_LIMITS.interactiveStdinExecutionBytes) {
      active.limitError = new CompilerResourceLimitError(COMPILER_RESOURCE_ERROR_CODES.STDIN, 'Program stopped because its interactive input exceeded the compiler limit.');
      active.controller.abort(active.limitError);
      throw active.limitError;
    }
    const submitted = this.runtimeRegistry.resolve(language, instanceId).submitStdin({ executionId, value });
    if (submitted) active.interactiveBytes += bytes;
    return submitted;
  }

  async executeTests({ testCases = [], ...request }) {
    const results = [];
    for (const testCase of testCases) {
      const result = await this.execute({
        ...request,
        stdin: testCase.stdin ?? testCase.inputs ?? request.stdin,
        execution: { ...request.execution, ...testCase.execution },
      });
      const passed = result.status === 'success' && this.validateOutput({
        expectedOutput: testCase.expectedOutput,
        programOutput: result.output,
        validatorType: testCase.validatorType ?? request.validatorType,
        validatorOptions: testCase.validatorOptions ?? request.validatorOptions,
      });
      results.push({ id: testCase.id, passed, ...result });
    }
    return results;
  }

  async format({ language, source, options, instanceId }) {
    assertCompilerRequestLimits({ source });
    const runtime = await this.initialize(language, { instanceId });
    return runtime.format(source, options);
  }

  validateOutput({
    expectedOutput,
    programOutput,
    validatorType = 'normalized',
    validatorOptions,
  }) {
    const validator = this.validatorRegistry.resolve(validatorType);
    if (!validator) throw new Error(`No output validator is registered for "${validatorType}".`);
    return validator.validate(expectedOutput, programOutput, validatorOptions);
  }

  async reset(language, instanceId) {
    if (language && this.runtimeRegistry.has(language)) {
      const runtime = this.runtimeRegistry.resolve(language, instanceId);
      this.runtimeInitialization.delete(runtime);
      return runtime.reset();
    }
    await Promise.all(
      this.runtimeRegistry.getInitializedRuntimes().map((runtime) => runtime.reset()),
    );
    return {
      status: 'idle',
      output: '',
      errors: [],
      executionTimeMs: null,
    };
  }

  async dispose() {
    for (const { controller } of this.activeExecutions.values()) controller.abort();
    this.activeExecutions.clear();
    await this.runtimeRegistry.dispose();
    this.runtimeInitialization = new WeakMap();
  }
}
