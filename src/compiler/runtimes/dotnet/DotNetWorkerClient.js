import {
  DOTNET_DEFAULT_TIMEOUT_MS,
  DOTNET_INITIALIZATION_TIMEOUT_MS,
} from './dotnetRuntimeConfig.js';

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

  execute({ language, source, stdin = '', signal, timeoutMs = this.timeoutMs }) {
    if (signal?.aborted) return Promise.reject(new DOMException('Execution cancelled.', 'AbortError'));
    if (this.active) this.cancelActive(new DOMException('Execution replaced by a newer run.', 'AbortError'));

    const worker = this.workerFactory();
    this.worker = worker;
    worker.addEventListener('message', this.handleMessage);
    worker.addEventListener('error', this.handleError);
    const id = this.nextRequestId++;

    return new Promise((resolve, reject) => {
      const abort = () => this.cancelActive(new DOMException('Execution cancelled.', 'AbortError'));
      const deadline = this.initializationTimeoutMs + Math.max(0, timeoutMs);
      const timer = setTimeout(() => {
        this.cancelActive(new Error(`${language === 'visualbasic' ? 'Visual Basic' : 'C#'} execution exceeded ${timeoutMs} ms.`));
      }, deadline);
      this.active = { id, language, resolve, reject, signal, abort, timer };
      signal?.addEventListener('abort', abort, { once: true });
      worker.postMessage({
        type: 'execute', id, language,
        source: String(source ?? ''), stdin: String(stdin ?? ''), timeoutMs,
      });
    });
  }

  handleMessage = ({ data }) => {
    if (!this.active || data.id !== this.active.id) return;
    if (data.type === 'initialized') {
      clearTimeout(this.active.timer);
      this.active.timer = setTimeout(() => {
        this.cancelActive(new Error(`${this.active.language === 'visualbasic' ? 'Visual Basic' : 'C#'} execution exceeded ${data.timeoutMs ?? this.timeoutMs} ms.`));
      }, data.timeoutMs ?? this.timeoutMs);
      return;
    }
    this.finish(this.active.resolve, data);
  };

  handleError = (event) => {
    if (!this.active) return;
    this.finish(this.active.reject, new Error(event.message || 'The .NET runtime worker failed.'));
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
