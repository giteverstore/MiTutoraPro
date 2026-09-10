export class ActivityCompletionClientError extends Error {
  constructor(message, { code = 'coin/service-unavailable', status = 0 } = {}) { super(message); this.name = 'ActivityCompletionClientError'; this.code = code; this.status = status; }
}

async function token() {
  const { authService } = await import('../auth/AuthService');
  return authService.getIdToken();
}

export class ActivityCompletionClient {
  constructor({ endpoint = '/api/activity/complete', fetchImpl = globalThis.fetch, tokenProvider = token } = {}) {
    this.endpoint = endpoint;
    this.fetchImpl = fetchImpl === globalThis.fetch ? (...args) => globalThis.fetch(...args) : fetchImpl;
    this.tokenProvider = tokenProvider;
  }
  async complete(request) {
    const idToken = await this.tokenProvider();
    if (!idToken) throw new ActivityCompletionClientError('Sign in to save this completion.', { code: 'coin/unauthenticated', status: 401 });
    const activity = {
      activityType: request?.activityType,
      activityId: request?.activityId,
      activityVersion: request?.activityVersion,
    };
    const fetchImpl = this.fetchImpl;
    const response = await fetchImpl(this.endpoint, { method: 'POST', headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(activity) });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new ActivityCompletionClientError(body?.error?.message || 'Completion could not be saved.', { code: body?.error?.code, status: response.status });
    if (body?.rewardStatus === 'credited' && Number.isSafeInteger(body.balance)) {
      globalThis.dispatchEvent?.(new CustomEvent('mi-tutora:coin-balance', { detail: { balance: body.balance } }));
    }
    return body;
  }
}

export const activityCompletionClient = new ActivityCompletionClient();
