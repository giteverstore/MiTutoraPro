import { COMPILER_EXECUTION_EVENTS, INTERACTIVE_STDIN_WAIT_TIMEOUT_MS, compilerExecutionEvent } from '../../core/interactiveStdinProtocol.js';
import { createNativeInputBuffers, submitNativeInput } from './nativeInteractiveChannel.js';

const DEFAULT_TIMEOUT_MS = 10_000;

export class NativeCompilerWorkerClient {
  constructor({ timeoutMs = DEFAULT_TIMEOUT_MS, workerFactory = () => new Worker(new URL('./nativeCompiler.worker.js', import.meta.url), { type: 'module', name: 'ycoders-native-compiler-runtime' }) } = {}) {
    this.timeoutMs = timeoutMs;
    this.workerFactory = workerFactory;
    this.worker = null;
    this.active = null;
    this.nextRequestId = 1;
  }

  async initialize() {}

  ensureWorker() {
    if (this.worker) return this.worker;
    this.worker = this.workerFactory();
    this.worker.addEventListener('message', this.handleMessage);
    this.worker.addEventListener('error', this.handleError);
    return this.worker;
  }

  handleMessage = ({ data }) => {
    if (!this.active || data.id !== this.active.id) return;
    if (data.type === COMPILER_EXECUTION_EVENTS.STDOUT || data.type === COMPILER_EXECUTION_EVENTS.STDERR) {
      this.active.onExecutionEvent?.(compilerExecutionEvent(data.type, this.active.executionId, { value: String(data.value ?? '') }));
      return;
    }
    if (data.type === COMPILER_EXECUTION_EVENTS.STDIN_REQUEST) {
      this.pauseComputeTimeout();
      this.startInputTimeout();
      this.active.onExecutionEvent?.(compilerExecutionEvent(data.type, this.active.executionId));
      return;
    }
    this.active.onExecutionEvent?.(compilerExecutionEvent(COMPILER_EXECUTION_EVENTS.COMPLETE, this.active.executionId));
    this.finish(this.active.resolve, data);
  };

  handleError = (event) => {
    if (!this.active) return;
    const error = new Error(event.message || 'The native compiler worker failed.');
    this.active.onExecutionEvent?.(compilerExecutionEvent(COMPILER_EXECUTION_EVENTS.ERROR, this.active.executionId));
    this.finish(this.active.reject, error);
    this.terminateWorker();
  };

  execute({ language, source, stdin = '', filename, signal, timeoutMs = this.timeoutMs, executionId, onExecutionEvent, projectFiles, entrypoint }) {
    if (signal?.aborted) return Promise.reject(new DOMException('Execution cancelled.', 'AbortError'));
    if (this.active) this.cancelActive(new DOMException('Execution replaced by a newer run.', 'AbortError'));
    const worker = this.ensureWorker();
    const id = this.nextRequestId++;
    const interactive = typeof onExecutionEvent === 'function' && typeof SharedArrayBuffer === 'function' && globalThis.crossOriginIsolated === true;
    const buffers = interactive ? createNativeInputBuffers() : { controlBuffer: null, inputBuffer: null };
    onExecutionEvent?.(compilerExecutionEvent(COMPILER_EXECUTION_EVENTS.START, executionId));

    return new Promise((resolve, reject) => {
      const abort = () => this.cancelActive(new DOMException('Execution cancelled.', 'AbortError'));
      this.active = {
        id, resolve, reject, signal, abort, timer: null, inputTimer: null,
        executionId: String(executionId ?? ''), onExecutionEvent, ...buffers,
        language,
      };
      signal?.addEventListener('abort', abort, { once: true });
      this.startComputeTimeout(timeoutMs);
      worker.postMessage({
        type: 'execute', id, language, source: String(source ?? ''), stdin: String(stdin ?? ''), fileName: filename,
        executionId, interactive, projectFiles, entrypoint, ...buffers,
      });
    });
  }

  startComputeTimeout(timeoutMs = this.timeoutMs) {
    if (!this.active || !(timeoutMs > 0)) return;
    clearTimeout(this.active.timer);
    this.active.computeTimeoutMs = timeoutMs;
    this.active.timer = setTimeout(() => this.cancelActive(new Error(
      `${this.active?.language === 'cpp' ? 'C++' : 'C'} execution exceeded ${timeoutMs} ms.`,
    )), timeoutMs);
  }

  pauseComputeTimeout() {
    if (!this.active) return;
    clearTimeout(this.active.timer);
    this.active.timer = null;
  }

  startInputTimeout() {
    if (!this.active) return;
    clearTimeout(this.active.inputTimer);
    this.active.inputTimer = setTimeout(() => this.cancelActive(new Error('Native input wait exceeded 90 seconds.')), INTERACTIVE_STDIN_WAIT_TIMEOUT_MS + 1_000);
  }

  submitStdin({ executionId, value }) {
    const submitted = submitNativeInput(this.active, executionId, value);
    if (submitted && this.active) {
      clearTimeout(this.active.inputTimer);
      this.active.inputTimer = null;
      this.startComputeTimeout(this.active.computeTimeoutMs);
    }
    return submitted;
  }

  finish(callback, value) {
    const active = this.active;
    if (!active) return;
    clearTimeout(active.timer);
    clearTimeout(active.inputTimer);
    active.signal?.removeEventListener('abort', active.abort);
    this.active = null;
    this.terminateWorker();
    callback(value);
  }

  cancelActive(reason) {
    if (!this.active) return;
    const active = this.active;
    active.onExecutionEvent?.(compilerExecutionEvent(
      reason?.name === 'AbortError' ? COMPILER_EXECUTION_EVENTS.CANCELLED : COMPILER_EXECUTION_EVENTS.ERROR,
      active.executionId,
    ));
    this.finish(active.reject, reason);
  }

  terminateWorker() {
    if (!this.worker) return;
    this.worker.removeEventListener('message', this.handleMessage);
    this.worker.removeEventListener('error', this.handleError);
    this.worker.terminate();
    this.worker = null;
  }

  reset() {
    if (this.active) this.cancelActive(new DOMException('Execution cancelled.', 'AbortError'));
    else this.terminateWorker();
  }

  dispose() { this.reset(); }
}
