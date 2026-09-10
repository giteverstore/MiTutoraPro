import process from 'node:process';
import { loadEnv } from 'vite';
import { createAIProvider } from '../server/ai/createAIProvider.js';
import { AdversarialEvaluationHarness } from '../server/ai/evaluation/AdversarialEvaluationHarness.js';
import { explainCode } from '../server/ai/explainHandler.js';
import { TrustedActivityPolicyResolver } from '../server/ai/tutor/tutorActivityPolicy.js';
import { TutorFeatureGate } from '../server/ai/tutor/tutorFeatureGate.js';
import { ProcessLocalTutorQuotaStore, TutorQuotaGuard } from '../server/ai/tutor/tutorQuota.js';
import { createTutorPricingConfiguration, createTutorProviderConfiguration, createTutorProviderTokenConstraints } from '../server/ai/tutor/tutorRuntimeConfig.js';
import { TUTOR_POLICY_VERSION } from '../server/ai/tutor/tutorConfig.js';
import { assertCompletePhase32EvaluationMatrix, PHASE_32_EXACT_MODEL_CASES, PHASE_32_DETERMINISTIC_CASES } from '../server/ai/evaluation/Phase32EvaluationMatrix.js';
import { createBoundedEvaluationProvider, createBoundedEvaluationQuotaPolicy } from '../server/ai/evaluation/evaluationRuntime.js';

const environment = { ...process.env, ...loadEnv('development', process.cwd(), '') };

if (environment.AI_TUTOR_EVALUATION_ENABLED !== 'true') {
  throw new Error('Controlled evaluation is disabled. Set AI_TUTOR_EVALUATION_ENABLED=true explicitly.');
}

const configuration = createTutorProviderConfiguration(environment);
const pricing = createTutorPricingConfiguration(environment);
const providerTokenConstraints = createTutorProviderTokenConstraints(environment);
const hasCredential = configuration.provider === 'openai' ? Boolean(environment.OPENAI_API_KEY) : Boolean(environment.HF_TOKEN);
if (!hasCredential) throw new Error('The configured provider credential is unavailable.');

const coverage = assertCompletePhase32EvaluationMatrix();
const scenarios = PHASE_32_EXACT_MODEL_CASES;

const featureGate = new TutorFeatureGate({ enabled: true, rolloutPercentage: 100, rolloutSalt: 'synthetic-evaluation', version: 'phase-3-evaluation' });
const evaluationRequestLimit = PHASE_32_EXACT_MODEL_CASES.length;
const quotaGuard = new TutorQuotaGuard({
  localStore: new ProcessLocalTutorQuotaStore(),
  allowProcessLocal: true,
  policy: createBoundedEvaluationQuotaPolicy(evaluationRequestLimit),
  identitySalt: 'synthetic-evaluation',
});
const activityPolicyResolver = new TrustedActivityPolicyResolver();
const harness = new AdversarialEvaluationHarness();
const provider = createAIProvider(environment);
const boundedProvider = createBoundedEvaluationProvider(provider, evaluationRequestLimit);
const results = await harness.run(scenarios, (scenario) => explainCode(scenario.request, {
  principal: { uid: 'synthetic-evaluation-user' },
  featureGate,
  quotaGuard,
  activityPolicyResolver,
  pricing,
  providerTokenConstraints,
  providerFactory: () => boundedProvider,
}), { ...configuration, policyVersion: TUTOR_POLICY_VERSION });

if (results.some((result) => result.classification === 'ai/rate-limited')) {
  throw new Error('Exact-model evaluation was blocked by its process-local quota configuration.');
}

const summary = {
  provider: configuration.provider,
  model: configuration.model,
  policyVersion: TUTOR_POLICY_VERSION,
  scenarios: results.length,
  passed: results.filter((result) => result.passed).length,
  failed: results.filter((result) => !result.passed).length,
  providerRequests: boundedProvider.getRequestCount(),
  coverage,
  deterministicPreflight: {
    cases: PHASE_32_DETERMINISTIC_CASES.length,
    command: 'npm run test:ai-tutor',
    status: 'must-pass-before-live-evaluation',
  },
  results,
};
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (summary.failed) process.exitCode = 1;
