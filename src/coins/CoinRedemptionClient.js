async function token() { const { authService } = await import('../auth/AuthService'); return authService.getIdToken(); }

export class CoinRedemptionClient {
  constructor({ fetchImpl = (...args) => globalThis.fetch(...args), tokenProvider = token } = {}) { this.fetchImpl = fetchImpl; this.tokenProvider = tokenProvider; }
  async redeem(type, request) {
    const idToken = await this.tokenProvider();
    if (!idToken) throw new Error('Sign in to redeem coins.');
    const endpoint = type === 'CHALLENGE_PASS' ? '/api/coins/redeem/challenge-pass' : type === 'BRAND_THEME' ? '/api/coins/redeem/theme' : '/api/coins/redeem/premium';
    const response = await this.fetchImpl(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
    const body = await response.json().catch(() => null);
    if (!response.ok) { const error = new Error(body?.error?.message || 'Redemption could not be completed.'); error.code = body?.error?.code; throw error; }
    globalThis.dispatchEvent?.(new CustomEvent('mitutora:coin-balance', { detail: { balance: body.balance } }));
    globalThis.dispatchEvent?.(new Event('mitutora:redemption-updated'));
    if (type === 'PREMIUM_MONTH') globalThis.dispatchEvent?.(new Event('mitutora:subscription-updated'));
    return body;
  }
}
export const coinRedemptionClient = new CoinRedemptionClient();
