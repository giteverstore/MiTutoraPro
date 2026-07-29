/**
 * Language runtime contract consumed by CompilerManager.
 * Runtime implementations remain independent from React and lesson data.
 */
export class RuntimeAdapter {
  async initialize(_options = {}) {}

  async execute(_request) {
    throw new Error('RuntimeAdapter.execute() must be implemented.');
  }

  async format(source) {
    return source;
  }

  async reset() {
    return {
      status: 'idle',
      output: '',
      errors: [],
      executionTimeMs: null,
    };
  }

  async dispose() {}
}
