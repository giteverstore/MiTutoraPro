import { PYODIDE_CDN_BASE } from './pythonRuntimeConfig.js';

let runtimePromise;

function getRuntime() {
  if (!runtimePromise) {
    runtimePromise = import(/* @vite-ignore */ `${PYODIDE_CDN_BASE}pyodide.mjs`)
      .then(({ loadPyodide }) => loadPyodide({
        indexURL: PYODIDE_CDN_BASE,
        packageBaseUrl: PYODIDE_CDN_BASE,
      }));
  }
  return runtimePromise;
}

const CAPTURE_SCRIPT = `
import io
import sys
import traceback

_stdout_buffer = io.StringIO()
_stderr_buffer = io.StringIO()
_stdin_buffer = io.StringIO(__mitutora_stdin)
_original_stdout, _original_stderr, _original_stdin = sys.stdout, sys.stderr, sys.stdin
_execution_status = "success"

try:
    sys.stdout = _stdout_buffer
    sys.stderr = _stderr_buffer
    sys.stdin = _stdin_buffer
    exec(compile(__mitutora_source, __mitutora_filename, "exec"), {"__name__": "__main__"})
except BaseException:
    _execution_status = "error"
    traceback.print_exc(file=_stderr_buffer)
finally:
    sys.stdout = _original_stdout
    sys.stderr = _original_stderr
    sys.stdin = _original_stdin

(_execution_status, _stdout_buffer.getvalue(), _stderr_buffer.getvalue())
`;

self.addEventListener('message', async ({ data }) => {
  const { id, type } = data;
  try {
    const pyodide = await getRuntime();
    if (type === 'initialize') {
      self.postMessage({ id, type: 'initialized' });
      return;
    }

    const { source, stdin, filename } = data;
    await pyodide.loadPackagesFromImports(source);
    pyodide.globals.set('__mitutora_source', source);
    pyodide.globals.set('__mitutora_stdin', stdin);
    pyodide.globals.set('__mitutora_filename', filename);
    const startedAt = performance.now();
    const proxy = await pyodide.runPythonAsync(CAPTURE_SCRIPT);
    const executionTimeMs = Math.max(1, Math.round(performance.now() - startedAt));
    const [status, stdout, stderr] = proxy.toJs();
    proxy.destroy();
    self.postMessage({ id, type: 'execution', status, stdout, stderr, executionTimeMs });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (type === 'initialize') {
      self.postMessage({ id, type: 'initialization-error', error: message });
    } else {
      self.postMessage({
        id,
        type: 'execution',
        status: 'error',
        stdout: '',
        stderr: message,
        executionTimeMs: 0,
      });
    }
  }
});
