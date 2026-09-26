const DEFAULT_TIMEOUT_MS = 10_000;

export class NativeCompilerWorkerClient {
  constructor({
    timeoutMs = DEFAULT_TIMEOUT_MS,
    workerFactory = () => new Worker(new URL('./nativeCompiler.worker.js', import.meta.url), {
      type: 'module',
      name: 'ycoders-native-compiler-runtime',
    }),
  } = {}) {
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
    this.finish(this.active.resolve, data);
  };

  handleError = (event) => {
    if (!this.active) return;
    const error = new Error(event.message || 'The native compiler worker failed.');
    this.finish(this.active.reject, error);
    this.terminateWorker();
  };

  execute({ language, source, stdin = '', filename, signal, timeoutMs = this.timeoutMs }) {
    if (signal?.aborted) return Promise.reject(new DOMException('Execution cancelled.', 'AbortError'));
    if (this.active) this.cancelActive(new DOMException('Execution replaced by a newer run.', 'AbortError'));
    const worker = this.ensureWorker();
    const id = this.nextRequestId++;

    return new Promise((resolve, reject) => {
      const abort = () => this.cancelActive(new DOMException('Execution cancelled.', 'AbortError'));
      const timer = timeoutMs > 0 ? setTimeout(() => {
        this.cancelActive(new Error(`${language === 'cpp' ? 'C++' : 'C'} execution exceeded ${timeoutMs} ms.`));
      }, timeoutMs) : null;
      this.active = { id, resolve, reject, signal, abort, timer };
      signal?.addEventListener('abort', abort, { once: true });
      worker.postMessage({ type: 'execute', id, language, source: String(source ?? ''), stdin: String(stdin ?? ''), fileName: filename });
    });
  }

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
    const reject = this.active.reject;
    const { signal, abort, timer } = this.active;
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    this.active = null;
    this.terminateWorker();
    reject(reason);
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
