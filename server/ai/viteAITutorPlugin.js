import { Buffer } from 'node:buffer';
import { createAIProvider } from './createAIProvider.js';
import { AIServiceError } from './AIServiceError.js';
import { explainCode, publicAIError } from './explainHandler.js';
import { TUTOR_REQUEST_LIMITS } from './tutor/tutorConfig.js';
import { firebaseAITutorAuthenticator } from './auth/FirebaseAITutorAuthenticator.js';
import { createHttpRequestLifecycle } from './httpRequestLifecycle.js';
import { createDefaultTutorQuotaGuard } from './tutor/tutorQuota.js';
import { createTutorFeatureGate } from './tutor/tutorFeatureGate.js';
import { createPremiumAccessGuard } from '../subscriptions/PremiumAccessGuard.js';

const readBody = (request) => new Promise((resolve, reject) => {
  let body = '';
  let tooLarge = false;
  request.setEncoding('utf8');
  request.on('data', (chunk) => {
    body += chunk;
    if (Buffer.byteLength(body, 'utf8') > TUTOR_REQUEST_LIMITS.totalBytes) tooLarge = true;
  });
  request.on('end', () => tooLarge
    ? reject(new AIServiceError('ai/request-too-large', 'The code context is too large to explain in one request.', { status: 413 }))
    : resolve(body));
  request.on('error', reject);
});

const send = (response, status, payload) => {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
};

export function viteAITutorPlugin(environment, {
  authenticator = firebaseAITutorAuthenticator,
  quotaGuard = createDefaultTutorQuotaGuard(environment),
  featureGate = createTutorFeatureGate(environment),
  premiumAccessGuard = null,
} = {}) {
  return {
    name: 'mi-tutora-ai-tutor-api',
    configureServer(server) {
      server.middlewares.use('/api/ai/explain', async (request, response) => {
        if (request.method !== 'POST') return send(response, 405, { error: { code: 'ai/method-not-allowed', message: 'Use POST for AI explanations.' } });
        const lifecycle = createHttpRequestLifecycle(request, response);
        try {
          const principal = await authenticator.authenticate(request);
          await (premiumAccessGuard ?? createPremiumAccessGuard(environment)).assertPremium(principal);
          let body;
          try { body = JSON.parse(await readBody(request)); }
          catch (error) {
            if (error instanceof AIServiceError) throw error;
            throw new AIServiceError('ai/invalid-request', 'The explanation request is invalid.', { status: 400 });
          }
          const result = await explainCode(body, {
            providerFactory: () => createAIProvider(environment),
            principal,
            quotaGuard,
            featureGate,
            signal: lifecycle.signal,
          });
          if (!lifecycle.signal.aborted && !response.writableEnded) return send(response, 200, result);
          return undefined;
        } catch (error) {
          if (lifecycle.signal.aborted || response.writableEnded) return undefined;
          const sanitized = publicAIError(error, { includeDiagnostics: true });
          return send(response, sanitized.status, sanitized.body);
        } finally {
          lifecycle.cleanup();
        }
      });
    },
  };
}
