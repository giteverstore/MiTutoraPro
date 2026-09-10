# AI Tutor Production Readiness

This document separates the locally implemented Phase 3 controls from production resources that do not yet exist. It is an engineering readiness checklist, not legal advice and not evidence that the AI Tutor is enabled in production.

The Phase 4.6 provisioning sequence, environment inventory, failure matrix, rollback procedure, and canary plan are maintained in [AI Tutor production infrastructure](ai-tutor-production-infrastructure.md).

## Readiness states

| State | Meaning |
| --- | --- |
| Implemented locally | Code and deterministic tests exist in the repository. |
| Requires production configuration | Server-only values must be reviewed and configured before deployment. |
| Requires external infrastructure | A datastore, telemetry destination, or monitoring platform must be provisioned separately. |
| Requires human/legal review | A product, privacy, security, or legal owner must make and record the decision. |
| Future hardening | Deliberately excluded from the initial Level-1 hints-only release. |

## Distributed quota architecture

Phase 3 selects a Firestore transaction adapter behind `TutorQuotaStore`. The choice reuses the project's existing Firebase Admin identity, avoids adding an unprovisioned Redis/KV vendor, works from Vercel serverless functions, and provides atomic multi-document transactions. `ProcessLocalTutorQuotaStore` remains deterministic local/test infrastructure and is never a production fallback.

The server derives a stable HMAC identity from `request.auth`/verified Firebase UID and `AI_TUTOR_QUOTA_IDENTITY_SALT`. Raw UID is not used as a document ID or telemetry field. The client cannot provide an authoritative identity.

Proposed server-only documents:

```text
aiTutorQuotas/{hmacUid}
aiTutorQuotaReservations/{requestId}
```

The quota document contains resettable burst, sustained, hourly, and UTC-day counters plus committed/reserved input tokens, output tokens, and known cost. Each valid request has three distinct usage values: an ordinary estimate for observability, a conservative authorization maximum, and actual provider-reported usage at settlement. The reservation transaction checks every hard ceiling against the authorization maximum, increments request counters, reserves that maximum, and creates an idempotency record. Settlement atomically releases unused capacity and records actual usage when it is complete and within the authorization. Missing or contradictory usage consumes the conservative maximum. A failed settlement leaves capacity reserved and therefore fails safe rather than allowing overspend.

The input authorization maximum is derived from the exact bounded outbound system/user content, a reviewed provider protocol-overhead allowance, and the configured exact-model input ceiling. UTF-8 byte length is used as the conservative text-token bound; provider overhead and maximum input tokens are explicit server configuration rather than arbitrary multipliers. Output authorization is bounded by the server-owned provider output ceiling. A request is never authorized when its cumulative worst-case input, output, or known cost would exceed the remaining daily budget. Concurrent requests reserve their maxima in the same per-user transaction, so cumulative in-flight authorization remains within the ceiling.

Monetary arithmetic uses integer micro-units. When a daily monetary ceiling is configured, both approved input and output rates must be present or production configuration fails closed. This is a hard authorization ceiling for the configured token rates; it is not a guarantee about a provider invoice containing unreported fees, provider rounding, taxes, or billing dimensions absent from the API contract. Those require provider review and provider-side billing alerts/budgets. Without a configured monetary ceiling, unknown cost remains explicitly unknown while token ceilings continue to apply.

Malformed, sensitive, and policy-rejected requests consume request quota through a zero-provider-usage reservation. Token/cost capacity is not charged when no provider was invoked. Provider failures, timeouts, and cancellations consume request quota and conservatively consume the authorized maximum when actual usage is unavailable.

Each successful request normally requires two Firestore reads and two writes to reserve, then two reads and two writes to settle; Firestore may retry transactions under contention. Contention is isolated per hashed user rather than a global counter. Reservation documents contain an `expiresAt` value for a future Firestore TTL policy. Pricing is configuration-driven; cost remains `unknown` unless both input and output rates are supplied. No pricing is embedded in source.

Production provisioning remains pending. It requires collection creation through first server writes, narrowly scoped Admin IAM, TTL configuration for `aiTutorQuotaReservations.expiresAt`, budget review, and production load testing.

## Feature gate and provider lock

`TutorFeatureGate` is disabled by default. It evaluates only verified server UID, a server allowlist, a server rollout percentage, rollout version, and a server salt. A learner request cannot enable the feature or select its rollout bucket. A disabled decision occurs before quota or provider construction and returns `ai/disabled` without Retry.

The Production smoke-test exception is a separate, request-scoped wrapper around that gate. It is inactive unless the global gate is exactly disabled and every Production binding passes: Vercel Production, runtime boundary `production`, Firebase project `mi-tutora-pro`, named quota database `ai-tutor-quota`, the approved provider/model, a configured synthetic UID, and a 256-bit-or-stronger server secret. A compact HMAC authorization is bound to that UID, the exact JSON request digest, a cryptographically random nonce, and a maximum five-minute lifetime. The nonce has a corresponding `READY` record in the server-only `aiTutorSmokeAuthorizations` collection of the existing quota database. After Firebase ID-token verification, the request consumes that record transactionally; only the transaction winner receives `smoke-authorized`. Missing, malformed, expired, mismatched, or replayed authorizations fail as ordinary `ai/disabled` decisions without reaching quota or the provider. When the normal feature is enabled, smoke authorization is ignored and normal rollout rules remain authoritative.

Provisioning is intentionally offline and is not exposed by an HTTP route. An authorized operator must generate the Production secret and nonce with a cryptographically secure source, create one synthetic Firebase Auth identity, set the exact synthetic UID as protected server configuration, and use `createTutorSmokeAuthorization()` with the exact bounded request body. The helper returns the signed marker and the corresponding non-secret Firestore record; an administrative identity creates that single record in `ai-tutor-quota`. The marker is held only in the controlled smoke runner and sent once through `x-ai-tutor-smoke-authorization` alongside the genuine Firebase ID token. The application browser never receives the smoke secret or marker-generation capability. After the run, the synthetic Auth identity and dedicated configuration are removed under separate authorization; the consumed record may remain as bounded audit evidence or be deleted by the administrative cleanup process. No learner path, alternate quota path, alternate provider path, or alternate release policy exists.

Production provider configuration must make `AI_PROVIDER`/`AI_MODEL` exactly equal to `AI_TUTOR_APPROVED_PROVIDER`/`AI_TUTOR_APPROVED_MODEL`. Missing or mismatched production configuration fails closed. Endpoint, credentials, token ceiling, policy, response schema, and instructions remain server-owned.

The initial release policy remains Level 1 hints-only for every activity, including trusted lessons. Complete-solution release requires a future policy version with an explicitly reviewed server capability; the current resolver cannot enable it.

## Telemetry and usage accounting

`TutorTelemetry` accepts only primitive allowlisted operational fields. The structured adapter can forward events to a future monitoring destination; the default sink remains no-op. Allowed data includes behavior versions, operation, approved provider/model, latency, sanitized outcome/error classification, response size, token counts, known estimated cost, quota decision, and rollout state/version.

It cannot accept code, selected code, compiler output, prompts, model responses, tokens, cookies, UID, email, content titles, or raw request/response bodies. Sink failures are swallowed and emit only a fixed `telemetry-pipeline-failure` alert signal. They never bypass request, provider-response, or release-policy validation.

`InMemoryTutorAlertEvaluator` is a deterministic reference implementation for provider failures, HTTP 5xx, quota exhaustion, unusual volume, latency, unsafe responses, timeouts, known cost threshold, and telemetry failure. Production monitoring must perform the same rolling aggregation in its durable platform; no notification channel or alert currently exists.

## Controlled model evaluation

`AdversarialEvaluationHarness` records only provider/model/policy version, scenario ID/category, expected and observed policy outcomes, sanitized classification, pass/fail, and latency. Prompts and responses are never part of results.

`npm run evaluate:ai-tutor` is opt-in and refuses to run unless `AI_TUTOR_EVALUATION_ENABLED=true` and the configured provider credential exists. It uses synthetic code only. The Phase 3.2 matrix has unique cases for prompt injection, solution leakage, sensitive content, compiler evidence, bounded response structure, provider failures, policy escalation, client bypasses, feature gating, and hard quota behavior. Exact-model cases use semantic pass/fail classifiers and accept either a safe bounded response or a server release-gate rejection. Result records contain only case/category, expected and observed policy result, pass/fail, provider/model, sanitized error category, latency, and response size.

Deterministic CI covers secret boundaries, evidence normalization, schema/parser limits, mocked transport failures, policy levels, ignored client controls, rollout decisions, and quota invariants. Provider 429/408/5xx, connection, timeout, cancellation, malformed response, and empty response are mocked because intentionally causing them against a live provider is neither deterministic nor safe. Live evaluation is limited to synthetic prompt-injection and leakage behavior against the exact approved provider/model. Mocked tests validate code boundaries but cannot prove future model behavior.

The exact production provider/model must pass all exact-model cases before rollout, while the deterministic preflight must be green in the same revision. A provider/model, system policy, release policy, or schema version change requires re-evaluation. Live exact-model evaluation remains pending until separately authorized.

### Phase 3.3 temporary-provider evidence

Hugging Face is a temporary test provider, not a production-provider commitment. Phase 4.1 recommends OpenAI GPT-5.4 Mini as the eventual primary candidate and Anthropic Claude Sonnet 5 as a backup candidate, but neither is production-approved or configured. The controlled test-provider run used `huggingface` with `openai/gpt-oss-120b:fastest`: 17 exact-model cases were attempted, eight produced usable model responses, and nine were rejected by the provider before a usable response existed. No automatic retries occurred and no security failure was observed. The eight received responses passed the server release boundary, so server enforcement passed for the observed paths. The model-behavior result remains inconclusive because provider failures cannot substitute for behavioral coverage.

This partial result does not block provider-independent code readiness. It does block production readiness from being inferred from the temporary model. When the production provider/model is selected, the same revision must rerun all 17 exact-model behavioral cases alongside deterministic coverage for prompt injection, solution leakage, sensitive content, compiler evidence, policy escalation, response safety, provider failure handling, client bypasses, feature gating, and quota enforcement. The production model must return enough usable responses to complete the behavioral matrix. Changing provider, model, system policy, release policy, or response schema invalidates prior exact-model evidence.

The evaluation harness, cases, assertions, request policy, schema validation, release policy, sensitive-content inspection, evidence validation, quota, and feature gate are provider-independent. Provider adapters implement only `AIProvider`, transport formatting, authentication, cancellation/timeout handling, and response/usage normalization. The runner selects the adapter and model through server configuration, so a future adapter can implement the existing interface without changing Tutor policy or the evaluation matrix.

Provider diagnostics retain only stable sanitized categories. Authentication, rate limiting, timeout, unavailability, provider rejection, malformed/empty responses, refusals, and unknown provider failures remain distinguishable without retaining provider bodies, prompts, responses, source code, compiler output, credentials, identity, or arbitrary error text. An otherwise-unmapped provider HTTP 4xx is classified as `ai/provider-rejected`; the numeric provider status and response body are not exposed or persisted.

## Privacy and provider checklist

Phase 4.5 completed the local technical provider/privacy audit and is recorded in [AI Tutor provider and privacy gate](ai-tutor-provider-privacy-gate.md). That review confirmed the recommendation and closed local adapter/data-minimization/disclosure gaps; it did not approve provider terms, retention configuration, minors/education use, India DPDP interpretation, or production processing.

The following require recorded human review before production enablement:

- provider retention period and whether API inputs/outputs are retained;
- whether API data is used for provider training or service improvement;
- subprocessors and data-transfer regions;
- contractual handling of source code and educational data;
- learner disclosure placement, timing, and whether affirmative consent is required;
- deletion/export expectations and incident-response process;
- policy for personal data or third-party code pasted into the editor;
- provider abuse-monitoring retention and access controls;
- whether minors or institution-managed learners require additional controls;
- approval of the exact provider/model, quota, pricing, rollout, and telemetry destinations.

Secret detection is heuristic. It reduces accidental high-confidence disclosure but does not replace learner disclosure, provider review, or organizational policy.

## Failure and rollback contract

| Failure | Required behavior |
| --- | --- |
| Feature OFF/outside rollout | `ai/disabled`; no quota or provider invocation; no Retry. |
| Quota backend unavailable | Fail closed with `ai/quota-unavailable`; provider not constructed. |
| Telemetry unavailable | Tutor safety flow continues; fixed sanitized pipeline alert only. |
| Provider unavailable/429/5xx | Sanitized typed response; one explicit learner Retry where classified retryable. |
| Provider timeout | Abort at the provider deadline and return a sanitized retryable timeout. |
| Unsafe/malformed response | Never render; non-retry unsafe outcome or bounded malformed-response retry classification. |
| Client cancellation/disconnect | Propagate abort when supported; never announce cancellation as an error. |
| Unexpected exception | Generic sanitized error; no internal details or learner content. |

Production rollout should deploy with the gate OFF, validate auth/quota/telemetry using synthetic traffic, enable an internal allowlist, then use a small deterministic percentage. Rollback is the server gate OFF first, followed by deployment rollback if required. Disabling the gate stops new provider calls without waiting for a frontend release.

## Outstanding production work

- Provision Firestore quota collections/TTL and validate IAM/load behavior.
- Connect a structured telemetry destination and durable alert aggregation.
- Create cost, failure, latency, timeout, quota, unsafe-response, and pipeline alerts with a verified notification channel.
- Configure server-only secrets and reviewed quota/pricing values.
- Complete exact-model controlled evaluation.
- Obtain provider/account confirmation and complete human privacy/legal/product review.
- Keep the gate disabled until every preceding item is approved.

## Phase 4.3 technical readiness audit

The Phase 4.3 source and deterministic-test audit found no known route around authentication, the server feature gate, quota, activity/hint policy, sensitive-content inspection, compiler/selection evidence, response schema validation, release policy, client validation, or telemetry allowlisting. Browser code has no provider import or AI credential, and the only application AI endpoint is `/api/ai/explain`. Provider output is never rendered directly.

One quota idempotency defect was corrected. Reservation IDs are now bound to the HMAC identity, ordinary estimate, and worst-case authorization maximum. Reusing an ID with an identical binding returns the existing reservation without a second charge; reusing it with a different identity or usage envelope returns non-retryable `ai/idempotency-conflict` and leaves quota state unchanged. Firestore settlement remains idempotent, unavailable usage remains conservatively charged, and production still fails closed without the distributed backend.

Additional deterministic coverage closes the audit gaps for empty successful output, timeouts, Java compilation diagnostics, Unicode source, multiline selection, exact rollout boundaries, kill switch, incomplete provider/model configuration, invalid token limits, and conflicting/concurrent reservation IDs. The wider matrix continues to cover the required Python/Java, injection, leakage, secret, malformed-response, provider-failure, quota, feature, duplicate-request, cancellation, UI, and accessibility states.

### Phase 4.3 classification

- **Technical readiness:** ready for the remaining external production gates; no known technical security bypass remains in the audited path.
- **Production readiness:** not ready.
- **Test provider:** Hugging Face / `openai/gpt-oss-120b:fastest`; prior evidence remains eight usable responses and nine provider rejections, so model behavior is inconclusive.
- **Eventual primary candidate:** OpenAI GPT-5.4 Mini, ultimately pinned to the evaluated dated snapshot only if it passes; this is a recommendation, not approval.
- **External gates:** exact-model evaluation of the eventual primary and backup, production quota datastore/IAM/TTL/load validation, exact pricing and ceilings, telemetry/alerts with verified delivery, provider account and retention controls, privacy/legal/product approval, deployed-runtime disconnect testing, synthetic canary verification, and explicit rollout approval.

Known limitations remain acceptable only while the server gate is disabled: secret detection is heuristic; source hashes establish consistency rather than hostile-client attestation; deterministic/mock tests do not prove model behavior; serverless disconnect propagation depends on runtime lifecycle events; the trusted activity source is not connected and therefore all activities remain Level 1 hints-only; and no production telemetry destination or quota infrastructure is provisioned.

## Phase 4.4 production infrastructure audit

Phase 4.4 is complete as a local audit and readiness specification. The application can be deployed with the Tutor gate disabled, but the infrastructure required to enable learner traffic is not provisioned. Consequently, **technical infrastructure readiness is NOT READY** and **production readiness is NOT READY**.

### Environment contract

All values below are server-only unless explicitly identified as Firebase browser configuration elsewhere. Secrets must be stored in the deployment platform secret manager and must never use a `VITE_` prefix.

| Group | Variables | Production requirement |
| --- | --- | --- |
| Provider lock | `AI_PROVIDER`, `AI_MODEL`, `AI_TUTOR_APPROVED_PROVIDER`, `AI_TUTOR_APPROVED_MODEL` | Required before enablement; configured and approved pairs must match exactly. Hugging Face remains the local test pair, not the production approval. |
| Provider credential | Selected provider's `HF_TOKEN` or `OPENAI_API_KEY` | Exactly the selected adapter credential is required before provider construction; the unused credential should not be configured without a purpose. |
| Feature release | `AI_TUTOR_ENABLED`, `AI_TUTOR_ROLLOUT_PERCENTAGE`, `AI_TUTOR_ROLLOUT_VERSION`, `AI_TUTOR_ROLLOUT_SALT`, `AI_TUTOR_ALLOWLIST_UIDS` | `AI_TUTOR_ENABLED=false` and percentage `0` are safe defaults. Enabled production requires a private salt; allowlist and percentage are server decisions. |
| Distributed quota | `AI_TUTOR_QUOTA_BACKEND`, `AI_TUTOR_QUOTA_DATABASE_ID`, `AI_TUTOR_QUOTA_IDENTITY_SALT`, all burst/sustained/hourly/daily request and token limits | Required before enablement. Backend must be `firestore`, database must be exactly `ai-tutor-quota`, and identity salt must be private and stable. Production has no process-local or `(default)` database fallback. |
| Monetary quota | `AI_TUTOR_QUOTA_DAILY_COST_MICROS`, `AI_TUTOR_INPUT_USD_PER_MILLION_TOKENS`, `AI_TUTOR_OUTPUT_USD_PER_MILLION_TOKENS` | Optional only as a complete set. A cost ceiling without both reviewed prices fails closed. Token ceilings remain mandatory. |
| Provider envelope | `AI_TUTOR_PROVIDER_MAX_INPUT_TOKENS`, `AI_TUTOR_PROVIDER_INPUT_OVERHEAD_TOKENS` | Required, positive/bounded production values reviewed for the exact provider/model protocol. |
| Google workload identity | `FIREBASE_PROJECT_ID`, `GOOGLE_WIF_AUDIENCE`, `GOOGLE_WIF_SERVICE_ACCOUNT_EMAIL` | Required for revoked-token verification and named-database Firestore transactions. Vercel supplies platform OIDC through server request context. Production rejects serialized service-account JSON and unrelated ADC. |

The repository template contains every variable and empty placeholders for all secrets. `.env` and `.env.*` are ignored while `.env.example` remains tracked. Development retains explicit defaults; production configuration constructors fail closed when an enabled request reaches a missing provider, token constraint, quota, pricing, or Firebase dependency.

### Vercel runtime

`api/ai/explain.js` uses the same Firebase authenticator and `explainCode` enforcement chain as local development. There is no browser-to-provider route and no deployment-time `.env` loader: Vercel supplies server environment variables to the function process. The route now opts into Vercel cancellation and uses a 60-second function ceiling around the 45-second provider deadline. Current Vercel documentation describes function duration as plan/runtime configuration and cancellation as an explicit function option; these settings still require verification against the actual project plan and deployed runtime. See [Vercel function limits](https://vercel.com/docs/functions/limitations), [maximum duration configuration](https://vercel.com/docs/functions/configuring-functions/duration), and the [Functions API reference](https://vercel.com/docs/functions/functions-api-reference).

Cold starts may initialize Firebase Admin, Firestore, and the selected adapter in a new instance. Quota correctness does not depend on instance affinity because authorization is transactional in Firestore. Provider and function concurrency remain external capacity constraints. No automatic provider retry loop exists.

### Firestore quota and security

**IMPLEMENTED LOCALLY:** quota persistence uses a direct server-only `@google-cloud/firestore` client pinned to project `mi-tutora-pro` and named database `ai-tutor-quota`. Firebase Admin remains the authentication client. The database is not provisioned in production; IAM, Rules, TTL, and OIDC/WIF remain Phase 4.7C actions.

- Raw UID is never a document ID; a stable server HMAC derives the quota identity.
- Reservation and settlement are Firestore transactions. Worst-case in-flight usage is reserved before provider invocation.
- Exact duplicate reservations are idempotent; changed identity or usage under the same request ID fails with `ai/idempotency-conflict`.
- Concurrent same-user reservations serialize against one quota document and cannot oversubscribe configured ceilings. Different identities are isolated.
- Missing/contradictory provider usage and provider failures consume the conservative authorized maximum.
- Abandoned reservations remain reserved for the UTC day; the next UTC-day counter starts clean. TTL removes stale reservation documents but is not relied on for authorization correctness.
- Direct document reads/writes need no composite index. `expiresAt` needs a TTL field policy only after separate production approval.
- Missing, invalid, `(default)`, or unapproved production quota database configuration fails closed before a quota store can be used.

The browser requires no access to either quota collection. Existing unmatched Firestore paths are default-denied. Firebase Admin server libraries bypass client Security Rules and are governed by IAM, so rules must not be weakened for this feature. The production runtime needs least-privilege Firestore entity/transaction access and the Firebase Authentication access required for revoked-token verification. Exact role bindings require security-owner review; `roles/datastore.user` is the documented predefined Firestore read/write role, but project-wide scope and combined Auth permissions must be reviewed before assignment. See [Firestore server security](https://firebase.google.com/docs/firestore/security/get-started), [Firestore IAM](https://docs.cloud.google.com/firestore/docs/security/iam), and [TTL policies](https://firebase.google.com/docs/firestore/ttl).

### Telemetry, monitoring, and alerts

The server currently emits an allowlisted `ai_tutor.request` event to a no-op sink. Available safe fields are provider/model, policy/schema versions, operation, latency, success, HTTP status, retryability, sanitized error category, response bytes, token counts, configured estimated cost, quota decision, and rollout state. Code, selection, output, prompt, response, title, UID, email, auth data, cookies, and secrets are not accepted.

The in-memory evaluator proves local alert semantics but is not durable production monitoring. Current and required status:

| Signal | Safe source available | Local evaluator | Production requirement |
| --- | --- | --- | --- |
| Provider failures / HTTP 5xx | Yes | Yes | Durable rate/window alert |
| Provider rate limiting | Yes: `ai/provider-rate-limited` | Generic provider-failure count | Dedicated rate-limit dashboard/alert |
| Quota exhaustion | Yes | Yes | Durable alert and per-rollout review |
| Request volume | Yes | Yes | Durable count/rate dashboard |
| p50/p95 latency | Per-request latency exists | Threshold count only | External histogram/percentile aggregation |
| Unsafe-response blocks | Yes | Yes | High-severity durable alert |
| Provider timeouts | Yes | Yes | Durable timeout-rate alert |
| Cancellation anomalies | Yes: `ai/cancelled` | No dedicated policy | Cancellation-rate baseline and alert |
| Input/output tokens | Yes when provider reports usage | No aggregate dashboard | Durable sums/percentiles and missing-usage rate |
| Known configured cost | Yes | Daily threshold reference | Budget dashboard plus provider billing controls |
| Telemetry pipeline failure | Fixed sanitized alert signal | Local callback | Independent delivery-failure alert |

Before enablement, select a durable structured sink, define retention/access controls, configure dashboards and alert policies, connect a verified notification channel, and test delivery without placing learner content in logs. No sink, metric, alert, or notification channel was created in Phase 4.4.

### Cost and billing

The code enforces bounded outbound input, provider overhead, bounded output, worst-case transactional reservation, actual-usage settlement, conservative missing-usage charging, and integer micro-unit cost arithmetic. A monetary ceiling with unknown pricing fails closed. The repository contains no approved production prices or monetary ceiling, so a truthful worst-case monthly currency exposure cannot yet be calculated. Phase 4.1 cost tables are planning assumptions only, not runtime configuration.

Before enablement, the provider/account owner must verify exact input/output/reasoning billing dimensions, approved rates, taxes/currency implications, provider rate tier, hard provider budgets, expected requests per learner, and rollout population. Only those approved assumptions may populate the pricing and daily monetary variables.

### Privacy and learner disclosure

The provider receives programming language, current source, selected source when requested, bounded compiler status/output when evidence is current, short lesson/question/challenge context, evidence classification, and only the minimum server-owned Tutor constraint needed to direct the response. UID, name, email, Firebase state, auth token, cookies, progress, bookmarks, internal source hashes, assessment-policy objects, hidden tests, and protected answers are not transmitted.

The existing disclosure is visible before request controls, keyboard accessible through native `details/summary`, identifies external AI processing, describes transmitted context, warns against secrets/personal information, and visibly states that AI output may be incorrect. It satisfies the local product/accessibility requirement but not legal approval.

The dormant OpenAI adapter now sets `store: false` and requests the canonical strict JSON schema. This removes default Responses application-state storage for retrieval and improves response-shape enforcement; it does not remove default abuse-monitoring retention or replace account-level ZDR/MAM review.

**REQUIRES HUMAN/LEGAL/PROVIDER REVIEW:** provider retention and training use, human review, subprocessors, processing/data-transfer regions, deletion/export, incident handling, learner notice/consent, minors and institution-managed learners, educational data, and India DPDP considerations. This document makes no legal or compliance conclusion.

### Canary and rollback design

| Stage | Gate configuration | Entry health checks | Exit/rollback trigger |
| --- | --- | --- | --- |
| 0 — disabled deployment | `AI_TUTOR_ENABLED=false`, 0% | API route deployed; auth/config failure is sanitized; provider call count remains zero | Any unexpected provider invocation: disable/rollback deployment |
| 1 — internal allowlist | Enabled, 0%, reviewed internal UIDs | Quota transactions, telemetry delivery, exact model lock, synthetic Python/Java responses, cancellation | Any unsafe release, quota-integrity failure, telemetry outage, budget breach, sustained 5xx/timeout |
| 2 — very small deterministic cohort | Enabled, reviewed low percentage | Stable p50/p95, schema/release rates, provider limits, cancellation and cost baselines | Same immediate kill triggers; rollback percentage to 0 then disable |
| 3 — expanded cohort | Increment only after recorded review | Prior window meets SLOs/budget and no unresolved safety event | Return to last healthy percentage or disable |
| 4 — general availability | 100% only after explicit approval | Operational owner/on-call, verified alerts, privacy approval, capacity and billing controls | `AI_TUTOR_ENABLED=false` first; deployment rollback second if needed |

The emergency rollback is server-side `AI_TUTOR_ENABLED=false`. It is evaluated before quota or provider construction. A request/query/body field cannot override it.

### Deployed cancellation and load verification

Local tests prove browser `AbortController` propagation, request lifecycle abort, provider abort, stale-response suppression, and conservative cancellation settlement. The Vercel function opts into cancellation, but platform delivery of disconnect events and cleanup timing cannot be proven locally. Classification: **DEPLOYED-RUNTIME VERIFICATION REQUIRED**.

The production load plan must use synthetic authenticated principals and a disabled or approved test provider account. It must cover concurrent same-user ceilings, different-user isolation, identical and conflicting request IDs, provider failure/timeout, settlement races, cold starts, instance fan-out, Firestore transaction retries, and alert/telemetry delivery. Start below expected canary traffic and increase only within provider and Firestore limits. No production load test was run.

### External action register

| Action | Owner | Environment | Required credentials | Risk | Current status | Approval required |
| --- | --- | --- | --- | --- | --- | --- |
| Configure Vercel server variables with gate OFF | Deployment owner | Production | Vercel project admin; secret values | Secret exposure/misconfiguration | External action pending | Production authorization |
| Provision and verify Vercel OIDC -> Google WIF identity | Cloud security owner | Production | WIF/IAM and Vercel project administration | Excess privilege or incorrect trust binding | Code ready; external verification pending | Security + production authorization |
| Provision quota collections through controlled synthetic traffic | Backend owner | Production | Runtime Admin identity | Unexpected writes/cost | Not started | Production datastore authorization |
| Enable TTL on `aiTutorQuotaReservations.expiresAt` | Firestore owner | Production | Firestore field-config permission | Bulk deletion and delete cost | Not started | Data/production authorization |
| Select durable telemetry sink and retention | Platform/privacy owners | Production | Logging platform admin | Learner-data leakage/retention | Design pending | Security/privacy/production authorization |
| Create dashboards and metrics | SRE/operations | Production | Monitoring editor | Cost/noise | Not started | Production authorization |
| Create alerts and notification channel | SRE/on-call owner | Production | Monitoring + destination access | Alert fatigue/private destination | Not started | Named owner + production authorization |
| Configure provider billing/rate controls | Provider/account owner | Provider production account | Provider billing admin | Overspend/service denial | Not started | Finance/product/security approval |
| Complete provider privacy/legal review | Privacy/legal/product owners | Organizational | Contracts/DPA/provider documentation | Regulatory/contract risk | Required review | Human/legal approval |
| Run exact production-model evaluation | AI safety/evaluation owner | Controlled test | Approved provider credential | Cost/model-data processing | Pending | Separate model-call authorization |
| Deploy disabled Tutor revision | Deployment owner | Production | Git/Vercel deployment access | Regression | Not authorized | Deployment approval |
| Run synthetic canary verification | SRE/product/security owners | Production | Test account and approved provider access | Writes/cost/external calls | Not started | Production + model-call authorization |
| Enable allowlist/percentage rollout | Product/security/deployment owners | Production | Vercel environment admin | Learner exposure/cost | Not authorized | Explicit feature-enable approval |

### Phase 4.4 classification

- Local code/configuration validation: **CODE COMPLETE**.
- Deterministic tests and repository checks: **LOCAL VERIFICATION COMPLETE**.
- Vercel cancellation, Firebase IAM/TTL/load, telemetry, monitoring, alerts, billing, and canary operation: **EXTERNAL VERIFICATION REQUIRED** and **PRODUCTION AUTHORIZATION REQUIRED**.
- Provider retention, privacy, minors/education, and legal terms: **HUMAN/LEGAL REVIEW REQUIRED**.
- Exact eventual production model: **EXTERNAL VERIFICATION REQUIRED**; the 17-case evaluation has not run.
- Production feature enablement: **PRODUCTION AUTHORIZATION REQUIRED** and remains prohibited.
