export class CompilerManager {
  constructor({ runtimeRegistry, validatorRegistry }) {
    this.runtimeRegistry = runtimeRegistry;
    this.validatorRegistry = validatorRegistry;
    this.runtimeInitialization = new WeakMap();
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

  async execute({ language, source, stdin, inputs, filename, execution, signal, timeoutMs, instanceId }) {
    if (!this.runtimeRegistry.has(language)) {
      return {
        status: 'error',
        output: '',
        errors: [`No compiler runtime is registered for "${language}".`],
        executionTimeMs: 0,
      };
    }
    const runtime = await this.initialize(language, { signal, instanceId });
    return runtime.execute({
      source,
      stdin: stdin ?? inputs ?? '',
      filename,
      execution,
      signal,
      timeoutMs,
    });
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
    await this.runtimeRegistry.dispose();
    this.runtimeInitialization = new WeakMap();
  }
}
