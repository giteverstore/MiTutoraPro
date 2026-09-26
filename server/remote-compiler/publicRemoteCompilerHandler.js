import { firebaseAITutorAuthenticator } from '../ai/auth/FirebaseAITutorAuthenticator.js';
import { createHttpRequestLifecycle } from '../ai/httpRequestLifecycle.js';
import { createVercelGoogleCredentialContext } from '../auth/VercelGoogleCredentialAdapter.js';
import { assertAllowedOrigin, clientKey } from '../compiler-public/compilerPublicService.js';
import { createPublicRemoteCompilerQuota } from './PublicRemoteCompilerQuota.js';
import { RemoteCompilerError } from './RemoteCompilerError.js';
import { RemoteRunnerClient } from './RemoteRunnerClient.js';
import { assertRemoteCompilerRequest, REMOTE_COMPILER_LIMITS } from './remoteCompilerPolicy.js';

const ALLOWED_FIELDS = new Set(['languageId', 'source', 'stdin']);
const MAX_REQUEST_BYTES = 150 * 1024;
const PUBLIC_ERROR_CODES = new Set([
  'compiler/invalid-request',
  'compiler/invalid-language',
  'compiler/invalid-auth',
  'compiler/request-too-large',
  'compiler/source-too-large',
  'compiler/stdin-too-large',
  'compiler/public-rate-limit',
  'compiler/public-concurrency-limit',
  'compiler/runner-busy',
  'compiler/runner-unavailable',
]);

function assertRequestSize(request) {
  const declared = Number(request.headers?.['content-length']);
  if ((Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) || Buffer.byteLength(JSON.stringify(request.body ?? null), 'utf8') > MAX_REQUEST_BYTES) {
    throw new RemoteCompilerError('compiler/request-too-large', 'Compiler request must be 150 KiB or smaller.', { status: 413 });
  }
}
function publicRequest(body, environment) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some((key) => !ALLOWED_FIELDS.has(key))) throw new RemoteCompilerError('compiler/invalid-request', 'Invalid compiler request.');
  if (!['go', 'rust'].includes(body.languageId)) throw new RemoteCompilerError('compiler/invalid-language', 'Only Go and Rust are available through this endpoint.');
  if (typeof body.stdin !== 'undefined' && typeof body.stdin !== 'string') throw new RemoteCompilerError('compiler/invalid-request', 'Standard input must be text.');
  const checked = assertRemoteCompilerRequest({ language: body.languageId, source: body.source, stdin: body.stdin ?? '' }, environment);
  if (checked.error) {
    const map = { 'remote-compiler/source-too-large': 'compiler/source-too-large', 'remote-compiler/stdin-too-large': 'compiler/stdin-too-large', 'remote-compiler/language-disabled': 'compiler/runner-unavailable' };
    const code = map[checked.error[0]] ?? 'compiler/invalid-request';
    throw new RemoteCompilerError(code, code === 'compiler/runner-unavailable' ? 'The compiler is temporarily unavailable.' : checked.error[1], { status: code === 'compiler/runner-unavailable' ? 503 : checked.error[0].includes('too-large') ? 413 : 400 });
  }
  return checked;
}
async function optionalPrincipal(request, authenticator, options) {
  const header = String(request.headers?.authorization ?? '');
  if (!header) return null;
  try { return await authenticator.authenticate(request, options); }
  catch { throw new RemoteCompilerError('compiler/invalid-auth', 'Authentication could not be verified.', { status: 401 }); }
}
function cleanResult(result, language) {
  const fields = ['stdout', 'stderr', 'exitCode', 'status', 'diagnostics', 'warnings', 'compileTimeMs', 'executionTimeMs', 'timedOut', 'truncated', 'output', 'errors'];
  return Object.fromEntries([['language', language], ...fields.filter((field) => result?.[field] !== undefined).map((field) => [field, result[field]])]);
}
function publicError(error) {
  if (error?.code === 'compiler-public/origin-denied') return { status: 403, body: { error: { code: 'compiler/origin-denied', message: 'Request origin is not allowed.' } } };
  if (error instanceof RemoteCompilerError) {
    if (error.code === 'remote-compiler/busy' || (error.code === 'remote-compiler/runner-error' && error.status === 503)) return { status: 503, body: { error: { code: 'compiler/runner-busy', message: 'The compiler is busy right now. Please try again shortly.' } } };
    if (error.code === 'remote-compiler/runner-unavailable' || error.code === 'remote-compiler/unavailable') return { status: 503, body: { error: { code: 'compiler/runner-unavailable', message: 'The compiler is temporarily unavailable.' } } };
    if (PUBLIC_ERROR_CODES.has(error.code)) return { status: error.status, body: { error: { code: error.code, message: error.message } } };
  }
  return { status: 503, body: { error: { code: 'compiler/server-error', message: 'The compiler is temporarily unavailable.' } } };
}

export function createPublicRemoteCompilerHandler({ environment = process.env, authenticator = firebaseAITutorAuthenticator, credentialFactory = createVercelGoogleCredentialContext, quotaFactory = createPublicRemoteCompilerQuota, runner = new RemoteRunnerClient({ environment }), logger = console } = {}) {
  return async function handler(request, response) {
    response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return response.status(405).json({ error: { code: 'compiler/method-not-allowed', message: 'Use POST to execute code.' } }); }
    const lifecycle = createHttpRequestLifecycle(request, response); const startedAt = Date.now(); let quotaSession; let lease; let language; let outcome = 'cancelled';
    try {
      assertAllowedOrigin(request);
      if (environment.PUBLIC_REMOTE_COMPILER_ENABLED !== 'true' || environment.REMOTE_COMPILER_RUNTIME_ENABLED !== 'true') throw new RemoteCompilerError('compiler/runner-unavailable', 'The compiler is temporarily unavailable.', { status: 503 });
      assertRequestSize(request);
      const checked = publicRequest(request.body, environment);
      language = checked.language;
      const credentials = credentialFactory({ request, environment }); await credentials.preflight();
      const principal = await optionalPrincipal(request, authenticator, { environment, googleCredentials: credentials });
      quotaSession = await quotaFactory(environment, credentials);
      lease = await quotaSession.quota.acquire({ identity: principal?.uid ?? clientKey(request), authenticated: Boolean(principal), language: checked.language });
      const result = await runner.execute({ language: checked.language, source: checked.source, stdin: checked.stdin, fileName: checked.definition.fileName, limits: REMOTE_COMPILER_LIMITS }, { signal: lifecycle.signal });
      outcome = String(result?.status ?? 'success');
      if (!lifecycle.signal.aborted && !response.writableEnded) return response.status(200).json(cleanResult(result, checked.language));
    } catch (error) {
      const value = publicError(error); outcome = value.body.error.code;
      if (!lifecycle.signal.aborted && !response.writableEnded) return response.status(value.status).json(value.body);
    } finally {
      if (lease) await Promise.resolve(quotaSession?.quota.release(lease)).catch(() => undefined);
      await Promise.resolve(quotaSession?.close?.()).catch(() => undefined); lifecycle.cleanup();
      logger?.info?.('public_remote_compiler_execution', { executionId: lease?.executionId, identityHash: lease?.identityHash, language, outcome, durationMs: Date.now() - startedAt });
    }
    return undefined;
  };
}
