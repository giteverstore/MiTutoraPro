# AI Tutor Production Infrastructure

**Status: LOCAL VERIFIED - provisioning plan only; production remains disabled**

## 1. Scope

This document defines the infrastructure contract for a future controlled AI Tutor deployment. It does not authorize provisioning, deployment, model evaluation, learner traffic, or a provider change. Hugging Face with `openai/gpt-oss-120b:fastest` remains the test configuration. OpenAI with pinned candidate `gpt-5.4-mini-2026-03-17` remains recommended and unevaluated for production.

Status labels used below are literal release gates:

- **LOCAL VERIFIED** - repository code or deterministic tests establish the claim.
- **EXTERNALLY VERIFIED** - an external resource has been inspected and evidence recorded. No Phase 4.6 item has this status.
- **PROVIDER CONFIRMATION REQUIRED** - provider/account-specific confirmation is missing.
- **HUMAN/LEGAL REVIEW REQUIRED** - an accountable person must decide and record the outcome.
- **PRODUCTION AUTHORIZATION REQUIRED** - a production mutation needs separate approval.
- **PENDING** - the work has not been performed.

## 2. Current architecture

**LOCAL VERIFIED**

```text
CompilerPanel
  -> AITutorPanel
  -> AITutorClient (Firebase ID token)
  -> POST /api/ai/explain
  -> FirebaseAITutorAuthenticator
  -> TutorFeatureGate
  -> trusted activity policy + request normalization
  -> sensitive-content inspection
  -> TutorQuotaGuard
  -> AIProvider.explain(request, signal)
  -> response schema + release policy
  -> sanitized telemetry/result
```

The provider owns only provider authentication, request formatting, transport, timeout/cancellation, response extraction, and usage extraction. Authentication, identity, rollout, quota, Tutor policy, evidence, sensitive-content policy, release policy, telemetry, and client rendering remain provider-independent.

## 3. Environment contract

No server secret uses a `VITE_` prefix. `.env` and `.env.*` are ignored while `.env.example` is explicitly retained. Secret placeholders are empty.

| Variable | Purpose | Production | Secret | Browser-visible | Default/example | Failure behavior |
| --- | --- | --- | --- | --- | --- | --- |
| `AI_PROVIDER` | Active adapter | Required | No | No | `huggingface` test only | Missing/unsupported fails closed |
| `AI_MODEL` | Exact model ID | Required | No | No | test model | Missing fails closed |
| `AI_TUTOR_APPROVED_PROVIDER` | Production provider lock | Required | No | No | empty | Missing/mismatch fails closed |
| `AI_TUTOR_APPROVED_MODEL` | Production model lock | Required | No | No | empty | Missing/mismatch fails closed |
| `HF_TOKEN` | Test-provider credential | Only for HF | Yes | No | empty | Missing fails closed |
| `OPENAI_API_KEY` | Candidate production credential | Only for OpenAI | Yes | No | empty | Missing fails closed |
| `AI_TUTOR_ENABLED` | Master kill switch | Required | No | No | `false` | Any value other than exact `true` disables |
| `AI_TUTOR_ROLLOUT_PERCENTAGE` | Deterministic rollout | Required before enablement | No | No | `0` | Invalid becomes zero/fails closed |
| `AI_TUTOR_ROLLOUT_VERSION` | Rollout evidence version | Required before enablement | No | No | `disabled` | Recorded with decision |
| `AI_TUTOR_ROLLOUT_SALT` | Stable rollout assignment | Required when enabled | Yes | No | empty | Missing production salt fails closed |
| `AI_TUTOR_ALLOWLIST_UIDS` | Internal canary allowlist | Optional | Sensitive | No | empty | Empty grants no access |
| `AI_TUTOR_QUOTA_BACKEND` | Distributed quota adapter | Required | No | No | empty | No production store fails closed |
| `AI_TUTOR_QUOTA_DATABASE_ID` | Dedicated quota database lock | Required with Firestore backend | No | No | `ai-tutor-quota` | Missing, `(default)`, invalid, or unapproved production value fails closed |
| `AI_TUTOR_QUOTA_IDENTITY_SALT` | UID HMAC key | Required | Yes | No | empty | Missing production salt fails closed |
| `AI_TUTOR_QUOTA_BURST_REQUESTS` | Burst request ceiling | Required | No | No | empty | Missing/invalid production value fails closed |
| `AI_TUTOR_QUOTA_BURST_WINDOW_SECONDS` | Burst window | Required | No | No | empty | Missing/invalid fails closed |
| `AI_TUTOR_QUOTA_SUSTAINED_REQUESTS` | Sustained ceiling | Required | No | No | empty | Missing/invalid fails closed |
| `AI_TUTOR_QUOTA_SUSTAINED_WINDOW_SECONDS` | Sustained window | Required | No | No | empty | Missing/invalid fails closed |
| `AI_TUTOR_QUOTA_HOURLY_REQUESTS` | Hourly ceiling | Required | No | No | empty | Missing/invalid fails closed |
| `AI_TUTOR_QUOTA_DAILY_REQUESTS` | UTC-day request ceiling | Required | No | No | empty | Missing/invalid fails closed |
| `AI_TUTOR_QUOTA_DAILY_INPUT_TOKENS` | Daily input authorization | Required | No | No | empty | Missing/invalid fails closed |
| `AI_TUTOR_QUOTA_DAILY_OUTPUT_TOKENS` | Daily output authorization | Required | No | No | empty | Missing/invalid fails closed |
| `AI_TUTOR_QUOTA_DAILY_COST_MICROS` | Integer micro-USD ceiling | Reviewed optional | No | No | empty | Requires known pricing or fails closed |
| `AI_TUTOR_PROVIDER_MAX_INPUT_TOKENS` | Approved input ceiling | Required | No | No | empty | Missing/invalid production value fails closed |
| `AI_TUTOR_PROVIDER_INPUT_OVERHEAD_TOKENS` | Protocol allowance | Required | No | No | empty | Missing/invalid production value fails closed |
| `AI_TUTOR_INPUT_USD_PER_MILLION_TOKENS` | Input rate for authorization | Required with cost quota | No | No | empty | Invalid or incomplete pricing fails closed |
| `AI_TUTOR_OUTPUT_USD_PER_MILLION_TOKENS` | Output rate for authorization | Required with cost quota | No | No | empty | Invalid or incomplete pricing fails closed |
| `FIREBASE_PROJECT_ID` | Pins Admin operations to project | Required | No | No | empty | Missing in production fails closed |
| `GOOGLE_WIF_AUDIENCE` | Google external-account audience for the provisioned Vercel provider | Required | No | No | empty | Missing, malformed, or unapproved production value fails closed |
| `GOOGLE_WIF_SERVICE_ACCOUNT_EMAIL` | Target short-lived runtime identity | Required | No | No | empty | Missing or unapproved production identity fails closed |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Local tooling compatibility only | Forbidden for production AI Tutor | Yes | No | empty | Presence in production fails closed |
| `AI_TUTOR_EVALUATION_ENABLED` | Opt-in live evaluation gate | Test/evaluation only | No | No | `false` | Runner refuses external requests |
| `AI_ALLOW_PROCESS_LOCAL_QUOTA` | Local-only quota adapter opt-in | Development only | No | No | `false` | Ignored as a production fallback |

`NODE_ENV` and `VERCEL_ENV` are platform inputs. Vercel supplies its workload OIDC token through server request context; no `VERCEL_OIDC_TOKEN` application variable is configured or accepted. **PRODUCTION AUTHORIZATION REQUIRED:** configure the reviewed non-secret WIF resource identifiers in the Vercel server environment only. Do not copy test values into production.

## 4. Firebase Admin

**LOCAL VERIFIED**

Production uses a request-scoped Firebase Admin app whose `Credential` delegates access-token acquisition to the Google external-account client. Firebase Admin remains responsible only for verifying the learner Firebase ID token with revocation checking enabled. The verified learner UID is not involved in workload credential exchange.

The infrastructure token and learner token are deliberately separate:

```text
Vercel request context OIDC -> Google WIF -> short-lived runtime credential
Authorization: Bearer <Firebase ID token> -> Firebase Admin Auth -> verified learner UID
```

Production requires the exact project pin and WIF configuration. Missing or malformed configuration, missing platform identity, exchange failure, and refresh failure return a sanitized server-unavailable error. Production rejects `FIREBASE_SERVICE_ACCOUNT_JSON` and never falls back to unrelated ADC. Credentials are request-scoped, are not cached in application globals, and are never logged, returned, or admitted to telemetry. Local development retains ADC and dependency-injected mocks.

**PENDING EXTERNAL VERIFICATION:** the code is ready for WIF provisioning, but the pool/provider and deployed token exchange must be provisioned and verified separately. The previous Phase 4.7C attempt correctly stopped because this adapter was absent; this code-only phase does not claim that WIF infrastructure is active.

## 5. Firestore quota

**LOCAL VERIFIED**

AI Tutor quota persistence is isolated from application Firestore initialization. Firebase Admin remains responsible for project-scoped ID-token verification. A direct server-only `@google-cloud/firestore` client is constructed with explicit project `mi-tutora-pro`, database ID `ai-tutor-quota`, and the same request-scoped WIF `AuthClient`, then injected into the database-agnostic `FirestoreTutorQuotaStore`. Production rejects a missing ID, `(default)`, an invalid ID, an unapproved project, or a missing WIF client. There is no implicit default-database or ADC fallback. The existing named database and its IAM/rules remain external infrastructure and were not modified by Phase 4.7C.1.

```text
projects/mi-tutora-pro/databases/ai-tutor-quota/documents/aiTutorQuotas/{hmacUid}
projects/mi-tutora-pro/databases/ai-tutor-quota/documents/aiTutorQuotaReservations/{requestId}
```

The server derives `hmacUid = HMAC-SHA256(AI_TUTOR_QUOTA_IDENTITY_SALT, verifiedUid)`. Raw UID is not a document ID or telemetry field. Reservation and settlement use Firestore transactions. Concurrent maxima are included before authorization:

```text
committed usage + already reserved usage + new worst-case reservation <= daily ceiling
```

Request, burst, sustained, hourly, daily token, and optional integer-cost ceilings are atomic per hashed identity. Duplicate request IDs are reusable only when identity, estimate, and maximum all match; conflicts return `ai/idempotency-conflict`. Settlement and duplicate settlement are idempotent. Missing or contradictory provider usage charges the authorized maximum. Failed settlement leaves capacity reserved and therefore fails closed. UTC midnight resets daily counters deterministically.

## 6. IAM

**LOCAL VERIFIED design; PRODUCTION AUTHORIZATION REQUIRED; external state PENDING**

Firestore client rules intentionally contain no match for either quota collection, so browser reads and writes are denied. The only supported path is authenticated browser -> server -> Admin SDK -> Firestore.

The dedicated server identity needs `firebaseauth.users.get` for revoked-token verification and Firestore permissions `datastore.databases.get`, `datastore.entities.get`, `datastore.entities.create`, and `datastore.entities.update`. The Auth permission must be bound separately from a database-conditioned quota role. The Firestore binding is intended to match only `projects/mi-tutora-pro/databases/ai-tutor-quota`. Production role, service-account, database, and binding creation remain Phase 4.7C. Do not add wildcard client rules.

## 7. TTL

**LOCAL VERIFIED design; production policy PENDING**

- Collection group: `aiTutorQuotaReservations`
- TTL field: `expiresAt`
- Current application retention: seven days after reservation creation
- Type: Firestore timestamp (Admin SDK serializes the stored `Date`)
- Database: `ai-tutor-quota` only; TTL uses the stored expiry directly with no additional offset

TTL is cleanup only. It does not release reserved quota, authorize a request, or guarantee immediate deletion. A delayed deletion remains safe because abandoned capacity stays reserved until the UTC-day counter resets. **PRODUCTION AUTHORIZATION REQUIRED:** enable and verify the TTL policy separately before rollout.

## 8. Quota configuration

**LOCAL VERIFIED mechanics; reviewed production values PENDING**

Local defaults exist only for deterministic development tests. Production requires explicit positive integral request/token limits and non-negative integral overhead. Monetary authorization uses integer micro-units and ceiling division; floating-point dollars are not used in the authorization transaction.

The exact production values require product, capacity, provider, and billing review. In particular, `AI_TUTOR_PROVIDER_MAX_INPUT_TOKENS` and `AI_TUTOR_PROVIDER_INPUT_OVERHEAD_TOKENS` are **PROVIDER CONFIRMATION REQUIRED**. No values in `.env.example` are production recommendations.

## 9. Billing protection

**PROVIDER CONFIRMATION REQUIRED; PENDING**

Application quota is not provider billing protection. Before provisioning a production key:

- use separate production and development projects/credentials;
- configure provider budgets and alerts;
- configure a provider hard spending limit if the account offers one;
- restrict the key to the required API/project where supported;
- assign credential owner and rotation cadence;
- test emergency revocation without disclosing the key;
- document taxes, regional uplift, retries, and unreported charges outside token pricing.

Credential compromise response: set `AI_TUTOR_ENABLED=false`, revoke the credential, review sanitized telemetry/provider audit data, rotate, then require explicit re-enable approval.

## 10. Telemetry

**LOCAL VERIFIED schema; durable production sink PENDING**

Allowed fields are behavior/schema versions, provider/model, operation, latency, success, HTTP status, retryability, sanitized error category, response byte count, provider token counts, known estimated cost, quota decision, and rollout state/version/bucket. The abstraction cannot accept source, selection, compiler output, prompts, responses, title, UID, email, token, cookie, credential, or arbitrary objects.

Development uses the no-op sink. Production needs a durable structured sink that adds an ingestion timestamp and retention/access policy. Sink failure emits only `telemetry-pipeline-failure` and never weakens response safety. Authentication failures occur before the current request telemetry boundary; the production API/platform must provide a separate aggregate authentication-failure signal without identity or token data.

## 11. Monitoring

**LOCAL VERIFIED signal design; thresholds and channels REVIEW REQUIRED; resources PENDING**

| Signal | Proposed warning | Proposed critical | Action | Owner |
| --- | --- | --- | --- | --- |
| Request volume | Baseline deviation | Sustained abnormal volume | Inspect rollout/abuse; reduce rollout | Operations |
| Latency p50/p95 | Reviewed SLO breach | Sustained provider/runtime timeout risk | Check provider and Vercel duration | Operations |
| HTTP 5xx | Repeated window | Sustained elevated rate | Kill switch if learner impact persists | Engineering |
| Provider failures/429 | Repeated window | Sustained provider degradation | Pause rollout; contact provider | Engineering |
| Timeouts/cancellation | Baseline deviation | Sustained deadline pressure | Check provider/runtime propagation | Engineering |
| Quota exhaustion | Repeated user-safe rejection | Broad unexpected exhaustion | Review limits/abuse; never bypass quota | Product/Engineering |
| Unsafe/malformed responses | Any repeated occurrence | Sustained release-gate rejection | Disable and investigate exact model | Safety owner |
| Authentication failures | Baseline deviation | Sustained elevated aggregate | Investigate auth/runtime; no token logging | Security |
| Actual/estimated tokens and cost | Reviewed budget percentage | Reviewed emergency percentage | Reduce rollout or disable | Finance/Operations |
| Unknown cost/telemetry failure | Any sustained occurrence | Loss of operational visibility | Do not expand rollout; consider disabling | Operations |

All numeric thresholds in `tutorAlerts.js` are reference/test defaults, not production approvals. Notification channel owners and escalation coverage remain **PENDING**.

## 12. Feature gate

**LOCAL VERIFIED**

`AI_TUTOR_ENABLED` is checked after authenticated UID derivation and before request normalization, quota construction, provider construction, or provider invocation. Request body, query string, client state, and activity metadata cannot enable it. Default and invalid boolean values are disabled. Production enablement without a rollout salt fails closed.

Allowlist and percentage decisions use server configuration and deterministic UID hashing. Emergency rollback is `AI_TUTOR_ENABLED=false`; rollout percentage zero and an empty allowlist are secondary containment.

## 13. Vercel runtime

**LOCAL VERIFIED configuration; deployed behavior PENDING**

`/api/ai/explain` is the only AI endpoint. It accepts POST, verifies a Firebase ID token, and propagates request/response disconnects to the provider signal. The provider deadline is 45 seconds; `vercel.json` gives the function 60 seconds and enables cancellation, leaving bounded response/settlement time. Provider credentials remain server environment variables and are absent from the Vite bundle.

The SPA fallback must not replace the API function; Vercel function routing is verified locally but requires deployment verification. No debug or alternate provider route was found.

## 14. Deployment order

Every step requires recorded evidence and must leave learner traffic disabled until its own approval:

1. Provision dedicated Firebase Admin runtime access.
2. Review effective Firestore IAM.
3. Configure reservation TTL.
4. Connect durable privacy-bounded telemetry.
5. Configure monitoring and notification delivery.
6. Configure provider billing protection.
7. Provision a separate production provider credential.
8. Configure exact provider/model lock.
9. Configure reviewed quota, pricing, and token limits.
10. Deploy with `AI_TUTOR_ENABLED=false` and rollout zero.
11. Verify deployment and route isolation.
12. Verify authentication and UID derivation.
13. Verify quota fail-closed behavior.
14. Verify kill switch before provider construction.
15. Verify telemetry and privacy boundary.
16. Verify deployed cancellation and deadlines.
17. Run the authorized 17-case exact-model evaluation using synthetic data.
18. Enable only an internal allowlist.
19. Begin a separately approved small deterministic rollout.
20. Expand only after monitored approval.

## 15. Rollback

**LOCAL VERIFIED primary mechanism; deployed drill PENDING**

Primary: set `AI_TUTOR_ENABLED=false`. Secondary containment: empty allowlist, rollout zero, revoke provider credential, disable provider project access, then roll back the Vercel deployment if needed. The server gate prevents provider construction/invocation.

| Incident | Immediate response |
| --- | --- |
| Credential compromise | Kill switch, revoke key, rotate, investigate sanitized evidence |
| Unsafe response | Kill switch, preserve non-content classifications, review model/release gate |
| Runaway cost | Kill switch, provider hard limit, revoke key if necessary |
| Provider outage | Pause rollout; preserve typed unavailable response |
| Quota failure | Fail closed; do not use process-local fallback |
| Telemetry failure | Stop expansion; disable if visibility cannot be restored |
| Authentication bypass | Kill switch and revoke deployment/session paths as incident owner directs |
| Data exposure | Kill switch, revoke credentials, preserve approved audit evidence, invoke incident process |

## 16. Failure modes

| Dependency/failure | Server behavior | Learner-visible behavior | Operator action |
| --- | --- | --- | --- |
| Firestore unavailable/permission denied | Quota unavailable; provider not called | Tutor temporarily unavailable | Restore IAM/service; inspect aggregate errors |
| Transaction conflict | Firestore retries; final failure is unavailable | Retryable availability message where classified | Inspect contention/load |
| Duplicate conflicting request ID | `ai/idempotency-conflict` | Safe non-retryable request failure | Investigate client/request reuse |
| Telemetry unavailable | Safety flow remains enforced; fixed pipeline alert | No content leakage; response may still succeed | Stop rollout expansion; repair sink |
| Provider unavailable/429 | Typed sanitized error; quota settles conservatively | Retry only when taxonomy permits | Pause rollout/contact provider |
| Provider timeout | Abort at 45 seconds | Sanitized timeout | Inspect latency and capacity |
| Vercel timeout | Platform terminates request | Generic request failure | Compare function/provider deadlines |
| Admin initialization failure | Authentication/quota unavailable | Sign-in/session or temporary-unavailable message | Correct pinned project/credential |
| Invalid production config | Fail closed before provider use | Tutor unavailable | Correct reviewed environment values |
| Feature-gate failure | Disabled/misconfigured | Tutor unavailable | Keep disabled; repair config |
| Provider credential failure | Sanitized provider-auth error | Tutor not configured/unavailable | Rotate or correct credential |

## 17. Load-test plan

**Plan LOCAL VERIFIED; execution PENDING**

Use emulator or isolated non-production Firebase and a mocked latency-controlled provider. Cover same-user and different-user concurrency, duplicate and conflicting IDs, settlement, abandoned reservations, UTC reset, all ceilings, provider latency, transaction retries, and teardown. Acceptance requires no ceiling overshoot, no raw UID document IDs, idempotent exact duplicates, deterministic conflicts, conservative abandonment, bounded latency/error rates, and zero provider calls after quota rejection. Do not load-test production.

## 18. Deployed verification plan

**PENDING - requires production authorization**

| Test | Setup/action | Expected server/learner result | Evidence |
| --- | --- | --- | --- |
| Authentication | Gate deployed off; missing/invalid token | 401, no quota/provider | Sanitized status/classification |
| Feature gate | Authenticated internal user while disabled | `ai/disabled`, no provider | Provider invocation count zero |
| Quota | Synthetic allowlisted account at test ceiling | Atomic allow then safe rejection | Hashed docs and sanitized telemetry |
| Provider invocation | Authorized synthetic request | One locked-model request | Provider request count/classification only |
| Provider failure | Controlled adapter/provider test | Typed sanitized failure | Error category, no body/content |
| Cancellation | Abort client request | Provider signal abort; no late response | Timing/classification |
| Timeout | Controlled delayed provider | Deadline below platform max | Sanitized timeout and duration |
| Telemetry | Synthetic success/failure | Allowlisted event only | Schema fields and sink timestamp |
| Secret boundary | Synthetic credential pattern | Pre-provider rejection | Provider count zero |
| Client rendering | Safe synthetic structured result | Text-only validated UI | Browser accessibility check |
| Rollback | Disable gate before next request | No new provider invocation | Config version and request result |

No real learner traffic or content is permitted in this matrix.

## 19. Canary plan

**PENDING; every transition requires production authorization**

| Stage | Entry criteria | Monitoring | Rollback condition | Approval |
| --- | --- | --- | --- | --- |
| 0 - disabled | Infrastructure deployed and verified | Auth/config/telemetry only | Any boundary failure | Engineering/security |
| 1 - internal allowlist | Exact-model gate and external reviews complete | Per-request operational signals | Any unsafe release, auth/quota/privacy failure | Product/security |
| 2 - small deterministic percentage | Stage 1 stable for reviewed period | Errors, latency, quota, safety, cost | Reviewed warning/critical breach | Change approval |
| 3 - expanded percentage | Stage 2 evidence accepted | Same plus trend/capacity | Regression or budget risk | Change approval |
| 4 - general availability | All gates and SLOs accepted | Ongoing operations | Kill-switch incident criteria | Executive/product owner |

Percentages and monitoring periods are deliberately **REVIEW REQUIRED** rather than invented here.

## 20. External action register

| Action | Environment | Owner | Credential | Risk/prerequisite | Approval | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Firebase runtime IAM | Production | Cloud/security | IAM administrator | Excess datastore privilege | Required | PENDING |
| Firestore reservation TTL | Production | Firebase owner | Firestore admin | Incorrect field/collection | Required | PENDING |
| Telemetry sink | Production | Operations/privacy | Sink writer/admin | Content or identity leakage | Required | PENDING |
| Monitoring/alerts/channels | Production | Operations | Monitoring admin | Missing/noisy escalation | Required | PENDING |
| Provider billing controls | Production provider | Finance/operations | Provider account admin | Runaway spend | Required | PENDING |
| Production provider credential | Production | Security | Secret administrator | Credential exposure | Required | PENDING |
| Vercel environment | Production | Deployment owner | Vercel project admin | Incorrect provider/gate | Required | PENDING |
| Disabled deployment | Production | Deployment owner | Git/Vercel deploy rights | Runtime drift | Required | PENDING |
| Exact-model evaluation | Controlled production candidate | AI/safety owner | Approved provider key | Model behavior incomplete | Required | PENDING |
| Canary enablement | Production | Product/security/operations | Vercel env admin | Learner exposure | Required | PENDING |
| Legal/privacy approval | Organization | Legal/privacy owner | None | Minors, India, transfers | Required | PENDING |

## 21. Security boundaries

**LOCAL VERIFIED**

- Browser code has no provider/Admin credential import.
- Firebase token verifies server-side and only its UID becomes the principal.
- HMAC identity and rollout salts are server-only.
- Client rules deny quota collections by default.
- Provider/model locks and token constraints fail closed in production.
- Provider invocation occurs only after authentication, feature gate, normalization, sensitive-content inspection, and quota reservation.
- Responses cross bounded parser, schema, evidence, release, client-validation, and text-rendering boundaries.
- Telemetry is a strict primitive-field allowlist and excludes learner content and identity.

## 22. Remaining gates

- **PROVIDER CONFIRMATION REQUIRED:** model/account limits, privacy controls, availability, reliability, and billing controls.
- **HUMAN/LEGAL REVIEW REQUIRED:** minors, educational data, India DPDP, transfers, subprocessors, notice/consent, retention/deletion.
- **PRODUCTION AUTHORIZATION REQUIRED:** IAM, TTL, telemetry, monitoring, secrets, Vercel environment/deployment, evaluation, and canary stages.
- **PENDING:** production load test, deployed cancellation verification, notification delivery, exact-model evaluation, and rollback drill.

Technical infrastructure design is ready for controlled provisioning. External infrastructure and production secrets do not exist as verified gates, so production readiness remains **NOT READY**.

## Phase 4.7 provisioning checkpoint

**Status: BLOCKED BEFORE FIRST MUTATION - 2026-08-29**

The controlled provisioning preflight stopped before every external mutation because the full production boundary could not be verified from this workspace.

### Read-only evidence

- **EXTERNALLY VERIFIED:** Firebase CLI and Google Cloud configuration both identify `mi-tutora-pro` (project number `196429461457`). The default Firestore Native database exists in `asia-south1`.
- **EXTERNALLY VERIFIED:** no TTL policy currently exists for collection group `aiTutorQuotaReservations`.
- **EXTERNALLY VERIFIED:** no Cloud Monitoring alert policy is currently listed for the project.
- **EXTERNALLY VERIFIED:** the production root and `/practice` return HTTP 200 through Vercel.
- **EXTERNALLY VERIFIED:** unauthenticated POST to `/api/ai/explain` returns HTTP 405, not the local handler's authenticated 401 contract. The currently deployed revision therefore does not expose the local AI Tutor API route.
- **LOCAL VERIFIED:** branch `main`, inspected HEAD `50d0dae56ac35ad86c48d738534deb0316e6ffd9`, and a large intentional dirty worktree with no staged changes.
- **PENDING:** Vercel project identity, environment values, deployed revision, and `AI_TUTOR_ENABLED=false`/rollout-zero values cannot be inspected because this workspace has neither `.vercel` linkage nor `VERCEL_TOKEN`.
- **REVIEW REQUIRED:** the project contains existing default and Firebase Admin service accounts, but no runtime identity can be attributed to the undeployed Vercel function. The existing Firebase Admin identity has roles beyond the proposed quota-only runtime purpose, so least privilege cannot be claimed.
- **PENDING:** notification-channel inventory could not be completed with the installed stable CLI; no channel or delivery test was created.

The AI Tutor is effectively unavailable in the deployed application because its API route is absent. That does not prove the intended Vercel environment variables are configured to `false` and `0`; those values remain unverified rather than inferred.

### Mutation log

| Resource | Action | Project | Timestamp | Before | After | Reason/verification | Rollback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| All authorized Phase 4.7 resources | None | `mi-tutora-pro` / Vercel project unverified | 2026-08-29 | Read-only inventory only | Unchanged | Pre-provisioning gate incomplete | Not applicable |

No IAM binding, TTL policy, telemetry sink, monitoring policy, notification channel, billing setting, Vercel environment variable, deployment, Firestore document, rule, function, Storage object, or provider configuration was modified.

### Exact blocked actions

1. **Vercel environment and deployment - BLOCKED.** An authorized Vercel project administrator must first expose read-only project/environment evidence or establish an approved CLI/project linkage. The established GitHub-to-Vercel workflow requires a commit/push, which Phase 4.7 explicitly forbids. A separate authorization is required before committing or pushing the reviewed worktree.
2. **Runtime identity/IAM - REVIEW REQUIRED.** Select and approve a dedicated runtime identity and exact Firebase Auth/Firestore permissions. Do not reuse a broad account merely because it already exists.
3. **Firestore TTL - PENDING.** After runtime/project/Vercel preflight is complete, an authorized operator can run `gcloud firestore fields ttls update expiresAt --collection-group=aiTutorQuotaReservations --enable-ttl --project=mi-tutora-pro`, then verify it reaches `ACTIVE`. This command was not run.
4. **Telemetry - BLOCKED.** Approve a destination, authentication mechanism, region, retention, access controls, and deletion policy before connecting the content-free event schema.
5. **Monitoring/notifications - REVIEW REQUIRED.** Approve numeric thresholds, owners, notification destinations, and a safe delivery test before creating alerts.
6. **Provider billing - PENDING.** No provider credential or billing setting may be provisioned until the provider/account review and separate production authorization are complete.

### Phase 4.7 external action register

| Action | Status | Evidence/next gate |
| --- | --- | --- |
| Firebase project/database | EXTERNALLY VERIFIED | `mi-tutora-pro`, default Firestore Native database, `asia-south1` |
| Firebase runtime identity | BLOCKED | Vercel runtime identity is not established |
| IAM | REVIEW REQUIRED | Existing roles inventoried; least-privileged runtime role not approved |
| Firestore TTL | PENDING | Policy absent; mutation deliberately not executed |
| Telemetry sink | BLOCKED | Destination controls not approved |
| Monitoring policies | PENDING | No current policy listed; thresholds still require review |
| Notification delivery | BLOCKED | Destination and channel inventory/delivery unavailable |
| Provider billing controls | PENDING | No production provider mutation authorized |
| Vercel environment | BLOCKED | No authenticated project linkage/environment visibility |
| Vercel deployment | BLOCKED | Existing workflow requires prohibited commit/push |
| Deployed cancellation | PENDING | Local API route is not deployed; no provider request permitted |
| Load/concurrency testing | PENDING | No production load test authorized |
| Exact production-model evaluation | PENDING | Separate phase and authorization required |
| Privacy/legal approval | HUMAN/LEGAL REVIEW REQUIRED | Phase 4.5 external gates remain open |
| Canary authorization | PENDING | Infrastructure, evaluation, legal, and operational gates incomplete |

Phase 4.7 is **BLOCKED** and production infrastructure remains **NOT PROVISIONED**. The stop preserved the required safety boundary: no learner traffic, no provider switch, and zero model requests.

## Phase 4.7B named quota database implementation

**Status: IMPLEMENTED LOCALLY; PRODUCTION NOT PROVISIONED**

- The approved quota database is pinned to `ai-tutor-quota` in project `mi-tutora-pro`, region planned as `asia-south1`.
- `@google-cloud/firestore` is an explicit server runtime dependency and constructs the quota client with an explicit `databaseId`.
- Firebase Admin is retained for Firebase Authentication only on the AI Tutor path.
- `FirestoreTutorQuotaStore` remains database-agnostic and preserves the existing transaction, reservation, settlement, HMAC, and idempotency behavior.
- Production configuration rejects `(default)` and every unapproved database/project pair; it never falls back to application Firestore.
- Browser source is validated against imports of the server Firestore client and quota modules.
- Phase 4.7C still owns database creation, deny-all named-database Rules, split custom roles, service account, database-conditioned IAM binding, TTL, Vercel OIDC/WIF, monitoring, and deployed negative permission probes.
