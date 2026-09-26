import { firebaseAITutorAuthenticator } from '../ai/auth/FirebaseAITutorAuthenticator.js';
import { createHttpRequestLifecycle } from '../ai/httpRequestLifecycle.js';
import { createVercelGoogleCredentialContext } from '../auth/VercelGoogleCredentialAdapter.js';
import { RemoteCompilerError } from './RemoteCompilerError.js';
import { createRemoteCompilerQuota } from './RemoteCompilerQuota.js';
import { RemoteRunnerClient } from './RemoteRunnerClient.js';
import { assertRemoteCompilerRequest, REMOTE_COMPILER_LIMITS } from './remoteCompilerPolicy.js';
import { createFirebaseRemoteCompilerContentAuthorizer } from './FirebaseRemoteCompilerContentAuthorizer.js';

export function publicRemoteCompilerError(error) {
  if (error instanceof RemoteCompilerError) return { status: error.status, body: { error: { code: error.code, message: error.message } } };
  if (['ai/auth-required', 'ai/auth-invalid'].includes(error?.code)) return { status: 401, body: { error: { code: 'remote-compiler/unauthenticated', message: 'Sign in to run Go or Rust code.' } } };
  return { status: 503, body: { error: { code: 'remote-compiler/unavailable', message: 'The compiler service is temporarily unavailable.' } } };
}

export function createRemoteCompilerExecutionHandler({ environment = process.env, authenticator = firebaseAITutorAuthenticator, credentialFactory = createVercelGoogleCredentialContext, quotaFactory = createRemoteCompilerQuota, runner = new RemoteRunnerClient({ environment }), contentAuthorizer = null, contentAuthorizerFactory = createFirebaseRemoteCompilerContentAuthorizer } = {}) {
  return async function handler(request, response) {
    if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return response.status(405).json({ error: { code: 'remote-compiler/method-not-allowed', message: 'Use POST to execute code.' } }); }
    const lifecycle = createHttpRequestLifecycle(request, response); let quotaSession; let lease; let contentSession;
    try {
      if (environment.REMOTE_COMPILER_RUNTIME_ENABLED !== 'true') throw new RemoteCompilerError('remote-compiler/unavailable', 'Remote compiler execution is not enabled.', { status: 503 });
      const credentials = credentialFactory({ request, environment }); await credentials.preflight(); const principal = await authenticator.authenticate(request, { environment, googleCredentials: credentials });
      const checked = assertRemoteCompilerRequest(request.body, environment); if (checked.error) throw new RemoteCompilerError(checked.error[0], checked.error[1]);
      if (environment.NODE_ENV === 'production') {
        contentSession = contentAuthorizer ? { authorizer: contentAuthorizer } : await contentAuthorizerFactory({ environment, credentials, uid: principal.uid });
        await contentSession.authorizer.assertAllowed({ uid: principal.uid, language: checked.language, contentId: request.body.contentId, contentType: request.body.contentType, credentials });
      }
      quotaSession = await quotaFactory(environment, credentials); lease = await quotaSession.quota.acquire(principal.uid);
      const result = await runner.execute({ language: checked.language, source: checked.source, stdin: checked.stdin, fileName: checked.definition.fileName, limits: REMOTE_COMPILER_LIMITS }, { signal: lifecycle.signal });
      if (!lifecycle.signal.aborted && !response.writableEnded) return response.status(200).json(result);
    } catch (error) { if (!lifecycle.signal.aborted && !response.writableEnded) { const value = publicRemoteCompilerError(error); return response.status(value.status).json(value.body); } }
    finally { if (lease) await Promise.resolve(quotaSession?.quota.release(lease)).catch(() => undefined); await Promise.resolve(quotaSession?.close?.()).catch(() => undefined); await Promise.resolve(contentSession?.close?.()).catch(() => undefined); lifecycle.cleanup(); }
    return undefined;
  };
}
