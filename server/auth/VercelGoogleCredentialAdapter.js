import { IdentityPoolClient } from 'google-auth-library';
import { getVercelOidcToken } from '@vercel/oidc';
import { createHash } from 'node:crypto';
import { AIServiceError } from '../ai/AIServiceError.js';
import {
  requiresFederatedTutorCredentials,
  resolveTutorRuntimeProfile,
} from '../ai/tutor/tutorRuntimeConfig.js';

const GOOGLE_CLOUD_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';
const SUBJECT_TOKEN_TYPE = 'urn:ietf:params:oauth:token-type:jwt';
const GOOGLE_STS_URL = 'https://sts.googleapis.com/v1/token';
const GOOGLE_WIF_AUDIENCE_PATTERN = /^\/\/iam\.googleapis\.com\/projects\/(\d+)\/locations\/global\/workloadIdentityPools\/([a-z][a-z0-9-]{2,61}[a-z0-9])\/providers\/([a-z][a-z0-9-]{2,61}[a-z0-9])$/;
const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const MAX_OIDC_TOKEN_LENGTH = 16_384;

function unavailable(cause) {
  return new AIServiceError(
    'ai/server-unavailable',
    'AI Tutor server configuration is unavailable.',
    { status: 503, cause },
  );
}

function required(environment, name) {
  const value = String(environment[name] ?? '').trim();
  if (!value) throw unavailable();
  return value;
}

export function resolveGoogleWifConfiguration(environment = process.env) {
  let profile;
  try {
    profile = resolveTutorRuntimeProfile(environment);
  } catch (cause) {
    throw unavailable(cause);
  }
  if (!requiresFederatedTutorCredentials(environment)) return null;
  if (!profile) throw unavailable();
  if (environment.FIREBASE_SERVICE_ACCOUNT_JSON) throw unavailable();

  const projectId = required(environment, 'FIREBASE_PROJECT_ID');
  const audience = required(environment, 'GOOGLE_WIF_AUDIENCE');
  const serviceAccountEmail = required(environment, 'GOOGLE_WIF_SERVICE_ACCOUNT_EMAIL');
  const audienceMatch = audience.match(GOOGLE_WIF_AUDIENCE_PATTERN);
  const [, audienceProjectNumber, audiencePoolId, audienceProviderId] = audienceMatch ?? [];
  if (projectId !== profile.projectId
    || serviceAccountEmail !== profile.runtimeServiceAccountEmail
    || !audienceMatch
    || (profile.wif.projectNumber && audienceProjectNumber !== profile.wif.projectNumber)
    || audiencePoolId !== profile.wif.poolId
    || audienceProviderId !== profile.wif.providerId) {
    throw unavailable();
  }

  return Object.freeze({
    projectId,
    audience,
    serviceAccountEmail,
    subjectTokenType: SUBJECT_TOKEN_TYPE,
    tokenUrl: GOOGLE_STS_URL,
    serviceAccountImpersonationUrl: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
    scopes: Object.freeze([GOOGLE_CLOUD_SCOPE]),
  });
}

function assertPlatformToken(token) {
  if (typeof token !== 'string'
    || token.length === 0
    || token.length > MAX_OIDC_TOKEN_LENGTH
    || !JWT_PATTERN.test(token)) {
    throw unavailable();
  }
  return token;
}

export async function readVercelPlatformOidcToken() {
  // The official helper reads Vercel's request context. It intentionally does
  // not inspect the learner-controlled request Authorization header.
  return getVercelOidcToken();
}

function emitDiagnostic(diagnostics, stage, metadata = {}) {
  try { diagnostics?.event?.(stage, metadata); } catch { /* Diagnostics must never alter auth behavior. */ }
}

function safeTokenMetadata(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud].filter(Boolean);
    return Object.freeze({
      tokenPresent: true,
      tokenBytes: Buffer.byteLength(token, 'utf8'),
      issuerHostname: new URL(String(payload.iss)).hostname,
      audienceHash: createHash('sha256').update(JSON.stringify(audience)).digest('hex').slice(0, 16),
      subject: typeof payload.sub === 'string' ? payload.sub.slice(0, 240) : null,
      ownerId: typeof payload.owner_id === 'string' ? payload.owner_id.slice(0, 120) : null,
      projectId: typeof payload.project_id === 'string' ? payload.project_id.slice(0, 120) : null,
      environment: typeof payload.environment === 'string' ? payload.environment.slice(0, 40) : null,
      issuedAt: Number.isFinite(payload.iat) ? payload.iat : null,
      expiresAt: Number.isFinite(payload.exp) ? payload.exp : null,
    });
  } catch {
    return Object.freeze({ tokenPresent: true, tokenBytes: Buffer.byteLength(String(token), 'utf8'), metadataValid: false });
  }
}

function safeGoogleFailure(error) {
  const rawUrl = error?.config?.url ?? error?.response?.config?.url ?? '';
  let operation = 'google-exchange';
  try {
    const parsed = new URL(String(rawUrl));
    if (parsed.hostname === 'sts.googleapis.com') operation = 'sts';
    if (parsed.hostname === 'iamcredentials.googleapis.com') operation = 'impersonation';
  } catch { /* Keep the generic operation. */ }
  const rawReason = error?.response?.data?.error?.status ?? error?.response?.data?.error ?? error?.code;
  const reason = typeof rawReason === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(rawReason) ? rawReason : null;
  return Object.freeze({
    operation,
    errorName: String(error?.name ?? 'Error').slice(0, 80),
    errorCode: typeof error?.code === 'string' || typeof error?.code === 'number' ? String(error.code).slice(0, 80) : null,
    httpStatus: Number(error?.response?.status) || null,
    reason,
  });
}

function normalizedGoogleAccessToken(authClient, diagnostics) {
  return async function getAccessToken() {
    emitDiagnostic(diagnostics, 'wif.sts.start');
    // google-auth-library performs STS and service-account impersonation inside
    // one getAccessToken() call, so both pipeline stages are pending here.
    emitDiagnostic(diagnostics, 'wif.impersonation.start');
    try {
      const result = await authClient.getAccessToken();
      const accessToken = result?.token ?? authClient.credentials?.access_token;
      const expiryDate = Number(authClient.credentials?.expiry_date);
      if (typeof accessToken !== 'string' || !accessToken || !Number.isFinite(expiryDate)) throw new TypeError('Incomplete Google credential.');
      emitDiagnostic(diagnostics, 'wif.sts.success');
      emitDiagnostic(diagnostics, 'wif.impersonation.success');
      return {
        access_token: accessToken,
        expires_in: Math.max(1, Math.floor((expiryDate - Date.now()) / 1_000)),
      };
    } catch (cause) {
      const failure = safeGoogleFailure(cause);
      emitDiagnostic(diagnostics, `wif.${failure.operation}.failure`, failure);
      throw unavailable(cause);
    }
  };
}

export function createVercelGoogleCredentialContext({
  request,
  environment = process.env,
  tokenSource = readVercelPlatformOidcToken,
  IdentityPoolClientClass = IdentityPoolClient,
  diagnostics,
} = {}) {
  const configuration = resolveGoogleWifConfiguration(environment);
  if (!configuration) {
    return Object.freeze({
      mode: 'adc',
      authClient: null,
      firebaseCredential: null,
      async preflight() {},
    });
  }
  if (!request || typeof request !== 'object') throw unavailable();

  const subjectTokenSupplier = Object.freeze({
    async getSubjectToken() {
      emitDiagnostic(diagnostics, 'wif.oidc.start');
      try {
        const token = assertPlatformToken(await tokenSource({ request }));
        emitDiagnostic(diagnostics, 'wif.oidc.success', safeTokenMetadata(token));
        return token;
      } catch (cause) {
        emitDiagnostic(diagnostics, 'wif.oidc.failure', {
          tokenPresent: false,
          errorName: String(cause?.name ?? 'Error').slice(0, 80),
          errorCode: typeof cause?.code === 'string' ? cause.code.slice(0, 80) : null,
        });
        if (cause instanceof AIServiceError) throw cause;
        throw unavailable(cause);
      }
    },
  });

  let authClient;
  try {
    authClient = new IdentityPoolClientClass({
      type: 'external_account',
      audience: configuration.audience,
      subject_token_type: configuration.subjectTokenType,
      token_url: configuration.tokenUrl,
      service_account_impersonation_url: configuration.serviceAccountImpersonationUrl,
      subject_token_supplier: subjectTokenSupplier,
      scopes: configuration.scopes,
    });
    authClient.scopes = configuration.scopes;
  } catch (cause) {
    throw unavailable(cause);
  }

  emitDiagnostic(diagnostics, 'wif.external_account.ready', {
    projectId: configuration.projectId,
    providerAudienceValid: GOOGLE_WIF_AUDIENCE_PATTERN.test(configuration.audience),
    scopeCount: configuration.scopes.length,
    impersonationConfigured: configuration.serviceAccountImpersonationUrl.startsWith('https://iamcredentials.googleapis.com/'),
  });

  const firebaseCredential = Object.freeze({
    getAccessToken: normalizedGoogleAccessToken(authClient, diagnostics),
  });

  return Object.freeze({
    mode: 'wif',
    authClient,
    firebaseCredential,
    subjectTokenSupplier,
    async preflight() {
      await firebaseCredential.getAccessToken();
    },
  });
}
