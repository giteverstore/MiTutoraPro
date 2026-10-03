import { init, parse } from 'es-module-lexer';
import {
  CompilerResourceLimitError,
  createCompilerOutputBudget,
} from '../../core/compilerResourcePolicy.js';
import { createVirtualProjectFiles, safeVirtualPath } from '../shared/virtualProjectFiles.js';

function serialize(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'undefined') return 'undefined';
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
  try { return JSON.stringify(value); } catch { return String(value); }
}

export async function executeJavaScriptSource({ source, stdin = '', filename = 'main.js', projectFiles, entrypoint, requestInput, onStdout, onStderr }) {
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
    let resultingFiles;
    if (projectFiles?.length) {
      const virtualFiles = createVirtualProjectFiles(projectFiles);
      virtualFiles.writeFileSync(entrypoint ?? filename, source);
      const modules = new Map();
      const loadModule = async (path) => {
        const safe = safeVirtualPath(path);
        if (modules.has(safe)) return modules.get(safe).exports;
        const module = { exports: {} }; modules.set(safe, module);
        const localRequire = (specifier) => {
          if (specifier === 'fs' || specifier === 'node:fs') return virtualFiles;
          if (!specifier.startsWith('.')) throw new Error(`Module access is unavailable: ${specifier}`);
          const base = safe.split('/').slice(0, -1).join('/');
          let resolved = safeVirtualPath(specifier, base);
          if (!virtualFiles.existsSync(resolved) && virtualFiles.existsSync(`${resolved}.js`)) resolved += '.js';
          const child = { exports: {} };
          if (modules.has(resolved)) return modules.get(resolved).exports;
          modules.set(resolved, child);
          const childRunner = new Function('module', 'exports', 'require', 'console', 'readLine', 'readInput', `"use strict";\n${virtualFiles.readFileSync(resolved, 'utf8')}\n//# sourceURL=${resolved}`);
          childRunner(child, child.exports, localRequireFor(resolved), capturedConsole, readLine, readInput);
          return child.exports;
        };
        const localRequireFor = (modulePath) => (specifier) => {
          if (specifier === 'fs' || specifier === 'node:fs') return virtualFiles;
          const base = modulePath.split('/').slice(0, -1).join('/');
          let resolved = safeVirtualPath(specifier, base);
          if (!virtualFiles.existsSync(resolved) && virtualFiles.existsSync(`${resolved}.js`)) resolved += '.js';
          if (modules.has(resolved)) return modules.get(resolved).exports;
          const child = { exports: {} }; modules.set(resolved, child);
          new Function('module', 'exports', 'require', 'console', 'readLine', 'readInput', `"use strict";\n${virtualFiles.readFileSync(resolved, 'utf8')}\n//# sourceURL=${resolved}`)(child, child.exports, localRequireFor(resolved), capturedConsole, readLine, readInput);
          return child.exports;
        };
        new Function('module', 'exports', 'require', 'console', 'readLine', 'readInput', `"use strict";\n${virtualFiles.readFileSync(safe, 'utf8')}\n//# sourceURL=${safe}`)(module, module.exports, localRequire, capturedConsole, readLine, readInput);
        return module.exports;
      };
      await loadModule(entrypoint ?? filename);
      resultingFiles = virtualFiles.snapshot();
    } else {
      const runner = new Function('console', 'readLine', 'readInput', 'window', 'document', 'localStorage', 'sessionStorage', 'indexedDB', 'parent', 'top', 'opener', `"use strict";\n${source}\n//# sourceURL=${filename}`);
      await runner(capturedConsole, readLine, readInput, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
    }
    return { status: 'success', stdout: stdout.join('').replace(/\n$/, ''), stderr: stderr.join('').replace(/\n$/, ''), executionTimeMs: Math.max(1, Math.round(performance.now() - startedAt)), ...(resultingFiles ? { projectFiles: resultingFiles, filesystemSupported: true } : {}) };
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
