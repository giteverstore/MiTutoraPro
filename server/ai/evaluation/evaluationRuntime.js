import { createTutorQuotaPolicy } from '../tutor/tutorRuntimeConfig.js';

export function createBoundedEvaluationQuotaPolicy(requestLimit) {
  if (!Number.isInteger(requestLimit) || requestLimit < 1) throw new Error('A positive evaluation request limit is required.');
  return createTutorQuotaPolicy({
    AI_TUTOR_QUOTA_BURST_REQUESTS: String(requestLimit),
    AI_TUTOR_QUOTA_BURST_WINDOW_SECONDS: '3600',
    AI_TUTOR_QUOTA_SUSTAINED_REQUESTS: String(requestLimit),
    AI_TUTOR_QUOTA_SUSTAINED_WINDOW_SECONDS: '3600',
    AI_TUTOR_QUOTA_HOURLY_REQUESTS: String(requestLimit),
    AI_TUTOR_QUOTA_DAILY_REQUESTS: String(requestLimit),
  });
}

export function createBoundedEvaluationProvider(provider, requestLimit, onRequest = () => {}) {
  if (!provider || typeof provider.explain !== 'function') throw new Error('An evaluation provider is required.');
  if (!Number.isInteger(requestLimit) || requestLimit < 1) throw new Error('A positive evaluation request limit is required.');
  let requests = 0;
  return Object.freeze({
    getMetadata: () => provider.getMetadata?.(),
    getRequestCount: () => requests,
    async explain(...args) {
      if (requests >= requestLimit) throw new Error('Exact-model evaluation provider request limit exceeded.');
      requests += 1;
      onRequest(requests);
      return provider.explain(...args);
    },
  });
}
