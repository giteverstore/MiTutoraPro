import { COIN_BALANCE_UPDATED_EVENT } from './coinEvents';
import { authenticatedJsonPost } from '../api/authenticatedJsonRequest';

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
    const activity = {
      activityType: request?.activityType,
      activityId: request?.activityId,
      activityVersion: request?.activityVersion,
    };
    const result = await authenticatedJsonPost({
      tokenProvider: this.tokenProvider,
      fetchImpl: this.fetchImpl,
      url: this.endpoint,
      body: activity,
    });
    if (!result) throw new ActivityCompletionClientError('Sign in to save this completion.', { code: 'coin/unauthenticated', status: 401 });
    const { response, payload } = result;
    if (!response.ok) throw new ActivityCompletionClientError(payload?.error?.message || 'Completion could not be saved.', { code: payload?.error?.code, status: response.status });
    if (payload?.rewardStatus === 'credited' && Number.isSafeInteger(payload.balance)) {
      globalThis.dispatchEvent?.(new CustomEvent(COIN_BALANCE_UPDATED_EVENT, { detail: { balance: payload.balance } }));
    }
    return payload;
  }
}

export const activityCompletionClient = new ActivityCompletionClient();
