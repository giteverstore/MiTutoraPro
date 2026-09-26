import { firebaseAITutorAuthenticator } from '../ai/auth/FirebaseAITutorAuthenticator.js';
import { createHttpRequestLifecycle } from '../ai/httpRequestLifecycle.js';
import { createVercelGoogleCredentialContext } from '../auth/VercelGoogleCredentialAdapter.js';
import { assertAllowedOrigin, clientKey } from '../compiler-public/compilerPublicService.js';
import { MySqlExecutionError } from './MySqlExecutionError.js';
import { createMySqlSandboxService } from './mysqlInfrastructure.js';
import { createPublicMySqlQuota } from './PublicMySqlQuota.js';

const MAX_REQUEST_BYTES = 80 * 1024;
const ALLOWED_FIELDS = new Set(['sql']);
const SAFE_CODES = new Set(['compiler/mysql-public-disabled', 'compiler/mysql-public-rate-limit', 'compiler/mysql-public-concurrency', 'compiler/mysql-busy', 'compiler/mysql-source-too-large', 'compiler/mysql-timeout', 'compiler/mysql-unavailable', 'compiler/mysql-invalid-request']);

function validateRequest(request) {
  try {
    const contentType = String(request.headers?.['content-type'] ?? '').split(';', 1)[0].trim().toLowerCase();
    if (contentType !== 'application/json') throw new MySqlExecutionError('compiler/mysql-invalid-request', 'Use application/json for MySQL requests.', { status: 415 });
    const declared = Number(request.headers?.['content-length']);
    if ((Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) || Buffer.byteLength(JSON.stringify(request.body ?? null), 'utf8') > MAX_REQUEST_BYTES) throw new MySqlExecutionError('compiler/mysql-source-too-large', 'The MySQL request is too large.', { status: 413 });
    const body = request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((field) => !ALLOWED_FIELDS.has(field)) || typeof body.sql !== 'string') throw new MySqlExecutionError('compiler/mysql-invalid-request', 'A MySQL sql string is required.', { status: 400 });
    if (!body.sql.trim()) throw new MySqlExecutionError('mysql/empty-query', 'Enter a MySQL query to run.', { status: 400 });
    if (Buffer.byteLength(body.sql, 'utf8') > 65_536) throw new MySqlExecutionError('compiler/mysql-source-too-large', 'The MySQL script is too large to run.', { status: 413 });
    return body.sql;
  } catch (error) {
    if (error instanceof MySqlExecutionError) throw error;
    throw new MySqlExecutionError('compiler/mysql-invalid-request', 'The MySQL request is invalid.', { status: 400, cause: error });
  }
}

async function optionalPrincipal(request, authenticator, options) {
  if (!String(request.headers?.authorization ?? '')) return null;
  try { return await authenticator.authenticate(request, options); }
  catch { throw new MySqlExecutionError('compiler/mysql-invalid-auth', 'Authentication could not be verified.', { status: 401 }); }
}

function publicError(error) {
  if (error?.code === 'compiler-public/origin-denied') return { status: 403, body: { error: { code: 'compiler/mysql-origin-denied', message: 'Request origin is not allowed.' } } };
  if (error instanceof MySqlExecutionError) {
    if (error.code === 'mysql/source-too-large') return { status: 413, body: { error: { code: 'compiler/mysql-source-too-large', message: error.message } } };
    if (error.code === 'mysql/unavailable') return { status: 503, body: { error: { code: 'compiler/mysql-unavailable', message: 'The MySQL compiler is temporarily unavailable.' } } };
    if (error.code === 'mysql/timeout') return { status: 408, body: { error: { code: 'compiler/mysql-timeout', message: 'MySQL execution timed out.' } } };
    if (error.code === 'mysql/cancelled') return { status: 499, body: { error: { code: 'compiler/mysql-cancelled', message: 'MySQL execution was cancelled.' } } };
    if (error.code === 'mysql/query-error' || error.code === 'mysql/invalid-sql' || error.code === 'mysql/empty-query' || error.code === 'mysql/too-many-statements' || error.code === 'mysql/statement-not-allowed' || error.code === 'mysql/result-limit') return { status: error.status, body: { error: { code: error.code, message: error.message } } };
    if (SAFE_CODES.has(error.code) || error.code === 'compiler/mysql-invalid-auth') return { status: error.status, body: { error: { code: error.code, message: error.message } } };
  }
  return { status: 503, body: { error: { code: 'compiler/mysql-server-error', message: 'The MySQL compiler is temporarily unavailable.' } } };
}

export function createPublicMySqlExecutionHandler({ environment = process.env, authenticator = firebaseAITutorAuthenticator, credentialFactory = createVercelGoogleCredentialContext, quotaFactory = createPublicMySqlQuota, serviceFactory = createMySqlSandboxService, logger = console } = {}) {
  return async function publicMySqlExecutionHandler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return response.status(405).json({ error: { code: 'compiler/mysql-invalid-request', message: 'Use POST to run MySQL queries.' } }); }
    const lifecycle = createHttpRequestLifecycle(request, response); const startedAt = Date.now(); let quotaSession; let lease; let outcome = 'cancelled'; let stage = 'origin'; let reply;
    try {
      assertAllowedOrigin(request);
      stage = 'feature-gates';
      if (environment.PUBLIC_MYSQL_RUNTIME_ENABLED !== 'true') throw new MySqlExecutionError('compiler/mysql-public-disabled', 'MySQL compiler is temporarily unavailable.', { status: 503 });
      if (environment.MYSQL_RUNTIME_ENABLED !== 'true') throw new MySqlExecutionError('compiler/mysql-unavailable', 'MySQL compiler is temporarily unavailable.', { status: 503 });
      const sql = validateRequest(request);
      stage = 'credentials';
      const credentials = credentialFactory({ request, environment }); await credentials.preflight();
      stage = 'authentication';
      const principal = await optionalPrincipal(request, authenticator, { environment, googleCredentials: credentials });
      stage = 'quota';
      quotaSession = await quotaFactory(environment, credentials);
      lease = await quotaSession.quota.acquire({ identity: principal?.uid ?? clientKey(request), authenticated: Boolean(principal) });
      stage = 'execution';
      const result = await serviceFactory(environment).execute({ source: sql, setupSql: '', signal: lifecycle.signal });
      outcome = String(result?.status ?? 'success');
      reply = { status: 200, body: result };
    } catch (error) {
      logger?.warn?.('public_mysql_execution_error', { stage, code: String(error?.code || error?.name || 'unknown') });
      const value = publicError(error); outcome = value.body.error.code;
      reply = value;
    } finally {
      if (lease) await Promise.resolve(quotaSession?.quota.release(lease)).catch(() => undefined);
      await Promise.resolve(quotaSession?.close?.()).catch(() => undefined);
      lifecycle.cleanup();
      logger?.info?.('public_mysql_execution', { executionId: lease?.executionId, identityHash: lease?.identityHash, authenticated: Boolean(lease && request.headers?.authorization), outcome, durationMs: Date.now() - startedAt });
    }
    if (!lifecycle.signal.aborted && !response.writableEnded && reply) return response.status(reply.status).json(reply.body);
    return undefined;
  };
}
