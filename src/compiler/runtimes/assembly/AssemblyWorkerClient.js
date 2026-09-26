import {
  ASSEMBLY_DEFAULT_TIMEOUT_MS,
  ASSEMBLY_INITIALIZATION_TIMEOUT_MS,
  ASSEMBLY_INSTRUCTION_LIMIT,
} from './assemblyRuntimeConfig.js';

export class AssemblyWorkerClient {
  constructor({
    timeoutMs = ASSEMBLY_DEFAULT_TIMEOUT_MS,
    initializationTimeoutMs = ASSEMBLY_INITIALIZATION_TIMEOUT_MS,
    instructionLimit = ASSEMBLY_INSTRUCTION_LIMIT,
    workerFactory = () => new Worker(new URL('./assemblyRuntime.worker.js', import.meta.url), {
      type: 'module',
      name: 'ycoders-x86-64-runtime',
    }),
  } = {}) {
    this.timeoutMs = timeoutMs;
    this.initializationTimeoutMs = initializationTimeoutMs;
    this.instructionLimit = instructionLimit;
    this.workerFactory = workerFactory;
    this.worker = null;
    this.active = null;
    this.nextRequestId = 1;
  }

  async initialize() {}

  execute({ source, signal, timeoutMs = this.timeoutMs }) {
    if (signal?.aborted) return Promise.reject(new DOMException('Execution cancelled.', 'AbortError'));
    if (this.active) this.cancelActive(new DOMException('Execution replaced by a newer run.', 'AbortError'));

    const worker = this.workerFactory();
    this.worker = worker;
    worker.addEventListener('message', this.handleMessage);
    worker.addEventListener('error', this.handleError);
    const id = this.nextRequestId++;

    return new Promise((resolve, reject) => {
      const abort = () => this.cancelActive(new DOMException('Execution cancelled.', 'AbortError'));
      const timer = setTimeout(() => {
        this.cancelActive(new Error(`Assembly execution exceeded ${timeoutMs} ms.`));
      }, this.initializationTimeoutMs + Math.max(0, timeoutMs));
      this.active = { id, resolve, reject, signal, abort, timer, timeoutMs };
      signal?.addEventListener('abort', abort, { once: true });
      worker.postMessage({
        type: 'execute', id, source: String(source ?? ''), timeoutMs,
        instructionLimit: this.instructionLimit,
      });
    });
  }

  handleMessage = ({ data }) => {
    if (!this.active || data.id !== this.active.id) return;
    if (data.type === 'initialized') {
      clearTimeout(this.active.timer);
      this.active.timer = setTimeout(() => {
        this.cancelActive(new Error(`Assembly execution exceeded ${this.active.timeoutMs} ms.`));
      }, this.active.timeoutMs);
      return;
    }
    this.finish(this.active.resolve, data);
  };

  handleError = (event) => {
    if (!this.active) return;
    this.finish(this.active.reject, new Error(event.message || 'The Assembly emulator worker failed.'));
  };

  finish(callback, value) {
    const active = this.active;
    if (!active) return;
    clearTimeout(active.timer);
    active.signal?.removeEventListener('abort', active.abort);
    this.active = null;
    this.terminateWorker();
    callback(value);
  }

  cancelActive(reason) {
    if (!this.active) return;
    const active = this.active;
    clearTimeout(active.timer);
    active.signal?.removeEventListener('abort', active.abort);
    this.active = null;
    this.terminateWorker();
    active.reject(reason);
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
