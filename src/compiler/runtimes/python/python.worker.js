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

class _YCodersOutput(io.TextIOBase):
    def __init__(self, writer):
        self.writer = writer
    def write(self, value):
        text = str(value)
        self.writer(text)
        return len(text)
    def flush(self):
        return None

class _YCodersInput(io.TextIOBase):
    def readline(self, size=-1):
        value = _mitutora_readline()
        return value if size is None or size < 0 else value[:size]
    def readable(self):
        return True

_stdout_buffer = []
_stderr_buffer = []
_stdout_stream = _YCodersOutput(lambda value: (__mitutora_stdout(value), _stdout_buffer.append(value)))
_stderr_stream = _YCodersOutput(lambda value: (__mitutora_stderr(value), _stderr_buffer.append(value)))
_stdin_stream = _YCodersInput()
_original_stdout, _original_stderr, _original_stdin = sys.stdout, sys.stderr, sys.stdin
_execution_status = "success"

try:
    sys.stdout = _stdout_stream
    sys.stderr = _stderr_stream
    sys.stdin = _stdin_stream
    exec(compile(__mitutora_source, __mitutora_filename, "exec"), {"__name__": "__main__"})
except BaseException:
    _execution_status = "error"
    traceback.print_exc(file=_stderr_stream)
finally:
    sys.stdout = _original_stdout
    sys.stderr = _original_stderr
    sys.stdin = _original_stdin

(_execution_status, "".join(_stdout_buffer), "".join(_stderr_buffer))
`;

function createStdinReader(data) {
  const buffered = String(data.stdin ?? '').replace(/\r\n?/g, '\n');
  let offset = 0;
  const control = data.interactive ? new Int32Array(data.controlBuffer) : null;
  const input = data.interactive ? new Uint8Array(data.inputBuffer) : null;
  const decoder = new TextDecoder();
  return () => {
    if (offset < buffered.length) {
      const newline = buffered.indexOf('\n', offset);
      const end = newline < 0 ? buffered.length : newline + 1;
      const value = buffered.slice(offset, end);
      offset = end;
      return value;
    }
    if (!control || !input) return '';
    Atomics.store(control, 1, 0);
    Atomics.store(control, 0, 1);
    self.postMessage({ id: data.id, type: 'stdin-request', executionId: data.executionId });
    const state = Atomics.wait(control, 0, 1, data.inputWaitTimeoutMs);
    if (state === 'timed-out') throw new Error('Interactive input wait timed out.');
    const length = Atomics.load(control, 1);
    const value = decoder.decode(input.slice(0, length));
    Atomics.store(control, 0, 0);
    return value;
  };
}

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
    pyodide.globals.set('__mitutora_filename', filename);
    pyodide.globals.set('_mitutora_readline', createStdinReader(data));
    pyodide.globals.set('__mitutora_stdout', (value) => self.postMessage({ id, type: 'stdout', value }));
    pyodide.globals.set('__mitutora_stderr', (value) => self.postMessage({ id, type: 'stderr', value }));
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
