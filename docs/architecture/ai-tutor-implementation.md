# AI Tutor Implementation

**Status: CURRENT - Phase 4.5 local provider/privacy gate complete; production disabled**

This document describes how the canonical [AI Tutor specification](ai-tutor-specification.md) is implemented. The specification remains authoritative for behavior; this document records concrete boundaries, flow, and prototype limitations. The current local implementation includes the Phase 2C authentication, activity-policy, response-release, evidence-binding, cancellation, and disclosure remediation foundation.

Phase 3 production-readiness infrastructure is implemented locally but is not provisioned or enabled. See [AI Tutor production readiness](ai-tutor-production-readiness.md) for the datastore, telemetry, evaluation, privacy, rollout, and rollback contract.

## Phase 3 production-readiness controls

The server now evaluates a disabled-by-default `TutorFeatureGate` immediately after authentication and before quota or provider construction. Rollout decisions use verified UID with a server salt, percentage, version, and optional allowlist; no client field can enable the tutor or choose a bucket. The UI converts `ai/disabled` into a stable, non-retryable unavailable state.

Production provider/model values are explicitly locked by matching configured and approved server values. Missing or mismatched configuration fails closed. The client still has no provider, model, endpoint, policy, temperature, or token-budget controls.

`TutorQuotaStore` now has reservation and settlement semantics. The selected production adapter uses direct `@google-cloud/firestore` transactions against the explicit named quota database and HMAC-derived user document IDs. The deterministic process-local adapter implements the same contract for development and concurrent tests. Production never silently falls back to it.

Usage accounting separates estimated, worst-case reserved, and actual provider usage. Hard token authorization uses the exact bounded outbound payload, reviewed exact-model input/overhead constraints, and the server output ceiling. Settlement releases unused capacity; missing or contradictory usage consumes the reserved maximum. Monetary calculations use integer micro-units, and a configured monetary ceiling fails closed unless both approved token rates are configured. Unknown pricing remains explicitly unknown only when monetary enforcement is not enabled. The expanded telemetry allowlist still cannot admit identity or learner content. A structured sink and provider-neutral alert evaluator exist, while actual telemetry and notification infrastructure remain unconfigured.

The adversarial harness now identifies the exact provider/model/policy combination and emits sanitized evaluation results only. The Phase 3.2 matrix separates exact-model behavioral cases from deterministic boundary/transport cases and requires both groups to pass. The opt-in live script uses synthetic data and requires explicit enablement. No model call occurs during normal validation.

The safe initial activity policy is Level 1 hints-only for lessons, Practice, Challenges, and unknown contexts. Progressive escalation and complete-solution permission remain unavailable even if a legacy policy-shaped object is supplied.

## Architecture

```text
CompilerPanel
  -> AITutorPanel
  -> AITutorClient
  -> POST /api/ai/explain
  -> normalizeTutorRequest
  -> tutor rate limiter and request coordinator
  -> createTutorProviderRequest
  -> createAIProvider
  -> provider adapter
  -> validateTutorResponse
  -> structured response
  -> AITutorResponse
```

The browser owns interaction state and rendering. The server owns context boundaries, policy, prompt construction, provider selection, response validation, abuse controls, and public error normalization.

## Phase 2C security boundaries

### Authentication and quota

`AITutorClient` obtains a Firebase ID token from the existing authentication service and sends it only in the `Authorization` header. `FirebaseAITutorAuthenticator` verifies the token server-side and exposes only its UID. A UID supplied in the request body is never authoritative.

Quota is reserved before request normalization, so malformed and provider-failed requests still count. `TutorQuotaStore` is the distributed-store boundary and derives an HMAC identity only from the verified UID. `X-Forwarded-For` and client identity fields are not trusted. The bounded process-local store is explicitly development-only. Production selects the Firestore transaction adapter and fails closed when it is missing or unavailable; `AI_ALLOW_PROCESS_LOCAL_QUOTA` is never a production fallback.

### Trusted activity and solution release

Client activity fields are hints, not authorization. `TrustedActivityPolicyResolver` must obtain lesson escalation from a server-controlled source. Practice, challenge, certification, missing, and unverifiable contexts remain hints-only at Level 1. The current default resolver has no trusted source and therefore fails closed.

After structural response validation, `TutorResponseReleasePolicy` examines every learner-visible field. It rejects complete/corrected replacement programs, solution-shaped code fences, and replacements split across sections or the next step. Phase 3 grants no complete-solution capability, including for trusted lessons or legacy progressive policy-shaped inputs. Rejected model content never crosses the API boundary.

### Compiler evidence

The compiler captures the exact executed source, language, completion status, output, and SHA-256 source hash. The server recomputes the executed-source and current-source hashes. Runtime output is admitted only when both hashes, the claimed hash, language, and completed state agree. Source edits, including whitespace changes, old successes/errors, missing evidence, incorrect languages, and forged hashes downgrade the request to static evidence and omit runtime output.

This prevents accidental stale-evidence use and rejects a forged hash that does not match the supplied source. It is not cryptographic remote attestation: a hostile custom client can fabricate an internally consistent source/output tuple. Browser execution remains client-provided evidence, not a server-verified test result.

## Phase 2C.2 hardening

### Outbound sensitive content

`TutorSensitiveContentInspector` runs after normalization and before provider invocation for every provider. It deterministically checks bounded learner-controlled fields for high-confidence private keys, provider/repository/cloud tokens, bearer/JWT values, credentialed database URIs, Firebase-style keys, and obvious password/secret assignments. Secrets in source or selected code fail closed because altering executable text could make an explanation misleading. Secrets in compiler output or short activity context are replaced with `[REDACTED]` while retaining the request structure. Known placeholder forms such as `YOUR_API_KEY` remain usable. This is heuristic detection, not a guarantee that every secret will be found.

### Selection snapshots

Monaco records selection text, exact UTF-16 start/end offsets, full-source hash, selection hash, and language. Editing invalidates the client snapshot. The server recomputes both hashes, validates bounds and language, and verifies `code.slice(start, end)` exactly equals the selected text. A mismatch returns `ai/stale-selection` and the provider is not called. These checks prevent accidental stale selection and simple field forgery; like compiler evidence, they are consistency checks rather than remote attestation.

### Response parsing and client defense in depth

Provider text is capped at 64 KiB before parsing. Embedded-object extraction is a single forward pass with string/escape awareness, non-overlapping candidate parsing, and an eight-level nesting cap. Structured validation retains bounded strings, arrays, object depth, line references, and enums. The browser independently checks the complete versioned response shape and bounds before React renders known fields as text. It does not duplicate activity or solution policy.

### Error and retry behavior

`aiErrorTaxonomy` assigns stable HTTP and retryability semantics. Authentication, invalid/stale/sensitive requests, unsafe responses, cancellation, and configuration failures are non-retryable. Rate limits, transport unavailability, provider timeouts, and malformed provider responses are retryable. The UI offers an explicit Retry action only when the server classifies a failure as retryable; cancellation remains silent.

### Adversarial evaluation and accessibility

The provider-neutral evaluation harness records only provider name, scenario ID, expected/observed policy outcome, pass/fail, and sanitized classification. CI uses mocked provider responses and makes no external calls. This validates application safety boundaries, not future model behavior.

AI Tutor controls remain semantic buttons with visible focus and accurate disabled state. Selection help is associated through `aria-describedby`; loading, completion, and errors use appropriate live semantics without moving focus. Privacy details use native `details/summary`, Retry is keyboard accessible, and reduced-motion mode removes the loading rotation and nonessential transitions. Narrow mode continues using the compiler's existing tab/tabpanel model.

### Cancellation and learner disclosure

Panel cancellation propagates from browser fetch through the API request lifecycle to the provider abort signal. Client disconnects abort provider work and the handler does not write a late response.

Before the request controls, the panel visibly states that relevant code and available compiler context are sent to the configured third-party AI provider. An accessible expandable description lists the transmitted context and reminds learners to remove secrets and personal information. This transparency control does not replace provider-retention and legal review.

## Provider boundary

`AIProvider` adapters perform only provider communication:

- server-side authentication;
- provider-specific request formatting;
- timeout and caller cancellation;
- response text and usage extraction;
- typed transport, HTTP, refusal, and configuration failures.

The adapters receive an already constructed provider-neutral tutor request. They do not define tutor identity, hint policy, assessment rules, or response presentation. Hugging Face and OpenAI remain independently selectable through `createAIProvider()`.

The Hugging Face chat adapter requests low reasoning effort and supplies the canonical contract as the endpoint's strict JSON schema, so a reasoning-capable model can reserve the bounded completion budget for validated learner-facing JSON. This is transport configuration, not tutor policy; models that do not expose reasoning remain governed by the same provider-neutral response budget and server validation.

The dormant OpenAI Responses adapter also requests the canonical strict JSON schema and explicitly sets `store: false`. This prevents Responses application-state storage for later retrieval; it does not disable the provider's default abuse-monitoring retention. The production OpenAI candidate remains unconfigured and unevaluated.

## Tutor policy boundary

`server/ai/tutor/` contains the provider-independent controls:

- `tutorConfig.js`: versions and bounded request/response limits;
- `tutorPolicy.js`: learning identity, security boundary, evidence rules, and response contract;
- `tutorPrompt.js`: operation-aware output budget and untrusted learner-data envelope;
- `tutorRequest.js`: request allowlist, normalization, evidence derivation, and safe assessment default;
- `tutorResponseSchema.js`: parsing, validation, normalization, and line-range checks;
- `tutorRateLimiter.js`: bounded process-local prototype limiter;
- `tutorRequestCoordinator.js`: identical in-flight request suppression;
- `tutorTelemetry.js`: no-op-by-default, strictly allowlisted telemetry boundary.

Learner-controlled code, comments, strings, output, and titles appear only in the untrusted data message. They cannot alter the system policy.

## Request and context contract

The endpoint accepts only:

- request type;
- `python` or `java` language ID;
- current code snapshot;
- selected code for selection explanations;
- compiler output;
- normalized compiler status;
- a short lesson, question, or challenge title/context.

Identity, cookies, authentication data, Firebase state, progress, hidden tests, and arbitrary client assessment policy are discarded. Oversized fields are rejected rather than silently truncating program semantics.

High-confidence credential patterns, including private-key blocks and common provider/repository access-token formats, are rejected before provider invocation. This is a narrow safety net rather than a complete secret-detection system; the learner-facing privacy disclosure remains required.

The current compiler does not supply a trusted assessment-policy field. Phase 2B therefore uses the conservative server-owned default:

```text
hintLevel = 1
activityType = unknown
solutionPolicy = hints-only
```

A future escalation mechanism must receive trusted activity policy from a server-controlled source. Client claims alone must never authorize complete solutions.

## Compiler evidence

The server maps completed successful and failed runs to runtime evidence. Idle, ready, running, unknown, or absent states remain static evidence. Expected output is not part of the tutor request.

The response validator rejects a model response that claims runtime evidence when the request contains only static evidence. A cautious response may use static reasoning even when runtime evidence exists.

## Structured response

The endpoint returns the exact versioned shape defined by the specification:

- schema and policy versions;
- operation;
- evidence basis and optional note;
- summary;
- up to four explanation sections;
- up to six validated code references;
- up to five concepts;
- up to five Level 1 issues;
- one next step.

Provider text is parsed once, with one bounded normalization attempt for a single enclosing JSON code fence or one embedded JSON object. Wrapper text is discarded and never reaches the UI; multiple or syntactically invalid objects still fail. Dangerous object keys, invalid versions or enums, excessive arrays or strings, invalid line references, disallowed hint levels, and empty responses are rejected. Unknown ordinary fields are discarded during normalization.

The React UI renders each approved field as text in a fixed component structure. It does not render provider HTML, links, arbitrary Markdown, or model-selected components.

## Request lifecycle and stale responses

The panel snapshots the code, selection, compiler state/output, language, and context when a request starts.

- A newer request aborts the previous request.
- A context change aborts an active request.
- A late superseded response cannot update the panel.
- An existing explanation is retained but explicitly marked stale after context changes.
- Regenerate is an explicit learner action against the latest snapshot.
- Cancellation returns to the prior successful response or initial state without announcing an error.

These behaviors preserve learner agency and avoid silently associating old advice with new code.

## Failure handling

`AIServiceError` remains the typed server error boundary. It normalizes missing configuration, authentication, unavailable models, rate limits, timeouts, network failures, provider failures, refusals, malformed responses, empty responses, duplicate requests, and invalid context.

Only stable codes and learner-safe messages cross the API boundary. Provider bodies, URLs, stack traces, authorization headers, credentials, and raw model text are never returned.

## Abuse and cost controls

Phase 2B includes:

- total and per-field request limits;
- structured response size and collection limits;
- 350, 700, and 1,200-token learner-facing targets, with a 1,200-token hard provider ceiling that also accommodates model-internal reasoning;
- browser duplicate-action prevention and cancellation;
- server identical in-flight request suppression;
- a bounded process-local rate limit of 30 requests per minute per ephemeral request fingerprint;
- 45-second provider deadlines.

The in-memory limiter remains local/test infrastructure. The Firestore transaction adapter implements distributed reservations and idempotent settlement, but the required production collections, TTL policy, IAM, limits, and load verification are not provisioned in this phase.

## Observability

The telemetry abstraction is no-op by default. Its allowlist contains policy/schema versions, approved provider/model, operation, latency, HTTP/result classification, retryability, response size, quota/rollout state, provider token counts, and known configured cost.

Code, selected code, compiler output, prompts, model responses, titles, UID, IP addresses, and credentials cannot enter an emitted telemetry event through this abstraction. `StructuredTutorTelemetrySink` and the alert evaluator are platform-neutral; no Firebase, Vercel, Cloud Logging, notification channel, or monitoring integration is connected locally.

## Versioning

- `TUTOR_POLICY_VERSION = ai-tutor-v1`
- `RESPONSE_SCHEMA_VERSION = 1`

Both are server-owned constants. Every successful client response carries both values. Provider and package versions do not substitute for these behavior versions.

## Testing

Focused tests cover policy identity, budgets, hint restrictions, safe assessment defaults, compiler evidence, allowed context, size limits, injection attempts, schema normalization, malformed and oversized responses, line references, unsafe HTML rendering, timeouts, cancellation, duplicate requests, rate limiting, stale responses, sanitized telemetry, provider selection, and adapter behavior.

The local smoke test exercises the entire Vite endpoint and panel with one harmless Python program when server-side Hugging Face credentials are configured.

## Current limitations

- Complete-solution detection is a conservative deterministic lexical/structural gate, not semantic proof. The exact production provider/model still requires controlled live evaluation.
- Browser disconnect propagation depends on the serverless runtime surfacing request/response lifecycle events; the provider deadline remains the fallback when it does not.

- Hint escalation above Level 1 is intentionally unavailable.
- No trusted activity-policy source is integrated; the initial release therefore remains Level 1 hints-only.
- The distributed Firestore adapter is implemented but not provisioned or load-tested in production.
- The tutor remains stateless between explanation requests.
- No curriculum grounding, RAG, tools, autonomous actions, or persistent memory exist.
- Provider JSON reliability still requires cross-model production evaluation.
- No production telemetry sink, quota collections, cost alert, or notification channel is configured.
- Privacy disclosure and provider-retention review remain production-readiness gates.

## Phase 4.3 end-to-end technical audit

Phase 4.3 traced the complete path from `CompilerPanel` through `AITutorPanel`, `AITutorClient`, the single `/api/ai/explain` route, Firebase ID-token authentication, server normalization and policy, quota authorization, provider invocation, response validation and release, client validation, and React text rendering. No alternate browser provider import, AI API route, query-parameter policy override, production local fallback, debug endpoint, `VITE_` AI secret, raw HTML renderer, or provider-output escape path was found.

The enforcement boundaries are:

| Boundary | Trusted input | Validation and failure behavior |
| --- | --- | --- |
| Client panel/client | Current editor snapshot and Firebase session | Takes an immutable request snapshot, aborts replacement/unmount requests, rejects stale responses, and deep-validates the public response. It is not an authorization boundary. |
| API/authenticator | Firebase Admin token verification | Accepts one Bearer ID token and derives a frozen principal containing only verified UID. Missing, invalid, expired, or revoked tokens fail closed. Body identity is ignored by authorization. |
| Feature gate | Verified UID plus server configuration | Evaluates before quota/provider construction. The server kill switch, allowlist, deterministic rollout, and exact zero/full rollout boundaries cannot be changed by request fields. |
| Activity/request normalization | Server activity result plus bounded request fields | Discards unknown fields, limits every string and the total body, fixes supported languages, binds selections and compiler evidence to exact source hashes, and holds unknown/untrusted activities at Level 1 hints-only. |
| Sensitive-content inspector | Normalized untrusted learner content | Centrally rejects high-confidence secrets in code/selection and redacts them from output/title context before provider construction. Detection is defense-in-depth and remains heuristic. |
| Quota authorization | HMAC identity and server-derived worst-case envelope | Firestore transactions reserve burst, sustained, hourly, daily, token, and optional integer-cost ceilings before provider invocation. Production cannot use the process-local store. |
| Provider adapter | Provider-neutral system instruction and learner-data envelope | Owns only credentials, transport, model selection, timeout/cancellation, and provider response/usage extraction. It cannot set Tutor policy or authorize release. |
| Server response boundary | Raw provider text | Performs bounded parsing, versioned schema validation, evidence-claim validation, complete-solution/replacement-code release checks, and public error sanitization. All checks fail closed. |
| React response renderer | Deep-validated public Tutor response | Renders a fixed component tree as text; no arbitrary HTML, Markdown component selection, raw provider body, or credential reaches the browser UI. |

The audit found and fixed one genuine invariant defect: a duplicate quota reservation ID previously reused an existing reservation even when its identity, estimate, or authorized maximum differed. Both the process-local and Firestore transaction stores now accept a duplicate ID only when all three bindings match. A mismatch fails closed as non-retryable `ai/idempotency-conflict` (HTTP 409) without changing quota state. Exact duplicates and duplicate settlement remain idempotent, including concurrent identical local reservations.

Targeted audit coverage now explicitly includes successful execution with empty output, timeout-to-static downgrade, Java compiler diagnostics, exact Unicode source hashing, multiline selection binding, zero/full rollout and kill-switch behavior, incomplete/unsupported provider configuration, invalid production token constraints, and conflicting reservation IDs. Existing suites continue to cover Python runtime errors, stale/forged evidence, prompt injection, sensitive content, solution extraction, malformed responses, quota exhaustion, duplicate active requests, cancellation, narrow layout, accessibility, and sanitized telemetry.

Hugging Face with `openai/gpt-oss-120b:fastest` remains test infrastructure. The provider factory and `AIProvider` contract prove that adapters are replaceable without changing authentication, Tutor policy, quota, evidence, schema validation, release policy, feature gating, telemetry, or the evaluation matrix. Phase 4.1 recommends OpenAI GPT-5.4 Mini as the eventual primary candidate and Anthropic Claude Sonnet 5 as backup candidates; neither is configured or approved for production. Each exact production adapter/model still requires its own schema-capability work, controlled evaluation, privacy review, and rollout approval.

Phase 4.3 establishes technical readiness for those remaining external gates. It does not establish production readiness and does not authorize feature enablement or deployment.

## Phase 4.4 runtime configuration

The production endpoint remains the single Vercel function at `/api/ai/explain`. The checked-in Vercel configuration gives only that function a 60-second maximum duration and opts it into cancellation. The provider deadline remains 45 seconds, leaving bounded time for response sanitization, quota settlement, telemetry dispatch, and the HTTP response before the platform limit. This configuration does not prove that every client disconnect is surfaced by the deployed runtime; a deployed synthetic cancellation check remains mandatory.

Production credential initialization is keyless and request-scoped. `@vercel/oidc` obtains the platform workload token from Vercel server request context, and `google-auth-library` supplies that token to Google's external-account flow for service-account impersonation and refreshable short-lived credentials. The resulting credential is injected into both the Firebase Admin app used for revoked Firebase ID-token verification and the direct named-database Firestore client. The learner's `Authorization` Firebase token is never used as a Google subject token.

`FIREBASE_PROJECT_ID` pins the target project; `GOOGLE_WIF_AUDIENCE` and `GOOGLE_WIF_SERVICE_ACCOUNT_EMAIL` identify the separately provisioned WIF resources. Production rejects missing/malformed platform identity, exchange/refresh failures, service-account JSON, and unrelated ADC rather than falling back. Local development continues to use ADC or mocks. No workload credential is persisted, logged, telemetered, exported to `VITE_`, or included in browser code. This is code readiness only: the external WIF pool/provider and deployed exchange still require a separately authorized provisioning and verification step.

The quota collections are server-only:

```text
aiTutorQuotas/{hmacUid}
aiTutorQuotaReservations/{requestId}
```

Browser clients have no matching allow rule, so the existing Firestore rules deny their access. Firebase Admin bypasses client rules and must instead use narrowly reviewed IAM. Direct document transactions require no composite index. Reservation cleanup requires an external TTL policy on `aiTutorQuotaReservations.expiresAt`; TTL is delayed cleanup rather than quota authorization, so abandoned capacity remains conservative until the UTC daily counter resets.

`scripts/validate-ai-tutor-production-readiness.mjs` is a non-mutating repository gate. It verifies the complete environment-variable template, disabled rollout defaults, empty secret placeholders, WIF adapter/injection boundaries, production rejection of long-lived Admin JSON, environment ignore rules, Vercel cancellation/duration configuration, server-only quota rules, the API enforcement chain, and browser/provider isolation. It validates source configuration only; it does not inspect Vercel secrets, WIF/IAM, Firestore, TTL, telemetry destinations, or provider accounts.
