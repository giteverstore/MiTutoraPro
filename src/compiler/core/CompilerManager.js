export class CompilerManager {
  constructor({ runtimeRegistry, validatorRegistry }) {
    this.runtimeRegistry = runtimeRegistry;
    this.validatorRegistry = validatorRegistry;
    this.runtimeInitialization = new WeakMap();
  }

  async initialize(language, options = {}) {
    const runtime = this.runtimeRegistry.resolve(language);
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

  async execute({ language, source, stdin, inputs, filename, signal }) {
    if (!this.runtimeRegistry.has(language)) {
      return {
        status: 'error',
        output: '',
        errors: [`No compiler runtime is registered for "${language}".`],
        executionTimeMs: 0,
      };
    }
    const runtime = await this.initialize(language, { signal });
    return runtime.execute({
      source,
      stdin: stdin ?? inputs ?? '',
      filename,
      signal,
    });
  }

  async format({ language, source, options }) {
    const runtime = await this.initialize(language);
    return runtime.format(source, options);
  }

  validateOutput({
    expectedOutput,
    programOutput,
    validatorType = 'normalized',
  }) {
    const validator = this.validatorRegistry.resolve(validatorType);
    if (!validator) throw new Error(`No output validator is registered for "${validatorType}".`);
    return validator.validate(expectedOutput, programOutput);
  }

  async reset(language) {
    if (language && this.runtimeRegistry.has(language)) {
      return this.runtimeRegistry.resolve(language).reset();
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
