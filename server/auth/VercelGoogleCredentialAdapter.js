import { IdentityPoolClient } from 'google-auth-library';
import { getVercelOidcToken } from '@vercel/oidc';
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

function normalizedGoogleAccessToken(authClient) {
  return async function getAccessToken() {
    try {
      const result = await authClient.getAccessToken();
      const accessToken = result?.token ?? authClient.credentials?.access_token;
      const expiryDate = Number(authClient.credentials?.expiry_date);
      if (typeof accessToken !== 'string' || !accessToken || !Number.isFinite(expiryDate)) throw new TypeError('Incomplete Google credential.');
      return {
        access_token: accessToken,
        expires_in: Math.max(1, Math.floor((expiryDate - Date.now()) / 1_000)),
      };
    } catch (cause) {
      throw unavailable(cause);
    }
  };
}

export function createVercelGoogleCredentialContext({
  request,
  environment = process.env,
  tokenSource = readVercelPlatformOidcToken,
  IdentityPoolClientClass = IdentityPoolClient,
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
      try {
        return assertPlatformToken(await tokenSource({ request }));
      } catch (cause) {
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

  const firebaseCredential = Object.freeze({
    getAccessToken: normalizedGoogleAccessToken(authClient),
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
