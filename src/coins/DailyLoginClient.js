import { authService } from '../auth/AuthService';
import { authenticatedJsonPost } from '../api/authenticatedJsonRequest';
import { COIN_BALANCE_UPDATED_EVENT } from './coinEvents';

export class DailyLoginClient {
  constructor({ endpoint = '/api/activity/daily-login', fetchImpl = globalThis.fetch, tokenProvider = () => authService.getIdToken() } = {}) {
    this.endpoint = endpoint;
    this.fetchImpl = fetchImpl === globalThis.fetch ? (...args) => globalThis.fetch(...args) : fetchImpl;
    this.tokenProvider = tokenProvider;
  }

  async claim() {
    const result = await authenticatedJsonPost({
      tokenProvider: this.tokenProvider,
      fetchImpl: this.fetchImpl,
      url: this.endpoint,
      body: {},
    });
    if (!result) return null;
    const { response, payload } = result;
    if (!response.ok) return null;
    if (Number.isSafeInteger(payload?.balance)) {
      globalThis.dispatchEvent?.(new CustomEvent(COIN_BALANCE_UPDATED_EVENT, { detail: { balance: payload.balance } }));
    }
    return payload;
  }
}

export const dailyLoginClient = new DailyLoginClient();
