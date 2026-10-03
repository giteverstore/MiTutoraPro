import { PYODIDE_CDN_BASE } from './pythonRuntimeConfig.js';

let runtimePromise;
const sendToHost = self.postMessage.bind(self);

const BLOCKED_PYTHON_IMPORTS = Object.freeze([
  'js',
  'micropip',
  'pyodide',
  '_pyodide',
  'socket',
  'http.client',
  'http.server',
  'urllib.request',
]);

const HOST_CAPABILITIES = Object.freeze([
  'postMessage',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'indexedDB',
  'caches',
  'BroadcastChannel',
  'Worker',
  'SharedWorker',
  'importScripts',
]);

function disableHostCapability(name) {
  try {
    Object.defineProperty(self, name, {
      configurable: false,
      enumerable: false,
      value: undefined,
      writable: false,
    });
  } catch {
    try { self[name] = undefined; } catch { /* Best effort for non-configurable browser globals. */ }
  }
}

function lockDownHostCapabilities() {
  HOST_CAPABILITIES.forEach(disableHostCapability);
}

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
import builtins
import sys
import traceback

_blocked_imports = ${JSON.stringify(BLOCKED_PYTHON_IMPORTS)}
_original_import = builtins.__import__

def _is_blocked_import(name):
    return any(name == blocked or name.startswith(blocked + ".") for blocked in _blocked_imports)

def _restricted_import(name, globals=None, locals=None, fromlist=(), level=0):
    if _is_blocked_import(name):
        raise ImportError(f"Import of '{name}' is disabled by the YCoders Python runtime policy.")
    if name == "urllib" and any(item == "request" for item in (fromlist or ())):
        raise ImportError("Import of 'urllib.request' is disabled by the YCoders Python runtime policy.")
    if name == "http" and any(item in ("client", "server") for item in (fromlist or ())):
        raise ImportError("Network-capable http modules are disabled by the YCoders Python runtime policy.")
    return _original_import(name, globals, locals, fromlist, level)

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
    for _module_name in tuple(sys.modules):
        if _is_blocked_import(_module_name):
            sys.modules.pop(_module_name, None)
    builtins.__import__ = _restricted_import
    sys.stdout = _stdout_stream
    sys.stderr = _stderr_stream
    sys.stdin = _stdin_stream
    exec(compile(__mitutora_source, __mitutora_filename, "exec"), {"__name__": "__main__"})
except BaseException:
    _execution_status = "error"
    traceback.print_exc(file=_stderr_stream)
finally:
    builtins.__import__ = _original_import
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
    sendToHost({ id: data.id, type: 'stdin-request', executionId: data.executionId });
    const state = Atomics.wait(control, 0, 1, data.inputWaitTimeoutMs);
    if (state === 'timed-out') throw new Error('Interactive input wait timed out.');
    const length = Atomics.load(control, 1);
    const value = decoder.decode(input.slice(0, length));
    Atomics.store(control, 0, 0);
    return value;
  };
}

const PROJECT_ROOT = '/project';

function clearDirectory(FS, path) {
  if (!FS.analyzePath(path).exists) return;
  for (const name of FS.readdir(path)) {
    if (name === '.' || name === '..') continue;
    const child = `${path}/${name}`;
    if (FS.isDir(FS.stat(child).mode)) { clearDirectory(FS, child); FS.rmdir(child); }
    else FS.unlink(child);
  }
}

function mountProjectFiles(pyodide, files = []) {
  const { FS } = pyodide;
  if (!FS.analyzePath(PROJECT_ROOT).exists) FS.mkdir(PROJECT_ROOT);
  clearDirectory(FS, PROJECT_ROOT);
  for (const file of files) {
    const path = String(file.path ?? '').replaceAll('\\', '/');
    if (!path || path.startsWith('/') || path.split('/').some((part) => !part || part === '.' || part === '..')) throw new Error('Unsafe project filesystem path.');
    const segments = path.split('/');
    let directory = PROJECT_ROOT;
    for (const segment of segments.slice(0, -1)) {
      directory += `/${segment}`;
      if (!FS.analyzePath(directory).exists) FS.mkdir(directory);
    }
    FS.writeFile(`${PROJECT_ROOT}/${path}`, String(file.content ?? ''), { encoding: 'utf8' });
  }
  FS.chdir(PROJECT_ROOT);
}

function snapshotProjectFiles(pyodide) {
  const { FS } = pyodide;
  const result = [];
  const visit = (directory, prefix = '') => {
    for (const name of FS.readdir(directory)) {
      if (name === '.' || name === '..') continue;
      const absolute = `${directory}/${name}`;
      const path = prefix ? `${prefix}/${name}` : name;
      if (FS.isDir(FS.stat(absolute).mode)) visit(absolute, path);
      else result.push({ path, content: FS.readFile(absolute, { encoding: 'utf8' }), type: 'file', encoding: 'utf-8' });
    }
  };
  visit(PROJECT_ROOT);
  return result;
}

self.addEventListener('message', async ({ data }) => {
  const { id, type } = data;
  try {
    const pyodide = await getRuntime();
    if (type === 'initialize') {
      lockDownHostCapabilities();
      sendToHost({ id, type: 'initialized' });
      return;
    }

    const { source, stdin, filename } = data;
    if (data.projectFiles?.length) mountProjectFiles(pyodide, data.projectFiles);
    pyodide.globals.set('__mitutora_source', source);
    pyodide.globals.set('__mitutora_filename', filename);
    pyodide.globals.set('_mitutora_readline', createStdinReader(data));
    pyodide.globals.set('__mitutora_stdout', (value) => sendToHost({ id, type: 'stdout', value }));
    pyodide.globals.set('__mitutora_stderr', (value) => sendToHost({ id, type: 'stderr', value }));
    const startedAt = performance.now();
    const proxy = await pyodide.runPythonAsync(CAPTURE_SCRIPT);
    const executionTimeMs = Math.max(1, Math.round(performance.now() - startedAt));
    const [status, stdout, stderr] = proxy.toJs();
    proxy.destroy();
    sendToHost({ id, type: 'execution', status, stdout, stderr, executionTimeMs, ...(data.projectFiles?.length ? { projectFiles: snapshotProjectFiles(pyodide), filesystemSupported: true } : {}) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (type === 'initialize') {
      sendToHost({ id, type: 'initialization-error', error: message });
    } else {
      sendToHost({
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
