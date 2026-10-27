import { COIN_BALANCE_UPDATED_EVENT } from './coinEvents';
import { authenticatedJsonPost } from '../api/authenticatedJsonRequest';

async function token() { const { authService } = await import('../auth/AuthService'); return authService.getIdToken(); }

export class CoinRedemptionClient {
  constructor({ fetchImpl = (...args) => globalThis.fetch(...args), tokenProvider = token } = {}) { this.fetchImpl = fetchImpl; this.tokenProvider = tokenProvider; }
  async redeem(type, request) {
    const endpoint = type === 'CHALLENGE_PASS' ? '/api/coins/redeem/challenge-pass' : type === 'BRAND_THEME' ? '/api/coins/redeem/theme' : '/api/coins/redeem/premium';
    const result = await authenticatedJsonPost({
      tokenProvider: this.tokenProvider,
      fetchImpl: this.fetchImpl,
      url: endpoint,
      body: request,
    });
    if (!result) throw new Error('Sign in to redeem coins.');
    const { response, payload } = result;
    if (!response.ok) { const error = new Error(payload?.error?.message || 'Redemption could not be completed.'); error.code = payload?.error?.code; throw error; }
    globalThis.dispatchEvent?.(new CustomEvent(COIN_BALANCE_UPDATED_EVENT, { detail: { balance: payload.balance } }));
    globalThis.dispatchEvent?.(new Event('mitutora:redemption-updated'));
    if (type === 'PREMIUM_MONTH') globalThis.dispatchEvent?.(new Event('mitutora:subscription-updated'));
    return payload;
  }
}
export const coinRedemptionClient = new CoinRedemptionClient();
