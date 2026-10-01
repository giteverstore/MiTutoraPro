import { CLANG_DRIVER_DEFAULT_ARGS, compilerDiagnostics, createToolchain } from '@live-codes/clang-wasm/toolchain';
import { COMPILER_EXECUTION_EVENTS } from '../../core/interactiveStdinProtocol.js';
import { createNativeInputQueue } from './nativeInteractiveChannel.js';
import { normalizeNativeExecutionResult } from './nativeExecution.js';

const OPTIONS = Object.freeze({
  c: Object.freeze({ std: 'gnu17', fileName: 'main.c', compilerLanguage: 'C' }),
  cpp: Object.freeze({ std: 'gnu++17', fileName: 'main.cpp', compilerLanguage: 'CPP' }),
});
const toolchains = new Map();

async function toolchainFor(language) {
  if (!OPTIONS[language]) throw new Error(`Unsupported native compiler language: ${language}`);
  if (!toolchains.has(language)) {
    toolchains.set(language, createToolchain({ baseUrl: new URL('/clang/', self.location.origin) }));
  }
  return toolchains.get(language);
}

const cleanOutput = (value) => String(value ?? '').replace(/\u001b\[[0-9;]*[A-Za-z]/g, '');

async function compileAndRun(data) {
  const options = OPTIONS[data.language];
  const toolchain = await toolchainFor(data.language);
  return toolchain.lock(async () => {
    const compileStarted = performance.now();
    const compiled = await toolchain.captureCompilerOutput(() => toolchain.runtime.compileArtifact(String(data.source ?? ''), {
      language: options.compilerLanguage,
      fileName: options.fileName,
      compileArgs: [...CLANG_DRIVER_DEFAULT_ARGS, `-std=${options.std}`, '-Wall', '-Wextra'],
    }));
    const compileMs = Math.round(performance.now() - compileStarted);
    if (compiled.error) {
      const errors = compilerDiagnostics(compiled.raw);
      if (!errors.length) errors.push(String(compiled.error?.message ?? compiled.error));
      return normalizeNativeExecutionResult({ stdout: '', stderr: '', output: '', errors, exitCode: null, compileMs, runMs: null }, data.language);
    }

    const stdin = createNativeInputQueue({
      ...data,
      onRequest: (executionId) => self.postMessage({ id: data.id, type: COMPILER_EXECUTION_EVENTS.STDIN_REQUEST, executionId }),
    });
    const stdout = [];
    const stderr = [];
    const ordered = [];
    const runStarted = performance.now();
    const result = await toolchain.execute(compiled.result, {
      stdin,
      stdout: (chunk) => {
        const value = cleanOutput(chunk);
        stdout.push(value); ordered.push(value);
        self.postMessage({ id: data.id, type: COMPILER_EXECUTION_EVENTS.STDOUT, value });
      },
      stderr: (chunk) => {
        const value = cleanOutput(chunk);
        stderr.push(value); ordered.push(value);
        self.postMessage({ id: data.id, type: COMPILER_EXECUTION_EVENTS.STDERR, value });
      },
    });
    const runMs = Math.round(performance.now() - runStarted);
    return normalizeNativeExecutionResult({
      stdout: stdout.join(''), stderr: stderr.join(''), output: ordered.join(''), errors: [],
      exitCode: result.exitCode, compileMs, runMs,
    }, data.language);
  });
}

self.addEventListener('message', async ({ data }) => {
  if (data.type === 'dispose') {
    const loaded = await Promise.allSettled(toolchains.values());
    loaded.forEach(({ status, value }) => { if (status === 'fulfilled') value.dispose(); });
    toolchains.clear();
    self.close();
    return;
  }
  if (data.type !== 'execute') return;
  try {
    self.postMessage({ id: data.id, ...await compileAndRun(data) });
  } catch (error) {
    self.postMessage({
      id: data.id, type: 'execution', status: 'error', phase: 'runtime', output: '', stdout: '', stderr: '',
      errors: [`Native compiler runtime error: ${error?.message || String(error)}`], diagnostics: [], warnings: [],
      exitCode: null, compileTimeMs: 0, runtimeTimeMs: 0, executionTimeMs: 0,
    });
  }
});
