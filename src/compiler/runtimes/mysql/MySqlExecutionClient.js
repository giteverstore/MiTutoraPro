import { getCurrentUser } from '../../../firebase/auth.js';

const DEFAULT_TIMEOUT_MS = 12_000;

export class MySqlExecutionClient {
  constructor({ endpoint = '/api/compiler/mysql/run', fetchImpl = globalThis.fetch, tokenProvider = async () => getCurrentUser()?.getIdToken() } = {}) {
    this.endpoint = endpoint;
    this.fetchImpl = (...args) => fetchImpl(...args);
    this.tokenProvider = tokenProvider;
  }

  async execute({ source, setupSql = '', execution = {}, signal, timeoutMs = DEFAULT_TIMEOUT_MS }) {
    if (signal?.aborted) throw signal.reason ?? new DOMException('MySQL execution cancelled.', 'AbortError');
    const publicStandalone = execution.publicStandalone === true;
    const token = await this.tokenProvider();
    if (!publicStandalone && !token) throw new Error('Sign in to run MySQL queries.');
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(new DOMException('MySQL execution timed out.', 'TimeoutError')), timeoutMs);
    const abort = () => timeoutController.abort(signal.reason);
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const response = await this.fetchImpl(publicStandalone ? '/api/compiler/mysql/public' : this.endpoint, {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
        body: JSON.stringify(publicStandalone ? { sql: String(source ?? '') } : {
          source: String(source ?? ''),
          ...(execution.contentId ? { contentId: String(execution.contentId) } : {}),
          ...(execution.contentType ? { contentType: String(execution.contentType) } : {}),
          ...(import.meta.env.DEV && setupSql ? { setupSql: String(setupSql) } : {}),
        }),
        signal: timeoutController.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(publicStandalone && ['compiler/mysql-public-disabled', 'compiler/mysql-unavailable'].includes(payload?.error?.code) ? 'MySQL compiler is temporarily unavailable.' : payload?.error?.message || 'MySQL execution failed.');
      return payload;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  }
}
