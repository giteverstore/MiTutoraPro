import { authService } from '../auth/AuthService';

export class DailyLoginClient {
  constructor({ endpoint = '/api/activity/daily-login', fetchImpl = globalThis.fetch, tokenProvider = () => authService.getIdToken() } = {}) {
    this.endpoint = endpoint;
    this.fetchImpl = fetchImpl === globalThis.fetch ? (...args) => globalThis.fetch(...args) : fetchImpl;
    this.tokenProvider = tokenProvider;
  }

  async claim() {
    const idToken = await this.tokenProvider();
    if (!idToken) return null;
    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!response.ok) return null;
    const result = await response.json().catch(() => null);
    if (Number.isSafeInteger(result?.balance)) {
      globalThis.dispatchEvent?.(new CustomEvent('mi-tutora:coin-balance', { detail: { balance: result.balance } }));
    }
    return result;
  }
}

export const dailyLoginClient = new DailyLoginClient();
