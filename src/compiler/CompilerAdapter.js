/**
 * Contract for compiler implementations.
 *
 * Adapters must resolve execution requests into a normalized result so the UI
 * never depends on a specific compiler service or transport.
 *
 * execute request:
 * { source: string, language: string, signal?: AbortSignal }
 *
 * execute result:
 * {
 *   status: 'success' | 'error',
 *   output: string,
 *   errors: string[],
 *   executionTimeMs: number
 * }
 */
export class CompilerAdapter {
  async execute(_request) {
    throw new Error('CompilerAdapter.execute() must be implemented.');
  }

  async reset() {
    return undefined;
  }
}
