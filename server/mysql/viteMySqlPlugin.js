import { Buffer } from 'node:buffer';
import { createMySqlExecutionHandler } from './mysqlExecutionHandler.js';
import { createPublicMySqlExecutionHandler } from './publicMySqlExecutionHandler.js';

const MAX_BODY_BYTES = 80 * 1024;

function send(response, status, payload) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

function adaptResponse(response) {
  return {
    setHeader: (...args) => response.setHeader(...args),
    once: (...args) => response.once(...args),
    removeListener: (...args) => response.removeListener(...args),
    get writableEnded() { return response.writableEnded; },
    status: (status) => ({ json: (payload) => send(response, status, payload) }),
  };
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => { body += chunk; if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) reject(new Error('request-too-large')); });
    request.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('invalid-json')); } });
    request.on('error', reject);
  });
}

export function viteMySqlPlugin(environment) {
  const enabled = environment.MYSQL_RUNTIME_ENABLED === 'true';
  const handler = enabled ? createMySqlExecutionHandler({
    environment,
    credentialFactory: () => Object.freeze({ mode: 'emulator', firebaseCredential: null, async preflight() {} }),
  }) : null;
  const publicHandler = enabled ? createPublicMySqlExecutionHandler({
    environment,
    credentialFactory: () => Object.freeze({ mode: 'emulator', firebaseCredential: null, async preflight() {} }),
  }) : null;
  return {
    name: 'ycoders-local-mysql-api',
    configureServer(server) {
      if (!handler) return;
      if (publicHandler) server.middlewares.use('/api/compiler/mysql/public', async (request, response) => {
        try { request.body = await readJson(request); }
        catch { return send(response, 400, { error: { code: 'compiler/mysql-invalid-request', message: 'The MySQL request is invalid.' } }); }
        return publicHandler(request, adaptResponse(response));
      });
      server.middlewares.use('/api/compiler/mysql/run', async (request, response) => {
        try { request.body = await readJson(request); }
        catch { return send(response, 400, { error: { code: 'mysql/invalid-request', message: 'The MySQL request is invalid.' } }); }
        return handler(request, adaptResponse(response));
      });
    },
  };
}
