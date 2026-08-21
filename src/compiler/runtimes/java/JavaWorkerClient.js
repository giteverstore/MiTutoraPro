const DEFAULT_TIMEOUT_MS = 10_000;

export class JavaWorkerClient {
  constructor({ timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    this.timeoutMs = timeoutMs;
    this.worker = null;
    this.pending = new Map();
    this.requestId = 0;
  }

  getWorker() {
    if (!this.worker) {
      this.worker = new Worker(new URL('./java.worker.js', import.meta.url), {
        type: 'module',
        name: 'mi-tutora-java-runtime',
      });
      this.worker.addEventListener('message', ({ data }) => {
        const request = this.pending.get(data.id);
        if (!request) return;
        this.pending.delete(data.id);
        request.cleanup();
        if (data.type === 'initialization-error') request.reject(new Error(data.error));
        else request.resolve(data);
      });
      this.worker.addEventListener('error', (event) => {
        this.rejectAll(new Error(event.message || 'The Java runtime worker failed.'));
        this.destroyWorker();
      });
    }
    return this.worker;
  }

  request(type, payload = {}, signal, timeoutMs = this.timeoutMs) {
    if (signal?.aborted) return Promise.reject(new DOMException('Execution cancelled.', 'AbortError'));
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
      const timeout = type === 'execute' ? setTimeout(() => stop(new Error(`Java execution exceeded ${timeoutMs} ms.`)), timeoutMs) : null;
      const cleanup = () => {
        if (timeout) clearTimeout(timeout);
        signal?.removeEventListener('abort', abort);
      };
      signal?.addEventListener('abort', abort, { once: true });
      this.pending.set(id, { resolve, reject, cleanup });
      worker.postMessage({ id, type, ...payload });
    });
  }

  initialize(signal) { return this.request('initialize', {}, signal, 0); }

  execute({ source, stdin = '', filename = 'Main.java', execution, signal, timeoutMs }) {
    return this.request('execute', { source, stdin: Array.isArray(stdin) ? stdin.join('\n') : String(stdin ?? ''), filename, execution }, signal, timeoutMs);
  }

  reset() { return this.worker ? this.request('reset') : Promise.resolve(); }

  rejectAll(error) {
    for (const request of this.pending.values()) { request.cleanup(); request.reject(error); }
    this.pending.clear();
  }

  destroyWorker() { this.worker?.terminate(); this.worker = null; }

  dispose() {
    this.rejectAll(new DOMException('Runtime disposed.', 'AbortError'));
    this.destroyWorker();
  }
}
