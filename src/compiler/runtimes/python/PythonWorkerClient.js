import {
  PYTHON_EXECUTION_TIMEOUT_MS,
  PYTHON_INITIALIZATION_TIMEOUT_MS,
} from './pythonRuntimeConfig.js';
import {
  COMPILER_EXECUTION_EVENTS,
  INTERACTIVE_STDIN_BUFFER_BYTES,
  INTERACTIVE_STDIN_WAIT_TIMEOUT_MS,
  compilerExecutionEvent,
} from '../../core/interactiveStdinProtocol.js';

const CHANNEL_IDLE = 0;
const CHANNEL_WAITING = 1;
const CHANNEL_SUBMITTED = 2;

export class PythonWorkerClient {
  constructor({
    executionTimeoutMs = PYTHON_EXECUTION_TIMEOUT_MS,
    initializationTimeoutMs = PYTHON_INITIALIZATION_TIMEOUT_MS,
    workerFactory = () => new Worker(new URL('./python.worker.js', import.meta.url), {
      type: 'module',
      name: 'mi-tutora-python-runtime',
    }),
  } = {}) {
    this.worker = null;
    this.pending = new Map();
    this.requestId = 0;
    this.executionTimeoutMs = executionTimeoutMs;
    this.initializationTimeoutMs = initializationTimeoutMs;
    this.workerFactory = workerFactory;
    this.initializedWorker = null;
  }

  getWorker() {
    if (!this.worker) {
      this.worker = this.workerFactory();
      this.worker.addEventListener('message', ({ data }) => {
        const request = this.pending.get(data.id);
        if (!request) return;
        if (data.type === COMPILER_EXECUTION_EVENTS.STDOUT || data.type === COMPILER_EXECUTION_EVENTS.STDERR) {
          request.onExecutionEvent?.(compilerExecutionEvent(data.type, request.executionId, { value: String(data.value ?? '') }));
          return;
        }
        if (data.type === COMPILER_EXECUTION_EVENTS.STDIN_REQUEST) {
          request.pauseComputeTimeout();
          request.startInputTimeout();
          request.onExecutionEvent?.(compilerExecutionEvent(data.type, request.executionId));
          return;
        }
        this.pending.delete(data.id);
        request.cleanup();
        if (data.type === 'initialization-error') {
          request.reject(new Error(data.error));
        } else {
          request.resolve(data);
        }
      });
      this.worker.addEventListener('error', (event) => {
        this.rejectAll(new Error(event.message || 'The Python runtime worker failed.'));
        this.destroyWorker();
      });
    }
    return this.worker;
  }

  request(type, payload = {}, signal, timeoutMs) {
    if (signal?.aborted) {
      return Promise.reject(new DOMException('Execution cancelled.', 'AbortError'));
    }
    const worker = this.getWorker();
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      const stop = (error) => {
        cleanup();
        this.pending.delete(id);
        this.rejectAll(error);
        this.destroyWorker();
        reject(error);
      };
      const abort = () => stop(new DOMException('Execution cancelled.', 'AbortError'));
      let timeout = null;
      let inputTimeout = null;
      const startComputeTimeout = () => {
        if (!(timeoutMs > 0)) return;
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => stop(new Error(
          type === 'initialize'
            ? `Python initialization exceeded ${timeoutMs} ms.`
            : `Python execution exceeded ${timeoutMs} ms.`,
        )), timeoutMs);
      };
      const pauseComputeTimeout = () => { if (timeout) clearTimeout(timeout); timeout = null; };
      const startInputTimeout = () => {
        if (inputTimeout) clearTimeout(inputTimeout);
        inputTimeout = setTimeout(() => stop(new Error('Python input wait exceeded 90 seconds.')), INTERACTIVE_STDIN_WAIT_TIMEOUT_MS + 1_000);
      };
      const resumeComputeTimeout = () => {
        if (inputTimeout) clearTimeout(inputTimeout);
        inputTimeout = null;
        startComputeTimeout();
      };
      const cleanup = () => {
        if (timeout) clearTimeout(timeout);
        if (inputTimeout) clearTimeout(inputTimeout);
        signal?.removeEventListener('abort', abort);
      };
      signal?.addEventListener('abort', abort, { once: true });
      this.pending.set(id, { resolve, reject, cleanup, pauseComputeTimeout, startInputTimeout, resumeComputeTimeout });
      startComputeTimeout();
      worker.postMessage({ id, type, ...payload });
    });
  }

  async initialize(signal) {
    const worker = this.getWorker();
    if (this.initializedWorker === worker) return { type: 'initialized' };
    const result = await this.request('initialize', {}, signal, this.initializationTimeoutMs);
    if (this.worker === worker) this.initializedWorker = worker;
    return result;
  }

  execute({ source, stdin = '', filename = 'main.py', signal, timeoutMs, executionId, onExecutionEvent, projectFiles, entrypoint }) {
    const interactive = typeof onExecutionEvent === 'function'
      && typeof SharedArrayBuffer === 'function'
      && globalThis.crossOriginIsolated === true;
    const controlBuffer = interactive ? new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2) : null;
    const inputBuffer = interactive ? new SharedArrayBuffer(INTERACTIVE_STDIN_BUFFER_BYTES) : null;
    const id = this.requestId + 1;
    onExecutionEvent?.(compilerExecutionEvent(COMPILER_EXECUTION_EVENTS.START, executionId));
    const request = this.request('execute', {
      source,
      filename,
      executionId,
      interactive,
      controlBuffer,
      inputBuffer,
      inputWaitTimeoutMs: INTERACTIVE_STDIN_WAIT_TIMEOUT_MS,
      stdin: Array.isArray(stdin) ? stdin.join('\n') : String(stdin ?? ''),
      projectFiles,
      entrypoint,
    }, signal, timeoutMs ?? this.executionTimeoutMs);
    const pending = this.pending.get(id);
    if (pending) Object.assign(pending, { executionId: String(executionId ?? ''), onExecutionEvent, controlBuffer, inputBuffer });
    return request.then((result) => {
      onExecutionEvent?.(compilerExecutionEvent(COMPILER_EXECUTION_EVENTS.COMPLETE, executionId));
      if (!interactive && typeof onExecutionEvent === 'function' && /EOFError:\s*EOF when reading a line/.test(String(result.stderr ?? ''))) {
        const normalized = {
          ...result,
          stderr: 'Interactive input is unavailable in this browser session. Enter standard input before running your program.',
        };
        this.destroyWorker();
        return normalized;
      }
      this.destroyWorker();
      return result;
    }, (error) => {
      onExecutionEvent?.(compilerExecutionEvent(error?.name === 'AbortError' ? COMPILER_EXECUTION_EVENTS.CANCELLED : COMPILER_EXECUTION_EVENTS.ERROR, executionId));
      throw error;
    });
  }

  submitStdin({ executionId, value }) {
    const entry = [...this.pending.values()].find((request) => request.executionId === String(executionId ?? ''));
    if (!entry?.controlBuffer || !entry.inputBuffer) return false;
    const control = new Int32Array(entry.controlBuffer);
    if (Atomics.load(control, 0) !== CHANNEL_WAITING) return false;
    const bytes = new TextEncoder().encode(String(value ?? ''));
    if (bytes.byteLength > INTERACTIVE_STDIN_BUFFER_BYTES) throw new Error('Interactive input is too large.');
    new Uint8Array(entry.inputBuffer).fill(0);
    new Uint8Array(entry.inputBuffer).set(bytes);
    Atomics.store(control, 1, bytes.byteLength);
    Atomics.store(control, 0, CHANNEL_SUBMITTED);
    Atomics.notify(control, 0, 1);
    entry.resumeComputeTimeout?.();
    return true;
  }

  reset() {
    this.rejectAll(new DOMException('Runtime reset.', 'AbortError'));
    this.destroyWorker();
  }

  rejectAll(error) {
    for (const request of this.pending.values()) {
      request.cleanup();
      request.reject(error);
    }
    this.pending.clear();
  }

  destroyWorker() {
    this.worker?.terminate();
    this.worker = null;
    this.initializedWorker = null;
  }

  dispose() {
    this.rejectAll(new DOMException('Runtime disposed.', 'AbortError'));
    this.destroyWorker();
  }
}
