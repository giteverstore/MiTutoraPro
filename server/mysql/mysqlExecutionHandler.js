import { firebaseAITutorAuthenticator } from '../ai/auth/FirebaseAITutorAuthenticator.js';
import { createHttpRequestLifecycle } from '../ai/httpRequestLifecycle.js';
import { createVercelGoogleCredentialContext } from '../auth/VercelGoogleCredentialAdapter.js';
import { MySqlExecutionError } from './MySqlExecutionError.js';
import { mysqlAbuseGuard } from './mysqlAbuseGuard.js';
import { createMySqlSandboxService } from './mysqlInfrastructure.js';
import { createMySqlDistributedQuota } from './MySqlDistributedQuota.js';
import { createFirebaseMySqlSetupResolver } from './FirebaseMySqlContentSource.js';

export function publicMySqlError(error) {
  if (error instanceof MySqlExecutionError) return { status: error.status, body: { error: { code: error.code, message: error.message } } };
  if (['ai/auth-required', 'ai/auth-invalid'].includes(error?.code)) return { status: 401, body: { error: { code: 'mysql/unauthenticated', message: 'Sign in to run MySQL queries.' } } };
  return { status: 503, body: { error: { code: 'mysql/unavailable', message: 'The MySQL learning runtime is temporarily unavailable.' } } };
}

export function createMySqlExecutionHandler({
  environment = process.env,
  authenticator = firebaseAITutorAuthenticator,
  credentialFactory = createVercelGoogleCredentialContext,
  serviceFactory = createMySqlSandboxService,
  abuseGuard = mysqlAbuseGuard,
  setupResolver = null,
  setupResolverFactory = createFirebaseMySqlSetupResolver,
  distributedQuotaFactory = createMySqlDistributedQuota,
} = {}) {
  return async function mysqlExecutionHandler(request, response) {
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      return response.status(405).json({ error: { code: 'mysql/method-not-allowed', message: 'Use POST to run MySQL queries.' } });
    }
    const lifecycle = createHttpRequestLifecycle(request, response);
    let quotaSession;
    let lease;
    let contentSession;
    try {
      if (environment.MYSQL_RUNTIME_ENABLED !== 'true') {
        throw new MySqlExecutionError('mysql/unavailable', 'The MySQL learning runtime is not enabled.', { status: 503 });
      }
      const credentials = credentialFactory({ request, environment });
      await credentials.preflight();
      const principal = await authenticator.authenticate(request, { environment, googleCredentials: credentials });
      const body = request.body && typeof request.body === 'object' ? request.body : {};
      if (typeof body.source !== 'string') throw new MySqlExecutionError('mysql/invalid-request', 'A MySQL source string is required.');
      let setupSql = typeof body.setupSql === 'string' ? body.setupSql : '';
      const developmentSetupAllowed = environment.NODE_ENV !== 'production' && environment.MYSQL_ALLOW_DEV_SETUP_SQL === 'true';
      if (setupSql && !developmentSetupAllowed) throw new MySqlExecutionError('mysql/setup-not-authorized', 'Client-supplied setup SQL is not allowed.', { status: 403 });
      let canonicalContent = null;
      if (environment.NODE_ENV === 'production') {
        contentSession = setupResolver ? { resolver: setupResolver } : await setupResolverFactory({ environment, credentials, uid: principal.uid });
        canonicalContent = await contentSession.resolver.resolve({ contentId: body.contentId, contentType: body.contentType });
        setupSql = canonicalContent.setupSql;
        quotaSession = await distributedQuotaFactory(environment, credentials);
        lease = await quotaSession.quota.acquire(principal.uid);
      }
      const service = serviceFactory(environment);
      const result = await abuseGuard.run(principal.uid, () => service.execute({ source: body.source, setupSql, signal: lifecycle.signal }));
      if (!lifecycle.signal.aborted && !response.writableEnded) return response.status(200).json({ ...result, ...(canonicalContent ? { canonicalContent: { canonicalId: canonicalContent.canonicalId, contentHash: canonicalContent.contentHash } } : {}) });
      return undefined;
    } catch (error) {
      if (lifecycle.signal.aborted || response.writableEnded) return undefined;
      const sanitized = publicMySqlError(error);
      return response.status(sanitized.status).json(sanitized.body);
    } finally {
      if (lease) await Promise.resolve(quotaSession?.quota.release(lease)).catch(() => undefined);
      await Promise.resolve(quotaSession?.close?.()).catch(() => undefined);
      await Promise.resolve(contentSession?.close?.()).catch(() => undefined);
      lifecycle.cleanup();
    }
  };
}
