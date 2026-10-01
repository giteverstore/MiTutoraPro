import { init, parse } from 'es-module-lexer';
import {
  CompilerResourceLimitError,
  createCompilerOutputBudget,
} from '../../core/compilerResourcePolicy.js';

function serialize(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'undefined') return 'undefined';
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
  try { return JSON.stringify(value); } catch { return String(value); }
}

export async function executeJavaScriptSource({ source, stdin = '', filename = 'main.js', requestInput, onStdout, onStderr }) {
  const stdout = [];
  const stderr = [];
  let resourceError = null;
  const outputBudget = createCompilerOutputBudget({ onLimit: (error) => { resourceError = error; } });
  const buffered = String(stdin ?? '').replace(/\r\n?/g, '\n');
  const inputs = buffered ? buffered.split('\n') : [];
  let inputIndex = 0;
  const write = (target, emit) => (...values) => {
    const line = values.map(serialize).join(' ');
    const stream = target === stderr ? 'stderr' : 'stdout';
    const accepted = outputBudget.accept(stream, `${line}\n`);
    if (accepted) { target.push(accepted); emit?.(accepted); }
    if (resourceError) throw resourceError;
  };
  const capturedConsole = Object.freeze({
    log: write(stdout, onStdout),
    info: write(stdout, onStdout),
    warn: write(stderr, onStderr),
    error: write(stderr, onStderr),
  });
  const readLine = () => inputIndex < inputs.length ? inputs[inputIndex++] : requestInput?.() ?? '';
  const readInput = () => {
    if (inputIndex >= inputs.length) return requestInput?.() ?? '';
    const remaining = inputs.slice(inputIndex).join('\n');
    inputIndex = inputs.length;
    return remaining;
  };
  const startedAt = performance.now();

  try {
    await init;
    const [imports] = parse(source);
    if (imports.some(({ d }) => d >= 0)) {
      throw new Error('Network access is unavailable in this compiler.');
    }
    const runner = new Function(
      'console', 'readLine', 'readInput',
      'window', 'document', 'localStorage', 'sessionStorage', 'indexedDB', 'parent', 'top', 'opener',
      `"use strict";\n${source}\n//# sourceURL=${filename}`,
    );
    await runner(capturedConsole, readLine, readInput, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
    return { status: 'success', stdout: stdout.join('').replace(/\n$/, ''), stderr: stderr.join('').replace(/\n$/, ''), executionTimeMs: Math.max(1, Math.round(performance.now() - startedAt)) };
  } catch (error) {
    if (error instanceof CompilerResourceLimitError) {
      return {
        status: 'error', code: error.code, stdout: stdout.join('').replace(/\n$/, ''), stderr: stderr.join('').replace(/\n$/, ''),
        errors: [error.message], truncated: true,
        executionTimeMs: Math.max(1, Math.round(performance.now() - startedAt)),
      };
    }
    const raw = error?.stack || error?.message || String(error);
    const detail = /dynamically imported module|failed to fetch|importing a module script failed/i.test(raw)
      ? 'Network access is unavailable in this compiler.'
      : raw;
    const accepted = outputBudget.accept('stderr', detail);
    if (accepted) stderr.push(accepted);
    return { status: 'error', stdout: stdout.join('').replace(/\n$/, ''), stderr: stderr.join('').replace(/\n$/, ''), executionTimeMs: Math.max(1, Math.round(performance.now() - startedAt)) };
  }
}
