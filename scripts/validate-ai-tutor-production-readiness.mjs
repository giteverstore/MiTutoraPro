import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const REQUIRED_ENVIRONMENT = [
  'AI_PROVIDER', 'AI_MODEL', 'AI_TUTOR_APPROVED_PROVIDER', 'AI_TUTOR_APPROVED_MODEL',
  'HF_TOKEN', 'OPENAI_API_KEY',
  'AI_TUTOR_ENABLED', 'AI_TUTOR_ROLLOUT_PERCENTAGE', 'AI_TUTOR_ROLLOUT_VERSION',
  'AI_TUTOR_ROLLOUT_SALT', 'AI_TUTOR_ALLOWLIST_UIDS',
  'AI_TUTOR_EVALUATION_ENABLED', 'AI_ALLOW_PROCESS_LOCAL_QUOTA',
  'AI_TUTOR_QUOTA_BACKEND', 'AI_TUTOR_QUOTA_DATABASE_ID', 'AI_TUTOR_QUOTA_IDENTITY_SALT',
  'AI_TUTOR_QUOTA_BURST_REQUESTS', 'AI_TUTOR_QUOTA_BURST_WINDOW_SECONDS',
  'AI_TUTOR_QUOTA_SUSTAINED_REQUESTS', 'AI_TUTOR_QUOTA_SUSTAINED_WINDOW_SECONDS',
  'AI_TUTOR_QUOTA_HOURLY_REQUESTS', 'AI_TUTOR_QUOTA_DAILY_REQUESTS',
  'AI_TUTOR_QUOTA_DAILY_INPUT_TOKENS', 'AI_TUTOR_QUOTA_DAILY_OUTPUT_TOKENS',
  'AI_TUTOR_QUOTA_DAILY_COST_MICROS', 'AI_TUTOR_PROVIDER_MAX_INPUT_TOKENS',
  'AI_TUTOR_PROVIDER_INPUT_OVERHEAD_TOKENS', 'AI_TUTOR_INPUT_USD_PER_MILLION_TOKENS',
  'AI_TUTOR_OUTPUT_USD_PER_MILLION_TOKENS', 'FIREBASE_PROJECT_ID',
  'FIREBASE_SERVICE_ACCOUNT_JSON', 'GOOGLE_WIF_AUDIENCE', 'GOOGLE_WIF_SERVICE_ACCOUNT_EMAIL',
];

function fail(message) {
  throw new Error(`AI Tutor production-readiness validation failed: ${message}`);
}

const [example, gitignore, vercelText, rules, apiRoute, clientSource, openAIProvider, tutorPrompt, firebaseAdmin, wifAdapter, quotaFactory, quotaRuntime, infrastructure, architectureIndex] = await Promise.all([
  read('.env.example'), read('.gitignore'), read('vercel.json'), read('firestore.rules'),
  read('api/ai/explain.js'),
  Promise.all([read('src/ai/AITutorClient.js'), read('src/ai/AITutorPanel.jsx'), read('src/ai/AITutorResponse.jsx')]).then((items) => items.join('\n')),
  read('server/ai/OpenAIProvider.js'),
  read('server/ai/tutor/tutorPrompt.js'),
  read('server/firebaseAdminApp.js'),
  read('server/auth/VercelGoogleCredentialAdapter.js'),
  read('server/ai/quota/createTutorQuotaFirestore.js'),
  read('server/ai/tutor/tutorQuota.js'),
  read('docs/architecture/ai-tutor-production-infrastructure.md'),
  read('docs/architecture/README.md'),
]);

const exampleEntries = new Map(example.split(/\r?\n/)
  .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/))
  .filter(Boolean)
  .map((match) => [match[1], match[2]]));

for (const name of REQUIRED_ENVIRONMENT) {
  if (!exampleEntries.has(name)) fail(`.env.example is missing ${name}`);
}

for (const secret of ['HF_TOKEN', 'OPENAI_API_KEY', 'FIREBASE_SERVICE_ACCOUNT_JSON', 'AI_TUTOR_ROLLOUT_SALT', 'AI_TUTOR_QUOTA_IDENTITY_SALT']) {
  if (exampleEntries.get(secret) !== '') fail(`${secret} must remain an empty placeholder`);
}

if (exampleEntries.get('AI_TUTOR_ENABLED') !== 'false') fail('AI_TUTOR_ENABLED must default to false');
if (exampleEntries.get('AI_TUTOR_ROLLOUT_PERCENTAGE') !== '0') fail('rollout must default to zero percent');
if (exampleEntries.get('AI_TUTOR_EVALUATION_ENABLED') !== 'false') fail('live evaluation must default to disabled');
if (exampleEntries.get('AI_ALLOW_PROCESS_LOCAL_QUOTA') !== 'false') fail('process-local quota must default to disabled');
if (exampleEntries.get('AI_TUTOR_QUOTA_DATABASE_ID') !== 'ai-tutor-quota') fail('quota database must be pinned to ai-tutor-quota');
if (/^VITE_(?:AI|HF|OPENAI|FIREBASE_SERVICE_ACCOUNT)/m.test(example)) fail('server AI/Admin secrets must not use VITE_ names');
if (!/^\.env$/m.test(gitignore) || !/^\.env\.\*$/m.test(gitignore) || !/^!\.env\.example$/m.test(gitignore)) fail('environment ignore rules are incomplete');

let vercel;
try { vercel = JSON.parse(vercelText); } catch { fail('vercel.json is malformed'); }
const functionConfig = vercel.functions?.['api/ai/explain.js'];
if (functionConfig?.supportsCancellation !== true) fail('the AI endpoint must opt into deployed cancellation');
if (!Number.isInteger(functionConfig?.maxDuration) || functionConfig.maxDuration <= 45) fail('the Vercel duration must exceed the provider deadline');

if (/match\s+\/aiTutor(?:Quotas|QuotaReservations)/.test(rules)) fail('quota collections must not be exposed through browser rules');
if (!apiRoute.includes('firebaseAITutorAuthenticator') || !apiRoute.includes('createHttpRequestLifecycle') || !apiRoute.includes('explainCode')) fail('the production API route is missing an enforcement boundary');
if (/HuggingFaceProvider|OpenAIProvider|HF_TOKEN|OPENAI_API_KEY|server\/ai/.test(clientSource)) fail('browser AI code crosses the server provider boundary');
if (!openAIProvider.includes('store: false')) fail('the OpenAI Responses request must disable application-state storage');
if (!openAIProvider.includes("type: 'json_schema'") || !openAIProvider.includes('TUTOR_PROVIDER_RESPONSE_SCHEMA')) fail('the OpenAI adapter must request the canonical strict response schema');
if (/sourceSnapshot|assessmentPolicy|allowedHintLevel/.test(tutorPrompt)) fail('the provider learner-data envelope includes unnecessary internal policy or snapshot fields');
if (!clientSource.includes('External AI receives relevant code and may be incorrect')) fail('the learner disclosure must identify external processing and AI fallibility before request controls');
if (!firebaseAdmin.includes('resolveFirebaseAdminConfiguration')
  || !firebaseAdmin.includes('createRequestFirebaseApp')
  || !firebaseAdmin.includes('if (isProductionEnvironment(environment) && serialized)')
  || !firebaseAdmin.includes("environment.NODE_ENV === 'production'")) {
  fail('Firebase Admin must require a production project pin, request credential, and reject service-account JSON');
}
if (!wifAdapter.includes("from '@vercel/oidc'")
  || !wifAdapter.includes("from 'google-auth-library'")
  || !wifAdapter.includes('subject_token_supplier')
  || !wifAdapter.includes('service_account_impersonation_url')
  || !wifAdapter.includes('getVercelOidcToken')
  || /request\?*\.headers|VERCEL_OIDC_TOKEN/.test(wifAdapter)) {
  fail('the production WIF adapter is missing or crosses the platform/learner-token boundary');
}
if (!quotaFactory.includes("from '@google-cloud/firestore'")
  || !quotaFactory.includes('createTutorQuotaFirestoreConfiguration')
  || !quotaFactory.includes('databaseId: configuration.databaseId')
  || !quotaFactory.includes('authClient')) {
  fail('quota persistence must use the explicit named @google-cloud/firestore client with WIF auth injection');
}
if (/firebase-admin\/firestore|getFirestore\s*\(/.test(`${quotaFactory}\n${quotaRuntime}`)) {
  fail('quota persistence must not use Firebase Admin Firestore or an implicit default database');
}
if (!quotaRuntime.includes('createTutorQuotaFirestore')) fail('the quota guard is not connected to the named database factory');

for (const heading of [
  '## 3. Environment contract', '## 4. Firebase Admin', '## 5. Firestore quota',
  '## 6. IAM', '## 7. TTL', '## 9. Billing protection', '## 10. Telemetry',
  '## 11. Monitoring', '## 12. Feature gate', '## 13. Vercel runtime',
  '## 14. Deployment order', '## 15. Rollback', '## 16. Failure modes',
  '## 17. Load-test plan', '## 18. Deployed verification plan', '## 19. Canary plan',
  '## 20. External action register', '## 21. Security boundaries', '## 22. Remaining gates',
]) {
  if (!infrastructure.includes(heading)) fail(`production infrastructure documentation is missing ${heading}`);
}
if (!architectureIndex.includes('(ai-tutor-production-infrastructure.md)')) fail('architecture index is missing the production infrastructure document');

console.log(JSON.stringify({
  environmentTemplate: 'complete',
  featureDefault: 'disabled',
  serverSecrets: 'not VITE-exposed',
  vercelCancellation: 'configured',
  vercelMaxDurationSeconds: functionConfig.maxDuration,
  quotaBrowserAccess: 'default-deny',
  apiEnforcementChain: 'present',
  clientProviderIsolation: 'passed',
  openAIResponseStorage: 'disabled',
  openAIStructuredOutput: 'required',
  providerDataMinimization: 'passed',
  learnerDisclosure: 'present',
  firebaseAdminProjectPin: 'required',
  productionCredential: 'Vercel OIDC -> Google WIF',
  quotaDatabase: 'ai-tutor-quota',
  quotaDefaultFallback: 'prohibited',
  infrastructurePlan: 'complete',
}, null, 2));
