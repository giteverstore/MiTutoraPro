function serialize(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'undefined') return 'undefined';
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
  try { return JSON.stringify(value); } catch { return String(value); }
}

export async function executeJavaScriptSource({ source, stdin = '', filename = 'main.js', requestInput, onStdout, onStderr }) {
  const stdout = [];
  const stderr = [];
  const buffered = String(stdin ?? '').replace(/\r\n?/g, '\n');
  const inputs = buffered ? buffered.split('\n') : [];
  let inputIndex = 0;
  const write = (target, emit) => (...values) => {
    const line = values.map(serialize).join(' ');
    target.push(line);
    emit?.(`${line}\n`);
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
    const runner = new Function(
      'console', 'readLine', 'readInput',
      'window', 'document', 'localStorage', 'sessionStorage', 'indexedDB', 'parent', 'top', 'opener',
      `"use strict";\n${source}\n//# sourceURL=${filename}`,
    );
    await runner(capturedConsole, readLine, readInput, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined);
    return { status: 'success', stdout: stdout.join('\n'), stderr: stderr.join('\n'), executionTimeMs: Math.max(1, Math.round(performance.now() - startedAt)) };
  } catch (error) {
    const detail = error?.stack || error?.message || String(error);
    stderr.push(detail);
    return { status: 'error', stdout: stdout.join('\n'), stderr: stderr.join('\n'), executionTimeMs: Math.max(1, Math.round(performance.now() - startedAt)) };
  }
}
