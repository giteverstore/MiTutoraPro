import { Buffer } from 'node:buffer';
import { createActivityCompletionHandler } from './activityCompletionHandler.js';
import { createDevelopmentGrantHandler } from '../subscriptions/developmentGrantHandler.js';

const MAX_BODY_BYTES = 16_384;
const LOOPBACK = /^(?:127\.0\.0\.1|localhost)(?::\d+)?$/;

function send(response, status, payload, headers = {}) {
  response.statusCode = status;
  for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) reject(new Error('request-too-large'));
    });
    request.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('invalid-json')); }
    });
    request.on('error', reject);
  });
}

export function assertLocalCoinEnvironment(environment) {
  const projectId = String(environment.FIREBASE_PROJECT_ID || '').trim();
  const clientProjectId = String(environment.VITE_FIREBASE_PROJECT_ID || '').trim();
  if (environment.LOCAL_COIN_FULL_STACK !== 'true'
    || environment.VITE_FIREBASE_USE_EMULATORS !== 'true'
    || projectId !== 'demo-mitutora-coins'
    || clientProjectId !== projectId
    || !LOOPBACK.test(String(environment.FIRESTORE_EMULATOR_HOST || ''))
    || !LOOPBACK.test(String(environment.FIREBASE_AUTH_EMULATOR_HOST || ''))) {
    throw new Error('Local coin API requires the pinned demo project and loopback Firebase emulators.');
  }
}

export function viteActivityCompletionPlugin(environment, {
  handlerFactory = createActivityCompletionHandler,
  subscriptionHandlerFactory = createDevelopmentGrantHandler,
} = {}) {
  const enabled = environment.LOCAL_COIN_FULL_STACK === 'true';
  if (enabled) assertLocalCoinEnvironment(environment);
  const handler = enabled ? handlerFactory({
    environment,
    credentialFactory: () => Object.freeze({
      mode: 'emulator', firebaseCredential: null, async preflight() {},
    }),
  }) : null;
  const subscriptionHandler = enabled ? subscriptionHandlerFactory({ environment }) : null;

  return {
    name: 'mi-tutora-local-coin-api',
    configureServer(server) {
      if (!handler) return;
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url || '/', 'http://localhost').pathname;
        const routeHandler = pathname === '/api/activity/complete' ? handler
          : pathname === '/api/subscriptions/development-grant' ? subscriptionHandler : null;
        if (!routeHandler) return next();
        if (request.method !== 'POST') {
          return send(response, 405, { error: { code: 'coin/method-not-allowed', message: 'Use POST for activity completion.' } }, { Allow: 'POST' });
        }
        try {
          request.body = await readJson(request);
        } catch {
          return send(response, 400, { error: { code: 'coin/invalid-request', message: 'The completion request is invalid.' } });
        }
        const adapter = Object.create(response);
        adapter.status = (status) => ({ json: (payload) => send(response, status, payload) });
        return routeHandler(request, adapter);
      });
    },
  };
}
