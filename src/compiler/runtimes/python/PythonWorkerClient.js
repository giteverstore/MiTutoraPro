export class PythonWorkerClient {
  constructor() {
    this.worker = null;
    this.pending = new Map();
    this.requestId = 0;
  }

  getWorker() {
    if (!this.worker) {
      this.worker = new Worker(new URL('./python.worker.js', import.meta.url), {
        type: 'module',
        name: 'mi-tutora-python-runtime',
      });
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

  request(type, payload = {}, signal) {
    if (signal?.aborted) {
      return Promise.reject(new DOMException('Execution cancelled.', 'AbortError'));
    }
    const worker = this.getWorker();
    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      const abort = () => {
        this.pending.delete(id);
        reject(new DOMException('Execution cancelled.', 'AbortError'));
        this.rejectAll(new DOMException('Execution cancelled.', 'AbortError'));
        this.destroyWorker();
      };
      const cleanup = () => signal?.removeEventListener('abort', abort);
      signal?.addEventListener('abort', abort, { once: true });
      this.pending.set(id, { resolve, reject, cleanup });
      worker.postMessage({ id, type, ...payload });
    });
  }

  initialize(signal) {
    return this.request('initialize', {}, signal);
  }

  execute({ source, stdin = '', filename = 'main.py', signal }) {
    return this.request('execute', {
      source,
      filename,
      stdin: Array.isArray(stdin) ? stdin.join('\n') : String(stdin ?? ''),
    }, signal);
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
