import { getCurrentUser } from '../../../firebase/auth.js';

export class RemoteCompilerClient {
  constructor({ language, endpoint = '/api/compiler/execute', fetchImpl = globalThis.fetch, tokenProvider = async () => getCurrentUser()?.getIdToken() } = {}) { this.language = language; this.endpoint = endpoint; this.fetchImpl = fetchImpl; this.tokenProvider = tokenProvider; }
  async execute({ source, stdin = '', execution = {}, signal, timeoutMs = 27_000 }) {
    if (signal?.aborted) throw signal.reason ?? new DOMException('Execution cancelled.', 'AbortError');
    const publicStandalone = execution.publicStandalone === true; const token = await this.tokenProvider();
    if (!publicStandalone && !token) throw new Error(`Sign in to run ${this.language} code.`);
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(new DOMException('Execution timed out.', 'TimeoutError')), timeoutMs);
    const abort = () => controller.abort(signal.reason); signal?.addEventListener('abort', abort, { once: true });
    try {
      const endpoint = publicStandalone ? '/api/compiler/remote/public' : this.endpoint;
      const body = publicStandalone ? { languageId: this.language, source: String(source ?? ''), stdin: String(stdin ?? '') } : { language: this.language, source: String(source ?? ''), stdin: String(stdin ?? ''), ...(execution.contentId ? { contentId: String(execution.contentId) } : {}), ...(execution.contentType ? { contentType: String(execution.contentType) } : {}) };
      const response = await this.fetchImpl(endpoint, { method: 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const unavailable = publicStandalone && payload?.error?.code === 'compiler/runner-unavailable';
        const label = this.language === 'go' ? 'Go' : this.language === 'rust' ? 'Rust' : 'Remote';
        throw new Error(unavailable ? `${label} compiler is temporarily unavailable.` : payload?.error?.message || 'Remote compiler execution failed.');
      }
      return payload;
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
  }
}
