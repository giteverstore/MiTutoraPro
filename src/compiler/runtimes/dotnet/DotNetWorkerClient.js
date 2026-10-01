import {
  DOTNET_DEFAULT_TIMEOUT_MS,
  DOTNET_INITIALIZATION_TIMEOUT_MS,
} from './dotnetRuntimeConfig.js';
import { COMPILER_EXECUTION_EVENTS, INTERACTIVE_STDIN_WAIT_TIMEOUT_MS, compilerExecutionEvent } from '../../core/interactiveStdinProtocol.js';
import { createDotNetInputBuffers, submitDotNetInput } from './dotnetInteractiveChannel.js';

export class DotNetWorkerClient {
  constructor({
    timeoutMs = DOTNET_DEFAULT_TIMEOUT_MS,
    initializationTimeoutMs = DOTNET_INITIALIZATION_TIMEOUT_MS,
    workerFactory = () => new Worker(new URL('./dotnetRuntime.worker.js', import.meta.url), {
      type: 'module',
      name: 'ycoders-dotnet-runtime',
    }),
  } = {}) {
    this.timeoutMs = timeoutMs;
    this.initializationTimeoutMs = initializationTimeoutMs;
    this.workerFactory = workerFactory;
    this.worker = null;
    this.active = null;
    this.nextRequestId = 1;
  }

  async initialize() {}

  execute({ language, source, stdin = '', signal, timeoutMs = this.timeoutMs, executionId, onExecutionEvent }) {
    if (signal?.aborted) return Promise.reject(new DOMException('Execution cancelled.', 'AbortError'));
    if (this.active) this.cancelActive(new DOMException('Execution replaced by a newer run.', 'AbortError'));

    const worker = this.workerFactory();
    this.worker = worker;
    worker.addEventListener('message', this.handleMessage);
    worker.addEventListener('error', this.handleError);
    const id = this.nextRequestId++;
    const interactive = typeof onExecutionEvent === 'function'
      && typeof SharedArrayBuffer === 'function'
      && globalThis.crossOriginIsolated === true;
    const buffers = interactive ? createDotNetInputBuffers() : { controlBuffer: null, inputBuffer: null };
    onExecutionEvent?.(compilerExecutionEvent(COMPILER_EXECUTION_EVENTS.START, executionId));

    return new Promise((resolve, reject) => {
      const abort = () => this.cancelActive(new DOMException('Execution cancelled.', 'AbortError'));
      this.active = {
        id, language, resolve, reject, signal, abort, timer: null, inputTimer: null,
        executionId: String(executionId ?? ''), onExecutionEvent, ...buffers,
        computeTimeoutMs: timeoutMs,
      };
      signal?.addEventListener('abort', abort, { once: true });
      this.startInitializationTimeout();
      worker.postMessage({
        type: 'execute', id, language,
        source: String(source ?? ''), stdin: String(stdin ?? ''), timeoutMs,
        executionId, interactive, ...buffers,
      });
    });
  }

  handleMessage = ({ data }) => {
    if (!this.active || data.id !== this.active.id) return;
    if (data.type === 'initialized') {
      clearTimeout(this.active.timer);
      this.startComputeTimeout(data.timeoutMs ?? this.timeoutMs);
      return;
    }
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
    this.active.onExecutionEvent?.(compilerExecutionEvent(COMPILER_EXECUTION_EVENTS.ERROR, this.active.executionId));
    this.finish(this.active.reject, new Error(event.message || 'The .NET runtime worker failed.'));
  };

  startInitializationTimeout() {
    if (!this.active) return;
    clearTimeout(this.active.timer);
    if (!(this.initializationTimeoutMs > 0)) {
      this.startComputeTimeout(this.active.computeTimeoutMs);
      return;
    }
    this.active.timer = setTimeout(() => this.cancelActive(new Error('The .NET runtime failed to initialize.')), this.initializationTimeoutMs);
  }

  startComputeTimeout(timeoutMs = this.timeoutMs) {
    if (!this.active || !(timeoutMs > 0)) return;
    clearTimeout(this.active.timer);
    this.active.computeTimeoutMs = timeoutMs;
    this.active.timer = setTimeout(() => this.cancelActive(new Error(
      `${this.active?.language === 'visualbasic' ? 'Visual Basic' : 'C#'} execution exceeded ${timeoutMs} ms.`,
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
    this.active.inputTimer = setTimeout(() => this.cancelActive(new Error('.NET input wait exceeded 90 seconds.')), INTERACTIVE_STDIN_WAIT_TIMEOUT_MS + 1_000);
  }

  submitStdin({ executionId, value }) {
    const submitted = submitDotNetInput(this.active, executionId, value);
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
