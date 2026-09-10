import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { createAIExplainHandler } from '../../api/ai/explain.js';
import { FirebaseAITutorAuthenticator } from '../../server/ai/auth/FirebaseAITutorAuthenticator.js';
import {
  createVercelGoogleCredentialContext,
  resolveGoogleWifConfiguration,
} from '../../server/auth/VercelGoogleCredentialAdapter.js';
import {
  createRequestFirebaseApp,
  getServerFirebaseApp,
  resolveFirebaseAdminConfiguration,
} from '../../server/firebaseAdminApp.js';
import { createTutorQuotaFirestore } from '../../server/ai/quota/createTutorQuotaFirestore.js';
import {
  createTutorQuotaFirestoreConfiguration,
  requiresFederatedTutorCredentials,
  resolveTutorRuntimeProfile,
  TUTOR_RUNTIME_PROFILES,
} from '../../server/ai/tutor/tutorRuntimeConfig.js';

const productionEnvironment = (overrides = {}) => ({
  NODE_ENV: 'production',
  FIREBASE_PROJECT_ID: 'mi-tutora-pro',
  GOOGLE_WIF_AUDIENCE: '//iam.googleapis.com/projects/196429461457/locations/global/workloadIdentityPools/ai-tutor-vercel/providers/vercel-production',
  GOOGLE_WIF_SERVICE_ACCOUNT_EMAIL: 'ai-tutor-runtime@mi-tutora-pro.iam.gserviceaccount.com',
  AI_TUTOR_QUOTA_DATABASE_ID: 'ai-tutor-quota',
  ...overrides,
});

const validationEnvironment = (overrides = {}) => ({
  NODE_ENV: 'production',
  VERCEL_ENV: 'preview',
  AI_TUTOR_RUNTIME_BOUNDARY: 'validation',
  FIREBASE_PROJECT_ID: 'mi-tutora-ai-val-260904-k7m3',
  GOOGLE_WIF_AUDIENCE: '//iam.googleapis.com/projects/987654321012/locations/global/workloadIdentityPools/ai-tutor-vercel-validation/providers/vercel-validation-preview',
  GOOGLE_WIF_SERVICE_ACCOUNT_EMAIL: 'ai-tutor-validation-runtime@mi-tutora-ai-val-260904-k7m3.iam.gserviceaccount.com',
  AI_TUTOR_QUOTA_DATABASE_ID: 'ai-tutor-quota-validation',
  ...overrides,
});

const TEST_OIDC_TOKEN = 'TEST_OIDC_TOKEN.TEST_PAYLOAD.TEST_SIGNATURE';

class SuccessfulIdentityPoolClient {
  static instances = [];

  constructor(options) {
    this.options = options;
    this.credentials = {};
    this.refreshCount = 0;
    SuccessfulIdentityPoolClient.instances.push(this);
  }

  async getAccessToken() {
    await this.options.subject_token_supplier.getSubjectToken();
    this.refreshCount += 1;
    const token = `short-lived-google-token-${this.refreshCount}`;
    this.credentials = { access_token: token, expiry_date: Date.now() + 3_600_000 };
    return { token };
  }
}

function createContext(overrides = {}) {
  SuccessfulIdentityPoolClient.instances = [];
  return createVercelGoogleCredentialContext({
    request: { headers: {} },
    environment: productionEnvironment(),
    tokenSource: async () => TEST_OIDC_TOKEN,
    IdentityPoolClientClass: SuccessfulIdentityPoolClient,
    ...overrides,
  });
}

describe('Vercel OIDC to Google WIF credential adapter', () => {
  it('pins the Firebase Admin Auth ESM/CJS compatibility dependency graph', () => {
    const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
    expect(lock.packages['node_modules/firebase-admin']?.version).toBe('14.2.0');
    expect(lock.packages['node_modules/jwks-rsa']?.version).toBe('4.1.0');
    expect(lock.packages['node_modules/jose']?.version).toBe('6.2.7');
    expect(readFileSync('node_modules/jwks-rsa/src/utils.js', 'utf8')).toContain("require('jose')");
  });

  it('loads the exact Firebase Admin Auth graph with require(ESM) enabled and reproduces the prior failure without it', () => {
    const script = "import('firebase-admin/auth').then(() => process.exit(0)).catch((error) => { process.stderr.write(String(error?.code || error?.name || 'unknown')); process.exit(1); })";
    const environment = { ...process.env };
    delete environment.NODE_OPTIONS;

    const incompatible = spawnSync(process.execPath, ['--no-experimental-require-module', '--input-type=module', '-e', script], {
      cwd: process.cwd(),
      env: environment,
      encoding: 'utf8',
      timeout: 15_000,
    });
    expect(incompatible.status).toBe(1);
    expect(incompatible.stderr.trim()).toBe('ERR_REQUIRE_ESM');

    const compatible = spawnSync(process.execPath, ['--experimental-require-module', '--input-type=module', '-e', script], {
      cwd: process.cwd(),
      env: environment,
      encoding: 'utf8',
      timeout: 15_000,
    });
    expect(compatible.status).toBe(0);
    expect(compatible.stderr).toBe('');
  });

  it('keeps revocation-aware Firebase verification and rejects every verification failure before downstream work', async () => {
    const authSource = readFileSync('server/ai/auth/FirebaseAITutorAuthenticator.js', 'utf8');
    expect(authSource).toContain('verifyIdToken(token, true)');

    for (const category of [
      'invalid-signature',
      'wrong-project',
      'wrong-issuer',
      'wrong-audience',
      'expired-token',
      'revoked-token',
    ]) {
      const authenticator = new FirebaseAITutorAuthenticator({
        verifyToken: vi.fn().mockRejectedValue(new Error(category)),
      });
      await expect(authenticator.authenticate({ headers: { authorization: 'Bearer synthetic-token' } }))
        .rejects.toMatchObject({ code: 'ai/auth-invalid', status: 401 });
    }

    const calls = [];
    const handler = createAIExplainHandler({
      environment: productionEnvironment(),
      credentialFactory: vi.fn(() => ({
        authClient: {},
        firebaseCredential: {},
        preflight: vi.fn(async () => calls.push('preflight')),
      })),
      authenticator: {
        authenticate: vi.fn(async () => {
          calls.push('authenticate');
          throw new Error('synthetic invalid token');
        }),
      },
      quotaGuardFactory: vi.fn(() => calls.push('quota')),
      featureGateFactory: vi.fn(() => calls.push('smoke-or-feature-gate')),
      explain: vi.fn(() => calls.push('provider-path')),
    });
    const response = {
      writableEnded: false,
      setHeader: vi.fn(),
      status: vi.fn(function status() { return this; }),
      json: vi.fn((value) => value),
      once: vi.fn(),
      off: vi.fn(),
    };
    await handler({ method: 'POST', headers: { authorization: 'Bearer synthetic-token' }, body: {}, once: vi.fn(), off: vi.fn() }, response);
    expect(calls).toEqual(['preflight', 'authenticate']);
  });

  it('resolves immutable production and validation runtime profiles', () => {
    expect(resolveTutorRuntimeProfile(productionEnvironment())).toBe(TUTOR_RUNTIME_PROFILES.production);
    expect(resolveTutorRuntimeProfile(validationEnvironment())).toBe(TUTOR_RUNTIME_PROFILES.validation);
    expect(TUTOR_RUNTIME_PROFILES.production).toEqual({
      boundary: 'production',
      projectId: 'mi-tutora-pro',
      quotaDatabaseId: 'ai-tutor-quota',
      runtimeServiceAccountEmail: 'ai-tutor-runtime@mi-tutora-pro.iam.gserviceaccount.com',
      vercelEnvironment: 'production',
      wif: {
        projectNumber: '196429461457',
        poolId: 'ai-tutor-vercel',
        providerId: 'vercel-production',
      },
    });
    expect(TUTOR_RUNTIME_PROFILES.validation).toMatchObject({
      projectId: 'mi-tutora-ai-val-260904-k7m3',
      quotaDatabaseId: 'ai-tutor-quota-validation',
      runtimeServiceAccountEmail: 'ai-tutor-validation-runtime@mi-tutora-ai-val-260904-k7m3.iam.gserviceaccount.com',
      vercel: {
        issuer: 'https://oidc.vercel.com/avinashabbigeris-projects',
        audience: 'https://vercel.com/avinashabbigeris-projects',
        teamSlug: 'avinashabbigeris-projects',
        teamId: 'team_JWeTI30xjnERJbMpLUkgTpzV',
        projectName: 'mi-tutora-pro-ai-validation',
        projectId: 'prj_MXRcPMPyTAtqbfHJbFote2I3bRAD',
        environment: 'preview',
        subject: 'owner:avinashabbigeris-projects:project:mi-tutora-pro-ai-validation:environment:preview',
      },
    });
    expect(Object.isFrozen(TUTOR_RUNTIME_PROFILES.validation.vercel)).toBe(true);
  });

  it('pins the documented exact Vercel Preview subject without wildcards', () => {
    const identity = TUTOR_RUNTIME_PROFILES.validation.vercel;
    expect(identity.subject).toBe(
      `owner:${identity.teamSlug}:project:${identity.projectName}:environment:${identity.environment}`,
    );
    expect(identity.subject).not.toMatch(/[?*]/);
    expect(identity.teamId).toBe('team_JWeTI30xjnERJbMpLUkgTpzV');
    expect(identity.projectId).toBe('prj_MXRcPMPyTAtqbfHJbFote2I3bRAD');
  });

  it('fails closed for unknown, absent deployed, or deployment-mismatched boundaries', () => {
    expect(() => resolveTutorRuntimeProfile({ VERCEL_ENV: 'preview' }))
      .toThrowError(expect.objectContaining({ code: 'ai/not-configured' }));
    expect(() => resolveTutorRuntimeProfile(validationEnvironment({ AI_TUTOR_RUNTIME_BOUNDARY: 'unknown' })))
      .toThrowError(expect.objectContaining({ code: 'ai/not-configured' }));
    expect(() => resolveTutorRuntimeProfile(productionEnvironment({ AI_TUTOR_RUNTIME_BOUNDARY: 'validation' })))
      .toThrowError(expect.objectContaining({ code: 'ai/not-configured' }));
    expect(() => resolveTutorRuntimeProfile(validationEnvironment({ AI_TUTOR_RUNTIME_BOUNDARY: 'production' })))
      .toThrowError(expect.objectContaining({ code: 'ai/not-configured' }));
  });

  it('rejects every production/validation project and database cross-combination', () => {
    for (const environment of [
      productionEnvironment({ AI_TUTOR_QUOTA_DATABASE_ID: 'ai-tutor-quota-validation' }),
      productionEnvironment({ FIREBASE_PROJECT_ID: 'mi-tutora-ai-val-260904-k7m3' }),
      validationEnvironment({ AI_TUTOR_QUOTA_DATABASE_ID: 'ai-tutor-quota' }),
      validationEnvironment({ FIREBASE_PROJECT_ID: 'mi-tutora-pro' }),
      validationEnvironment({ AI_TUTOR_QUOTA_DATABASE_ID: '(default)' }),
    ]) {
      expect(() => createTutorQuotaFirestoreConfiguration(environment))
        .toThrowError(expect.objectContaining({ code: 'ai/not-configured' }));
    }
  });

  it('pins each deployed boundary to its own runtime service account and WIF pool/provider', () => {
    expect(resolveGoogleWifConfiguration(validationEnvironment())).toMatchObject({
      projectId: 'mi-tutora-ai-val-260904-k7m3',
      serviceAccountEmail: 'ai-tutor-validation-runtime@mi-tutora-ai-val-260904-k7m3.iam.gserviceaccount.com',
    });
    for (const environment of [
      productionEnvironment({
        GOOGLE_WIF_SERVICE_ACCOUNT_EMAIL: validationEnvironment().GOOGLE_WIF_SERVICE_ACCOUNT_EMAIL,
      }),
      validationEnvironment({
        GOOGLE_WIF_SERVICE_ACCOUNT_EMAIL: productionEnvironment().GOOGLE_WIF_SERVICE_ACCOUNT_EMAIL,
      }),
      productionEnvironment({ GOOGLE_WIF_AUDIENCE: validationEnvironment().GOOGLE_WIF_AUDIENCE }),
      validationEnvironment({ GOOGLE_WIF_AUDIENCE: productionEnvironment().GOOGLE_WIF_AUDIENCE }),
    ]) {
      expect(() => resolveGoogleWifConfiguration(environment))
        .toThrowError(expect.objectContaining({ code: 'ai/server-unavailable' }));
    }
  });

  it('pins Firebase Admin Auth to the selected boundary project', () => {
    expect(resolveFirebaseAdminConfiguration(validationEnvironment())).toEqual({
      projectId: 'mi-tutora-ai-val-260904-k7m3',
      serviceAccount: null,
    });
    expect(() => resolveFirebaseAdminConfiguration(validationEnvironment({ FIREBASE_PROJECT_ID: 'mi-tutora-pro' })))
      .toThrowError(expect.objectContaining({ code: 'ai/server-unavailable' }));
    expect(() => resolveFirebaseAdminConfiguration(validationEnvironment({
      FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'mi-tutora-ai-val-260904-k7m3' }),
    }))).toThrowError(expect.objectContaining({ code: 'ai/server-unavailable' }));
    expect(() => resolveFirebaseAdminConfiguration({
      AI_TUTOR_RUNTIME_BOUNDARY: 'validation',
      FIREBASE_PROJECT_ID: 'mi-tutora-ai-val-260904-k7m3',
      FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify({ project_id: 'mi-tutora-ai-val-260904-k7m3' }),
    })).toThrowError(expect.objectContaining({ code: 'ai/server-unavailable' }));
  });

  it('requires WIF for validation Preview while retaining explicitly local ADC', () => {
    expect(requiresFederatedTutorCredentials(validationEnvironment())).toBe(true);
    expect(() => createTutorQuotaFirestore(validationEnvironment(), { FirestoreClient: vi.fn() }))
      .toThrow('A deployed WIF credential is required.');
    expect(requiresFederatedTutorCredentials({ NODE_ENV: 'development' })).toBe(false);
  });

  it('keeps boundary selection server-owned and independent of request or model input', () => {
    const source = readFileSync('server/ai/tutor/tutorRuntimeConfig.js', 'utf8');
    const browserFiles = [
      'src/ai/AITutorClient.js',
      'src/ai/AITutorPanel.jsx',
      'src/ai/AITutorResponse.jsx',
    ].map((path) => readFileSync(path, 'utf8')).join('\n');
    expect(source).toContain('environment.AI_TUTOR_RUNTIME_BOUNDARY');
    expect(source).not.toMatch(/VITE_AI_TUTOR_RUNTIME_BOUNDARY|request\.|payload\.|response\.|AI_MODEL.*RUNTIME_BOUNDARY/);
    expect(browserFiles).not.toMatch(/AI_TUTOR_RUNTIME_BOUNDARY|TUTOR_RUNTIME_PROFILES/);
    expect(browserFiles).not.toContain('team_JWeTI30xjnERJbMpLUkgTpzV');
    expect(browserFiles).not.toContain('prj_MXRcPMPyTAtqbfHJbFote2I3bRAD');
  });

  it('keeps learner Firebase Authorization and arbitrary headers separate from platform identity', async () => {
    const tokenSource = vi.fn(async ({ request }) => {
      expect(request.headers.authorization).toBe('Bearer learner-firebase-id-token');
      return TEST_OIDC_TOKEN;
    });
    const context = createContext({
      request: {
        headers: {
          authorization: 'Bearer learner-firebase-id-token',
          'x-vercel-oidc-token': 'learner-controlled-header-value',
          'x-arbitrary-token': 'another-learner-value',
        },
      },
      tokenSource,
    });

    expect(await context.subjectTokenSupplier.getSubjectToken()).toBe(TEST_OIDC_TOKEN);
    expect(tokenSource).toHaveBeenCalledOnce();
  });

  it('requires the exact production project, WIF audience, and runtime service account', () => {
    for (const missing of ['FIREBASE_PROJECT_ID', 'GOOGLE_WIF_AUDIENCE', 'GOOGLE_WIF_SERVICE_ACCOUNT_EMAIL']) {
      expect(() => resolveGoogleWifConfiguration(productionEnvironment({ [missing]: '' })))
        .toThrowError(expect.objectContaining({ code: 'ai/server-unavailable', status: 503 }));
    }
    expect(() => resolveGoogleWifConfiguration(productionEnvironment({ FIREBASE_PROJECT_ID: 'another-project' })))
      .toThrowError(expect.objectContaining({ code: 'ai/server-unavailable' }));
    expect(() => resolveGoogleWifConfiguration(productionEnvironment({ GOOGLE_WIF_SERVICE_ACCOUNT_EMAIL: 'other@mi-tutora-pro.iam.gserviceaccount.com' })))
      .toThrowError(expect.objectContaining({ code: 'ai/server-unavailable' }));
    expect(() => resolveGoogleWifConfiguration(productionEnvironment({
      GOOGLE_WIF_AUDIENCE: '//iam.googleapis.com/projects/196429461457/locations/global/workloadIdentityPools/other-pool/providers/vercel-production',
    }))).toThrowError(expect.objectContaining({ code: 'ai/server-unavailable' }));
  });

  it('rejects a missing or malformed platform token before Google exchange', async () => {
    for (const value of ['', 'not-a-jwt', 'a.b', 'a.b.c.d']) {
      const context = createContext({ tokenSource: async () => value });
      await expect(context.preflight()).rejects.toMatchObject({ code: 'ai/server-unavailable', status: 503 });
    }
  });

  it('normalizes token acquisition and exchange failures without exposing credentials', async () => {
    class FailedIdentityPoolClient {
      constructor(options) { this.options = options; }
      async getAccessToken() {
        await this.options.subject_token_supplier.getSubjectToken();
        throw new Error('synthetic exchange failure containing internal detail');
      }
    }
    const context = createContext({ IdentityPoolClientClass: FailedIdentityPoolClient });
    await expect(context.preflight()).rejects.toMatchObject({
      code: 'ai/server-unavailable',
      status: 503,
      message: 'AI Tutor server configuration is unavailable.',
    });
  });

  it('uses the external-account exchange and service-account impersonation contract', () => {
    createContext();
    const options = SuccessfulIdentityPoolClient.instances[0].options;
    expect(options).toMatchObject({
      type: 'external_account',
      audience: productionEnvironment().GOOGLE_WIF_AUDIENCE,
      subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
      token_url: 'https://sts.googleapis.com/v1/token',
      service_account_impersonation_url: 'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/ai-tutor-runtime@mi-tutora-pro.iam.gserviceaccount.com:generateAccessToken',
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
  });

  it('refreshes short-lived Google credentials through the WIF client', async () => {
    const context = createContext();
    const first = await context.firebaseCredential.getAccessToken();
    const second = await context.firebaseCredential.getAccessToken();
    expect(first.access_token).not.toBe(second.access_token);
    expect(first.expires_in).toBeGreaterThan(0);
    expect(SuccessfulIdentityPoolClient.instances[0].refreshCount).toBe(2);
  });

  it('fails closed when a later credential refresh fails', async () => {
    class RefreshFailureClient extends SuccessfulIdentityPoolClient {
      async getAccessToken() {
        if (this.refreshCount > 0) throw new Error('synthetic refresh failure');
        return super.getAccessToken();
      }
    }
    const context = createContext({ IdentityPoolClientClass: RefreshFailureClient });
    await expect(context.firebaseCredential.getAccessToken()).resolves.toMatchObject({ access_token: expect.any(String) });
    await expect(context.firebaseCredential.getAccessToken()).rejects.toMatchObject({ code: 'ai/server-unavailable', status: 503 });
  });

  it('injects the WIF-backed credential into a request-scoped Firebase Admin app', async () => {
    const context = createContext();
    const initializeApp = vi.fn((options, name) => ({ options, name }));
    const deleteApp = vi.fn(async () => {});
    const session = await createRequestFirebaseApp(productionEnvironment(), {
      firebaseCredential: context.firebaseCredential,
      appModule: { initializeApp, deleteApp, applicationDefault: vi.fn(), cert: vi.fn() },
    });
    expect(initializeApp).toHaveBeenCalledWith(expect.objectContaining({
      credential: context.firebaseCredential,
      projectId: 'mi-tutora-pro',
    }), expect.stringMatching(/^mitutora-request-/));
    await session.close();
    expect(deleteApp).toHaveBeenCalledWith(session.app);
  });

  it('injects the same WIF auth client into the exact named quota database', () => {
    const context = createContext();
    const FirestoreClient = vi.fn(function FirestoreClient(options) { this.options = options; });
    const database = createTutorQuotaFirestore(productionEnvironment(), {
      FirestoreClient,
      authClient: context.authClient,
    });
    expect(database.options).toEqual({
      projectId: 'mi-tutora-pro',
      databaseId: 'ai-tutor-quota',
      authClient: context.authClient,
    });
  });

  it('injects validation WIF into validation Auth and the validation named quota database', async () => {
    const environment = validationEnvironment();
    const context = createVercelGoogleCredentialContext({
      request: { headers: {} },
      environment,
      tokenSource: async () => TEST_OIDC_TOKEN,
      IdentityPoolClientClass: SuccessfulIdentityPoolClient,
    });
    const initializeApp = vi.fn((options, name) => ({ options, name }));
    const session = await createRequestFirebaseApp(environment, {
      firebaseCredential: context.firebaseCredential,
      appModule: { initializeApp, deleteApp: vi.fn(async () => {}), applicationDefault: vi.fn(), cert: vi.fn() },
    });
    expect(session.app.options).toMatchObject({
      credential: context.firebaseCredential,
      projectId: 'mi-tutora-ai-val-260904-k7m3',
    });
    const FirestoreClient = vi.fn(function FirestoreClient(options) { this.options = options; });
    expect(createTutorQuotaFirestore(environment, {
      FirestoreClient,
      authClient: context.authClient,
    }).options).toEqual({
      projectId: 'mi-tutora-ai-val-260904-k7m3',
      databaseId: 'ai-tutor-quota-validation',
      authClient: context.authClient,
    });
    await session.close();
  });

  it('fails closed instead of using default credentials or a service-account JSON in production', async () => {
    expect(() => resolveFirebaseAdminConfiguration(productionEnvironment({ FIREBASE_SERVICE_ACCOUNT_JSON: '{"type":"service_account"}' })))
      .toThrowError(expect.objectContaining({ code: 'ai/server-unavailable' }));
    await expect(createRequestFirebaseApp(productionEnvironment(), {
      appModule: { initializeApp: vi.fn(), deleteApp: vi.fn(), applicationDefault: vi.fn(), cert: vi.fn() },
    })).rejects.toMatchObject({ code: 'ai/server-unavailable' });
    expect(() => getServerFirebaseApp(productionEnvironment()))
      .toThrowError(expect.objectContaining({ code: 'ai/server-unavailable' }));
    expect(() => createTutorQuotaFirestore(productionEnvironment(), { FirestoreClient: vi.fn() }))
      .toThrow('A deployed WIF credential is required.');
  });

  it('rejects the default Firestore database for production quota state', () => {
    const context = createContext();
    expect(() => createTutorQuotaFirestore(productionEnvironment({ AI_TUTOR_QUOTA_DATABASE_ID: '(default)' }), {
      FirestoreClient: vi.fn(), authClient: context.authClient,
    })).toThrowError(expect.objectContaining({ code: 'ai/not-configured' }));
  });

  it('retains local ADC behavior without requiring a Vercel platform token', async () => {
    const tokenSource = vi.fn();
    const context = createVercelGoogleCredentialContext({
      request: { headers: {} }, environment: { NODE_ENV: 'development' }, tokenSource,
    });
    expect(context).toMatchObject({ mode: 'adc', authClient: null, firebaseCredential: null });
    await context.preflight();
    expect(tokenSource).not.toHaveBeenCalled();
  });

  it('passes one request-scoped credential context to authentication and quota persistence', async () => {
    const calls = [];
    const googleCredentials = { preflight: vi.fn(async () => calls.push('preflight')), authClient: {}, firebaseCredential: {} };
    const quotaGuard = {};
    const handler = createAIExplainHandler({
      environment: productionEnvironment(),
      credentialFactory: vi.fn(() => googleCredentials),
      authenticator: { authenticate: vi.fn(async (_request, options) => {
        calls.push('authenticate');
        expect(options.googleCredentials).toBe(googleCredentials);
        return { uid: 'synthetic-user' };
      }) },
      premiumAccessGuardFactory: vi.fn(() => ({ assertPremium: vi.fn(async () => calls.push('premium')) })),
      quotaGuardFactory: vi.fn((_environment, credentials) => {
        calls.push('quota');
        expect(credentials).toBe(googleCredentials);
        return quotaGuard;
      }),
      explain: vi.fn(async (_body, options) => {
        calls.push('explain');
        expect(options.quotaGuard).toBe(quotaGuard);
        return { explanation: 'synthetic response' };
      }),
    });
    const response = {
      writableEnded: false,
      setHeader: vi.fn(),
      status: vi.fn(function status() { return this; }),
      json: vi.fn((value) => value),
      once: vi.fn(),
      off: vi.fn(),
    };
    await handler({ method: 'POST', headers: { authorization: 'Bearer learner-token' }, body: {}, once: vi.fn(), off: vi.fn() }, response);
    expect(calls).toEqual(['preflight', 'authenticate', 'premium', 'quota', 'explain']);
  });

  it('keeps platform credentials out of browser source', () => {
    const adapter = readFileSync('server/auth/VercelGoogleCredentialAdapter.js', 'utf8');
    const browserFiles = [
      'src/ai/AITutorClient.js',
      'src/ai/AITutorPanel.jsx',
      'src/ai/AITutorResponse.jsx',
    ].map((path) => readFileSync(path, 'utf8')).join('\n');
    expect(browserFiles).not.toMatch(/@vercel\/oidc|google-auth-library|GOOGLE_WIF_|VERCEL_OIDC_TOKEN/);
    expect(adapter).toContain("from '@vercel/oidc'");
  });

  it('does not send platform credentials to telemetry', () => {
    const sources = [
      'server/auth/VercelGoogleCredentialAdapter.js',
      'api/ai/explain.js',
    ].map((path) => readFileSync(path, 'utf8')).join('\n');
    expect(sources).not.toMatch(/StructuredLogger|telemetry|recordMetric|captureEvent/);
  });

  it('does not log platform credentials', () => {
    const sources = [
      'server/auth/VercelGoogleCredentialAdapter.js',
      'api/ai/explain.js',
    ].map((path) => readFileSync(path, 'utf8')).join('\n');
    expect(sources).not.toMatch(/console\.(?:log|info|warn|error|debug)/);
  });

  it('does not keep global mutable tokens or read the platform token from request headers', () => {
    const adapter = readFileSync('server/auth/VercelGoogleCredentialAdapter.js', 'utf8');
    expect(adapter).not.toMatch(/request\?*\.headers|headers\[['"]x-vercel-oidc-token/);
    expect(adapter).not.toMatch(/^(?:let|var)\s+\w*(?:token|credential)\w*\s*[=;]/im);
  });
});
