function serialize(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'undefined') return 'undefined';
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`;
  try { return JSON.stringify(value); } catch { return String(value); }
}

export async function executeJavaScriptSource({ source, stdin = '', filename = 'main.js' }) {
  const stdout = [];
  const stderr = [];
  const inputs = String(stdin ?? '').replace(/\r\n?/g, '\n').split('\n');
  let inputIndex = 0;
  const write = (target) => (...values) => target.push(values.map(serialize).join(' '));
  const capturedConsole = Object.freeze({
    log: write(stdout),
    info: write(stdout),
    warn: write(stderr),
    error: write(stderr),
  });
  const readLine = () => inputs[inputIndex++] ?? '';
  const readInput = () => String(stdin ?? '');
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
