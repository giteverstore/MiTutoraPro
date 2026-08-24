import {
  PYTHON_EXECUTION_TIMEOUT_MS,
  PYTHON_INITIALIZATION_TIMEOUT_MS,
} from './pythonRuntimeConfig.js';

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
  }

  getWorker() {
    if (!this.worker) {
      this.worker = this.workerFactory();
      this.worker.addEventListener('message', ({ data }) => {
        const request = this.pending.get(data.id);
        if (!request) return;
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
      const timeout = timeoutMs > 0
        ? setTimeout(() => stop(new Error(
          type === 'initialize'
            ? `Python initialization exceeded ${timeoutMs} ms.`
            : `Python execution exceeded ${timeoutMs} ms.`,
        )), timeoutMs)
        : null;
      const cleanup = () => {
        if (timeout) clearTimeout(timeout);
        signal?.removeEventListener('abort', abort);
      };
      signal?.addEventListener('abort', abort, { once: true });
      this.pending.set(id, { resolve, reject, cleanup });
      worker.postMessage({ id, type, ...payload });
    });
  }

  initialize(signal) {
    return this.request('initialize', {}, signal, this.initializationTimeoutMs);
  }

  execute({ source, stdin = '', filename = 'main.py', signal, timeoutMs }) {
    return this.request('execute', {
      source,
      filename,
      stdin: Array.isArray(stdin) ? stdin.join('\n') : String(stdin ?? ''),
    }, signal, timeoutMs ?? this.executionTimeoutMs);
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
  }

  dispose() {
    this.rejectAll(new DOMException('Runtime disposed.', 'AbortError'));
    this.destroyWorker();
  }
}
