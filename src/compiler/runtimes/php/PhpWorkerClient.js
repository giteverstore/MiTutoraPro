import { PHP_EXECUTION_TIMEOUT_MS } from './phpRuntimeConfig.js';
import { COMPILER_EXECUTION_EVENTS, INTERACTIVE_STDIN_WAIT_TIMEOUT_MS, compilerExecutionEvent } from '../../core/interactiveStdinProtocol.js';
import { createPhpInputBuffers, submitPhpInput } from './phpInteractiveChannel.js';

export class PhpWorkerClient {
  constructor({
    timeoutMs = PHP_EXECUTION_TIMEOUT_MS,
    workerFactory = () => new Worker(new URL('./php.worker.js', import.meta.url), {
      type: 'module',
      name: 'ycoders-php-runtime',
    }),
  } = {}) {
    this.timeoutMs = timeoutMs;
    this.workerFactory = workerFactory;
    this.activeWorker = null;
    this.active = null;
    this.nextRequestId = 1;
  }

  async initialize() {}

  execute({ source, stdin = '', filename = 'main.php', signal, timeoutMs = this.timeoutMs, executionId, onExecutionEvent }) {
    if (signal?.aborted) {
      return Promise.reject(new DOMException('Execution cancelled.', 'AbortError'));
    }

    this.reset();
    const worker = this.workerFactory();
    this.activeWorker = worker;
    const id = this.nextRequestId++;
    const interactive = typeof onExecutionEvent === 'function'
      && typeof SharedArrayBuffer === 'function'
      && globalThis.crossOriginIsolated === true;
    const buffers = interactive ? createPhpInputBuffers() : { controlBuffer: null, inputBuffer: null };
    onExecutionEvent?.(compilerExecutionEvent(COMPILER_EXECUTION_EVENTS.START, executionId));

    return new Promise((resolve, reject) => {
      const abort = () => this.cancel(new DOMException('Execution cancelled.', 'AbortError'));
      this.active = {
        id, worker, resolve, reject, signal, abort, timer: null, inputTimer: null,
        executionId: String(executionId ?? ''), onExecutionEvent, computeTimeoutMs: timeoutMs,
        ...buffers,
      };
      worker.addEventListener('message', this.handleMessage);
      worker.addEventListener('error', this.handleError);
      signal?.addEventListener('abort', abort, { once: true });
      this.startComputeTimeout(timeoutMs);
      worker.postMessage({
        type: 'execute', id,
        source: String(source ?? ''),
        stdin: Array.isArray(stdin) ? stdin.join('\n') : String(stdin ?? ''),
        filename, timeoutMs, executionId, interactive, ...buffers,
      });
    });
  }

  handleMessage = ({ data }) => {
    if (!this.active || data.id !== this.active.id) return;
    if (data.type === 'initialized') return;
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
    this.finish(this.active.reject, new Error(event.message || 'The PHP runtime worker failed.'));
  };

  startComputeTimeout(timeoutMs = this.timeoutMs) {
    if (!this.active || !(timeoutMs > 0)) return;
    clearTimeout(this.active.timer);
    this.active.computeTimeoutMs = timeoutMs;
    this.active.timer = setTimeout(() => this.cancel(new Error(`PHP execution exceeded ${timeoutMs} ms.`)), timeoutMs);
  }

  pauseComputeTimeout() {
    if (!this.active) return;
    clearTimeout(this.active.timer);
    this.active.timer = null;
  }

  startInputTimeout() {
    if (!this.active) return;
    clearTimeout(this.active.inputTimer);
    this.active.inputTimer = setTimeout(() => this.cancel(new Error('PHP input wait exceeded 90 seconds.')), INTERACTIVE_STDIN_WAIT_TIMEOUT_MS + 1_000);
  }

  submitStdin({ executionId, value }) {
    const submitted = submitPhpInput(this.active, executionId, value);
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
    active.worker.removeEventListener?.('message', this.handleMessage);
    active.worker.removeEventListener?.('error', this.handleError);
    active.worker.terminate();
    this.active = null;
    if (this.activeWorker === active.worker) this.activeWorker = null;
    callback(value);
  }

  cancel(reason) {
    if (!this.active) return;
    const active = this.active;
    active.onExecutionEvent?.(compilerExecutionEvent(
      reason?.name === 'AbortError' ? COMPILER_EXECUTION_EVENTS.CANCELLED : COMPILER_EXECUTION_EVENTS.ERROR,
      active.executionId,
    ));
    this.finish(active.reject, reason);
  }

  reset() {
    if (this.active) {
      this.cancel(new DOMException('Execution cancelled.', 'AbortError'));
      return;
    }
    this.activeWorker?.terminate();
    this.activeWorker = null;
  }

  dispose() {
    this.reset();
  }
}
