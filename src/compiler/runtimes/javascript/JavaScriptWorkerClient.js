const DEFAULT_TIMEOUT_MS = 10_000;

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
    this.activeWorker = null;
    this.cancelActive = null;
  }

  async initialize() {}

  execute({ source, stdin = '', filename = 'main.js', signal, timeoutMs = this.timeoutMs }) {
    if (signal?.aborted) return Promise.reject(new DOMException('Execution cancelled.', 'AbortError'));
    this.reset();
    const worker = this.workerFactory();
    this.activeWorker = worker;
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        worker.terminate();
        if (this.activeWorker === worker) this.activeWorker = null;
        if (this.cancelActive === abort) this.cancelActive = null;
      };
      const finish = (callback, value) => { cleanup(); callback(value); };
      const abort = () => finish(reject, new DOMException('Execution cancelled.', 'AbortError'));
      const timer = timeoutMs > 0 ? setTimeout(
        () => finish(reject, new Error(`JavaScript execution exceeded ${timeoutMs} ms.`)),
        timeoutMs,
      ) : null;
      worker.addEventListener('message', ({ data }) => finish(resolve, data), { once: true });
      worker.addEventListener('error', (event) => finish(reject, new Error(event.message || 'The JavaScript runtime worker failed.')), { once: true });
      signal?.addEventListener('abort', abort, { once: true });
      this.cancelActive = abort;
      worker.postMessage({ type: 'execute', source, stdin: Array.isArray(stdin) ? stdin.join('\n') : String(stdin ?? ''), filename });
    });
  }

  reset() {
    if (this.cancelActive) this.cancelActive();
    else {
      this.activeWorker?.terminate();
      this.activeWorker = null;
    }
  }

  dispose() { this.reset(); }
}
