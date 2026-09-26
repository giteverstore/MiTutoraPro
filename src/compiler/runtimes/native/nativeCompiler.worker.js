import { createCompiler } from '@live-codes/clang-wasm';
import { normalizeNativeExecutionResult } from './nativeExecution.js';

const COMPILER_OPTIONS = Object.freeze({
  c: Object.freeze({ std: 'gnu17', fileName: 'main.c' }),
  cpp: Object.freeze({ std: 'gnu++17', fileName: 'main.cpp' }),
});
const compilers = new Map();

function compilerFor(language) {
  const options = COMPILER_OPTIONS[language];
  if (!options) throw new Error(`Unsupported native compiler language: ${language}`);
  if (!compilers.has(language)) {
    compilers.set(language, createCompiler(language, {
      baseUrl: new URL('/clang/', self.location.origin),
      std: options.std,
      fileName: options.fileName,
      compileArgs: ['-Wall', '-Wextra'],
    }));
  }
  return compilers.get(language);
}

self.addEventListener('message', async ({ data }) => {
  if (data.type === 'dispose') {
    const loaded = await Promise.allSettled(compilers.values());
    loaded.forEach(({ status, value }) => { if (status === 'fulfilled') value.dispose(); });
    compilers.clear();
    self.close();
    return;
  }
  if (data.type !== 'execute') return;

  try {
    const compiler = await compilerFor(data.language);
    const result = await compiler.run(String(data.source ?? ''), String(data.stdin ?? ''), {
      fileName: COMPILER_OPTIONS[data.language].fileName,
    });
    self.postMessage({ id: data.id, ...normalizeNativeExecutionResult(result, data.language) });
  } catch (error) {
    self.postMessage({
      id: data.id,
      type: 'execution',
      status: 'error',
      phase: 'runtime',
      output: '',
      stdout: '',
      stderr: '',
      errors: [`Native compiler runtime error: ${error?.message || String(error)}`],
      diagnostics: [],
      warnings: [],
      exitCode: null,
      compileTimeMs: 0,
      runtimeTimeMs: 0,
      executionTimeMs: 0,
    });
  }
});
