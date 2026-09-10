import { AIServiceError } from '../AIServiceError.js';

const SUPPORTED_PROVIDERS = new Set(['openai', 'huggingface']);
export const APPROVED_FIREBASE_PROJECT_ID = 'mi-tutora-pro';
export const APPROVED_TUTOR_QUOTA_DATABASE_ID = 'ai-tutor-quota';
export const APPROVED_VALIDATION_FIREBASE_PROJECT_ID = 'mi-tutora-ai-val-260904-k7m3';
export const APPROVED_VALIDATION_TUTOR_QUOTA_DATABASE_ID = 'ai-tutor-quota-validation';
const FIRESTORE_DATABASE_ID_PATTERN = /^[a-z][a-z0-9-]{2,61}[a-z0-9]$/;

export const TUTOR_RUNTIME_PROFILES = Object.freeze({
  production: Object.freeze({
    boundary: 'production',
    projectId: APPROVED_FIREBASE_PROJECT_ID,
    quotaDatabaseId: APPROVED_TUTOR_QUOTA_DATABASE_ID,
    runtimeServiceAccountEmail: `ai-tutor-runtime@${APPROVED_FIREBASE_PROJECT_ID}.iam.gserviceaccount.com`,
    vercelEnvironment: 'production',
    wif: Object.freeze({
      projectNumber: '196429461457',
      poolId: 'ai-tutor-vercel',
      providerId: 'vercel-production',
    }),
  }),
  validation: Object.freeze({
    boundary: 'validation',
    projectId: APPROVED_VALIDATION_FIREBASE_PROJECT_ID,
    quotaDatabaseId: APPROVED_VALIDATION_TUTOR_QUOTA_DATABASE_ID,
    runtimeServiceAccountEmail: `ai-tutor-validation-runtime@${APPROVED_VALIDATION_FIREBASE_PROJECT_ID}.iam.gserviceaccount.com`,
    vercel: Object.freeze({
      issuer: 'https://oidc.vercel.com/avinashabbigeris-projects',
      audience: 'https://vercel.com/avinashabbigeris-projects',
      teamSlug: 'avinashabbigeris-projects',
      teamId: 'team_JWeTI30xjnERJbMpLUkgTpzV',
      projectName: 'mi-tutora-pro-ai-validation',
      projectId: 'prj_MXRcPMPyTAtqbfHJbFote2I3bRAD',
      environment: 'preview',
      subject: 'owner:avinashabbigeris-projects:project:mi-tutora-pro-ai-validation:environment:preview',
    }),
    wif: Object.freeze({
      // Google assigns the numeric project identifier when the separately
      // authorized validation project is created. The immutable pool/provider
      // names and exact service account remain pinned here; IAM must bind only
      // that created pool's exact subject before a deployment is permitted.
      projectNumber: null,
      poolId: 'ai-tutor-vercel-validation',
      providerId: 'vercel-validation-preview',
    }),
  }),
});

function productionEnvironment(environment) {
  const vercelEnvironment = String(environment.VERCEL_ENV ?? '').trim();
  if (vercelEnvironment) return vercelEnvironment === 'production';
  return environment.NODE_ENV === 'production';
}

export function isVercelDeployedTutorEnvironment(environment = process.env) {
  const vercelEnvironment = String(environment.VERCEL_ENV ?? '').trim();
  return vercelEnvironment !== '' && vercelEnvironment !== 'development';
}

export function resolveTutorRuntimeProfile(environment = process.env) {
  const configuredBoundary = String(environment.AI_TUTOR_RUNTIME_BOUNDARY ?? '').trim().toLowerCase();
  const vercelEnvironment = String(environment.VERCEL_ENV ?? '').trim();
  const boundary = configuredBoundary || (productionEnvironment(environment) ? 'production' : '');

  if (!boundary) {
    if (isVercelDeployedTutorEnvironment(environment)) {
      throw new AIServiceError('ai/not-configured', 'AI Tutor runtime boundary is not configured.', { status: 503 });
    }
    return null;
  }

  const profile = TUTOR_RUNTIME_PROFILES[boundary];
  if (!profile) {
    throw new AIServiceError('ai/not-configured', 'AI Tutor runtime boundary is not approved.', { status: 503 });
  }
  if (productionEnvironment(environment) && boundary !== 'production') {
    throw new AIServiceError('ai/not-configured', 'AI Tutor runtime boundary does not match the deployment.', { status: 503 });
  }
  const approvedVercelEnvironment = profile.vercel?.environment ?? profile.vercelEnvironment;
  if (isVercelDeployedTutorEnvironment(environment)
    && vercelEnvironment !== approvedVercelEnvironment) {
    throw new AIServiceError('ai/not-configured', 'AI Tutor runtime boundary does not match the deployment.', { status: 503 });
  }
  return profile;
}

export function isManagedTutorRuntime(environment = process.env) {
  return resolveTutorRuntimeProfile(environment) !== null;
}

export function requiresFederatedTutorCredentials(environment = process.env) {
  return isManagedTutorRuntime(environment)
    && (productionEnvironment(environment) || isVercelDeployedTutorEnvironment(environment));
}

function required(value, label) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new AIServiceError('ai/not-configured', `AI Tutor ${label} is not configured.`, { status: 503 });
  return normalized;
}

function positiveInteger(value, label, fallback, { requiredInProduction = true, environment } = {}) {
  if ((value == null || value === '') && !isManagedTutorRuntime(environment)) return fallback;
  if ((value == null || value === '') && !requiredInProduction) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AIServiceError('ai/not-configured', `AI Tutor ${label} is invalid.`, { status: 503 });
  }
  return parsed;
}

function optionalNonNegativeNumber(value, label) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new AIServiceError('ai/not-configured', `AI Tutor ${label} is invalid.`, { status: 503 });
  }
  return parsed;
}

function nonNegativeInteger(value, label, fallback, { requiredInProduction = true, environment } = {}) {
  if ((value == null || value === '') && !isManagedTutorRuntime(environment)) return fallback;
  if ((value == null || value === '') && !requiredInProduction) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new AIServiceError('ai/not-configured', `AI Tutor ${label} is invalid.`, { status: 503 });
  }
  return parsed;
}

function decimalUsdToMicros(value, label) {
  if (value == null || value === '') return null;
  const normalized = String(value).trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(normalized)) {
    throw new AIServiceError('ai/not-configured', `AI Tutor ${label} is invalid.`, { status: 503 });
  }
  const [whole, fraction = ''] = normalized.split('.');
  const micros = (BigInt(whole) * 1_000_000n) + BigInt(fraction.padEnd(6, '0'));
  if (micros > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new AIServiceError('ai/not-configured', `AI Tutor ${label} is invalid.`, { status: 503 });
  }
  return Number(micros);
}

export function createTutorProviderConfiguration(environment = process.env) {
  const provider = required(environment.AI_PROVIDER, 'provider').toLowerCase();
  const model = required(environment.AI_MODEL, 'model');
  if (!SUPPORTED_PROVIDERS.has(provider)) {
    throw new AIServiceError('ai/provider-unsupported', 'The configured AI Tutor provider is not supported.', { status: 503 });
  }
  if (isManagedTutorRuntime(environment)) {
    const approvedProvider = required(environment.AI_TUTOR_APPROVED_PROVIDER, 'approved provider').toLowerCase();
    const approvedModel = required(environment.AI_TUTOR_APPROVED_MODEL, 'approved model');
    if (provider !== approvedProvider || model !== approvedModel) {
      throw new AIServiceError('ai/provider-not-approved', 'The configured AI Tutor provider is not approved.', { status: 503 });
    }
  }
  return Object.freeze({ provider, model });
}

export function createTutorQuotaPolicy(environment = process.env) {
  return Object.freeze({
    burst: Object.freeze({
      requests: positiveInteger(environment.AI_TUTOR_QUOTA_BURST_REQUESTS, 'burst request limit', 6, { environment }),
      windowMs: positiveInteger(environment.AI_TUTOR_QUOTA_BURST_WINDOW_SECONDS, 'burst window', 10, { environment }) * 1_000,
    }),
    sustained: Object.freeze({
      requests: positiveInteger(environment.AI_TUTOR_QUOTA_SUSTAINED_REQUESTS, 'sustained request limit', 30, { environment }),
      windowMs: positiveInteger(environment.AI_TUTOR_QUOTA_SUSTAINED_WINDOW_SECONDS, 'sustained window', 60, { environment }) * 1_000,
    }),
    hourly: Object.freeze({
      requests: positiveInteger(environment.AI_TUTOR_QUOTA_HOURLY_REQUESTS, 'hourly request limit', 60, { environment }),
      windowMs: 3_600_000,
    }),
    daily: Object.freeze({
      requests: positiveInteger(environment.AI_TUTOR_QUOTA_DAILY_REQUESTS, 'daily request limit', 100, { environment }),
      inputTokens: positiveInteger(environment.AI_TUTOR_QUOTA_DAILY_INPUT_TOKENS, 'daily input-token limit', 250_000, { environment }),
      outputTokens: positiveInteger(environment.AI_TUTOR_QUOTA_DAILY_OUTPUT_TOKENS, 'daily output-token limit', 60_000, { environment }),
      costMicros: optionalNonNegativeNumber(environment.AI_TUTOR_QUOTA_DAILY_COST_MICROS, 'daily cost limit'),
    }),
  });
}

export function createTutorPricingConfiguration(environment = process.env) {
  const inputMicrosPerMillion = decimalUsdToMicros(environment.AI_TUTOR_INPUT_USD_PER_MILLION_TOKENS, 'input-token pricing');
  const outputMicrosPerMillion = decimalUsdToMicros(environment.AI_TUTOR_OUTPUT_USD_PER_MILLION_TOKENS, 'output-token pricing');
  const known = inputMicrosPerMillion != null && outputMicrosPerMillion != null;
  if (environment.AI_TUTOR_QUOTA_DAILY_COST_MICROS != null
    && environment.AI_TUTOR_QUOTA_DAILY_COST_MICROS !== '' && !known) {
    throw new AIServiceError('ai/not-configured', 'AI Tutor pricing is required when a monetary quota is configured.', { status: 503 });
  }
  return Object.freeze({ inputMicrosPerMillion, outputMicrosPerMillion, known });
}

export function createTutorProviderTokenConstraints(environment = process.env) {
  return Object.freeze({
    maxInputTokens: positiveInteger(environment.AI_TUTOR_PROVIDER_MAX_INPUT_TOKENS, 'provider maximum input tokens', 128_000, { environment }),
    inputOverheadTokens: nonNegativeInteger(environment.AI_TUTOR_PROVIDER_INPUT_OVERHEAD_TOKENS, 'provider input overhead tokens', 256, { environment }),
  });
}

export function createTutorQuotaFirestoreConfiguration(environment = process.env) {
  const projectId = required(
    environment.FIREBASE_PROJECT_ID || environment.GCLOUD_PROJECT,
    'Firebase project ID',
  );
  const databaseId = required(environment.AI_TUTOR_QUOTA_DATABASE_ID, 'quota database ID');
  if (databaseId === '(default)' || !FIRESTORE_DATABASE_ID_PATTERN.test(databaseId)) {
    throw new AIServiceError('ai/not-configured', 'AI Tutor quota database configuration is invalid.', { status: 503 });
  }
  const profile = resolveTutorRuntimeProfile(environment);
  if (profile && (projectId !== profile.projectId || databaseId !== profile.quotaDatabaseId)) {
    throw new AIServiceError('ai/not-configured', 'AI Tutor quota database configuration is not approved.', { status: 503 });
  }
  return Object.freeze({ projectId, databaseId });
}

export function isProductionTutorEnvironment(environment = process.env) {
  return resolveTutorRuntimeProfile(environment)?.boundary === 'production';
}
