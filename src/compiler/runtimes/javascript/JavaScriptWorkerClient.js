import {
  COMPILER_EXECUTION_EVENTS,
  INTERACTIVE_STDIN_BUFFER_BYTES,
  INTERACTIVE_STDIN_WAIT_TIMEOUT_MS,
  compilerExecutionEvent,
} from '../../core/interactiveStdinProtocol.js';

const DEFAULT_TIMEOUT_MS = 10_000;
const CHANNEL_WAITING = 1;
const CHANNEL_SUBMITTED = 2;

export class JavaScriptWorkerClient {
  constructor({
    timeoutMs = DEFAULT_TIMEOUT_MS,
    workerFactory = () => new Worker(new URL('./javascript.worker.js', import.meta.url), {
      type: 'module',
      name: 'ycoders-javascript-runtime',
    }),
  } = {}) {
    this.timeoutMs = timeoutMs;
    this.workerFactory = workerFactory;
    this.active = null;
  }

  async initialize() {}

  execute({ source, stdin = '', filename = 'main.js', signal, timeoutMs = this.timeoutMs, executionId, onExecutionEvent, projectFiles, entrypoint }) {
    if (signal?.aborted) return Promise.reject(new DOMException('Execution cancelled.', 'AbortError'));
    this.reset();
    const worker = this.workerFactory();
    const interactive = typeof onExecutionEvent === 'function'
      && typeof SharedArrayBuffer === 'function'
      && globalThis.crossOriginIsolated === true;
    const controlBuffer = interactive ? new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 2) : null;
    const inputBuffer = interactive ? new SharedArrayBuffer(INTERACTIVE_STDIN_BUFFER_BYTES) : null;
    const id = 1;
    onExecutionEvent?.(compilerExecutionEvent(COMPILER_EXECUTION_EVENTS.START, executionId));
    return new Promise((resolve, reject) => {
      let settled = false;
      let computeTimer = null;
      let inputTimer = null;
      const clearTimers = () => { if (computeTimer) clearTimeout(computeTimer); if (inputTimer) clearTimeout(inputTimer); computeTimer = null; inputTimer = null; };
      const startComputeTimer = () => {
        if (!(timeoutMs > 0)) return;
        computeTimer = setTimeout(() => finish(reject, new Error(`JavaScript execution exceeded ${timeoutMs} ms.`)), timeoutMs);
      };
      const cleanup = () => {
        if (settled) return;
        settled = true;
        clearTimers();
        signal?.removeEventListener('abort', abort);
        worker.terminate();
        if (this.active?.worker === worker) this.active = null;
      };
      const finish = (callback, value) => { cleanup(); callback(value); };
      const abort = () => {
        onExecutionEvent?.(compilerExecutionEvent(COMPILER_EXECUTION_EVENTS.CANCELLED, executionId));
        finish(reject, new DOMException('Execution cancelled.', 'AbortError'));
      };
      worker.addEventListener('message', ({ data }) => {
        if (data.id !== id) return;
        if (data.type === 'stdout' || data.type === 'stderr') {
          onExecutionEvent?.(compilerExecutionEvent(data.type, executionId, { value: String(data.value ?? '') }));
          return;
        }
        if (data.type === 'stdin-request') {
          if (computeTimer) clearTimeout(computeTimer);
          computeTimer = null;
          inputTimer = setTimeout(() => finish(reject, new Error('JavaScript input wait exceeded 90 seconds.')), INTERACTIVE_STDIN_WAIT_TIMEOUT_MS + 1_000);
          onExecutionEvent?.(compilerExecutionEvent(COMPILER_EXECUTION_EVENTS.STDIN_REQUEST, executionId));
          return;
        }
        onExecutionEvent?.(compilerExecutionEvent(COMPILER_EXECUTION_EVENTS.COMPLETE, executionId));
        finish(resolve, data);
      });
      worker.addEventListener('error', (event) => finish(reject, new Error(event.message || 'The JavaScript runtime worker failed.')), { once: true });
      signal?.addEventListener('abort', abort, { once: true });
      this.active = { worker, executionId: String(executionId ?? ''), controlBuffer, inputBuffer, cancel: abort, resume: () => { clearTimers(); startComputeTimer(); } };
      startComputeTimer();
      worker.postMessage({ id, type: 'execute', source, stdin: Array.isArray(stdin) ? stdin.join('\n') : String(stdin ?? ''), filename, projectFiles, entrypoint, executionId, interactive, controlBuffer, inputBuffer, inputWaitTimeoutMs: INTERACTIVE_STDIN_WAIT_TIMEOUT_MS });
    });
  }

  submitStdin({ executionId, value }) {
    const entry = this.active;
    if (!entry?.controlBuffer || entry.executionId !== String(executionId ?? '')) return false;
    const control = new Int32Array(entry.controlBuffer);
    if (Atomics.load(control, 0) !== CHANNEL_WAITING) return false;
    const bytes = new TextEncoder().encode(String(value ?? ''));
    if (bytes.byteLength > INTERACTIVE_STDIN_BUFFER_BYTES) throw new Error('Interactive input is too large.');
    new Uint8Array(entry.inputBuffer).fill(0);
    new Uint8Array(entry.inputBuffer).set(bytes);
    Atomics.store(control, 1, bytes.byteLength);
    Atomics.store(control, 0, CHANNEL_SUBMITTED);
    Atomics.notify(control, 0, 1);
    entry.resume();
    return true;
  }

  reset() {
    if (!this.active) return;
    this.active.cancel();
  }

  dispose() { this.reset(); }
}
