# Authoritative Activity Verification

**Status: high-assurance boundary implemented and deferred; MVP local-reward foundation separate**

The selected future execution design is documented in [Isolated Code Judge Architecture](isolated-code-judge.md). It is explicitly **PROPOSED / NOT IMPLEMENTED**; this boundary remains disabled.

Practice and Daily Challenge execute learner code in browser Web Workers. For MVP this is low-trust `LOCAL_VERIFIED_ACTIVITY` evidence for bounded non-cash game coins after the server independently resolves canonical identity/version and derives the enabled `mvp-v1` policy. It is never `SERVER_VERIFIED_ACTIVITY` or `FINANCIAL_EVENT` evidence. Practice and Daily Challenge rewards are code/policy activated at 5 and 20 coins respectively, with a concurrency-safe 100-coin daily cap; production deployment remains separately gated.

## Existing execution boundary

```text
Monaco source
→ CompilerPanel
→ CompilerManager
→ PythonWorkerClient / JavaWorkerClient
→ browser Web Worker
→ Pyodide / TeaVM
→ browser output validator
→ local completion state
```

The browser owns the source, runtime, output, expected-output comparison, and local completion state. React state, local storage, compiler events, and client-reported `passed` values are therefore not reward evidence. The current backend does not receive Practice or Daily Challenge submissions and has no server-side judge.

Practice metadata binds each published question to a versioned Storage path and SHA-256 content hash. Server-only fixture modules contain protected tests and reference implementations for 194 of the 200 published IDs; those values are excluded from learner-facing Firebase artifacts. Six legacy IDs at positions 21–26 have no matching private definition. Practice therefore needs that server-only mapping completed, in addition to a safe executor, before the whole catalog is reward-verifiable.

Daily Challenge metadata currently has a published version and Storage path but no content hash. Its learner artifact has a single visible compiler input and expected output, not a protected test suite. Daily Challenge is therefore missing both strong content-integrity binding and sufficient hidden verification cases.

## Intended architecture

```text
local run → Solved Locally
→ authenticated verification request
→ authoritative activity resolver
→ published version + content hash + private test definition
→ isolated execution sandbox
→ trusted completion recorder
→ versioned reward-policy lookup
→ atomic claim/coin transaction
→ sanitized result
```

`ActivityVerificationService` is the shared orchestration boundary. `PracticeVerifier` and `DailyChallengeVerifier` use the same executor contract while retaining type-specific routing. Requests accept only `activityType`, `activityId`, `contentVersion`, `language`, and `sourceCode`. UID comes from verified Firebase authentication. Expected values, compiler output, timestamps, completion flags, reward amounts, policy versions, balances, and UID are rejected as client authority.

The resolver must load metadata, exact canonical bytes, and private tests from server-owned sources. It verifies the canonical SHA-256 before releasing a definition. The service requires an executor that declares and enforces hard timeout, memory and output ceilings, no network, no filesystem, and process/container isolation. A normal Vercel function or Firebase Function process is not that sandbox.

On success, the service emits only server-derived evidence with assurance `SERVER_VALIDATED_EXECUTION`. A trusted completion recorder may then create the durable claim. Reward lookup remains separate and fail-closed. The production reward registry is empty, so even a successful future verification must report that rewards are unavailable until product-approved amounts and policy versions exist.

## Threat controls

| Attack | Required control |
|---|---|
| Call reward without solving / send `passed=true` | No public reward endpoint; server judge must pass first |
| Fabricated output or supplied expected output | Reject the fields; use server-owned tests and captured sandbox result |
| Changed activity ID or output from another problem | Resolve ID to exact published metadata, bytes, hash, and tests |
| Changed version or stale content | Exact active-version and SHA-256 match |
| Another user's activity | UID only from verified Firebase token; owner-bound durable claim |
| Reward amount, policy, balance, or timestamp manipulation | Server policy, server transaction, server timestamp; reject client fields |
| Replay, duplicate, or concurrent claim | Deterministic owner/activity evidence and M2.1 transactional idempotency |
| Weak public-test-only solution | Private deterministic tests, bounded by an approved maximum |
| Arbitrary-code host compromise | Dedicated sandbox with hard CPU/time/memory/output limits and no network/filesystem |
| Local completion manipulation | Keep `Solved Locally` distinct from `Verified` and `Coins Earned` |

## Options evaluated

1. **Client execution and client result:** unsuitable. Every relevant signal is attacker-controlled.
2. **Independent server execution:** authoritative when backed by real isolation, but no such sandbox is present. Running submissions inside the application serverless process is prohibited.
3. **Static/deterministic source inspection:** insufficient for the existing general Python problems and Daily Challenge semantics.
4. **Hybrid local UX plus server verification:** selected target architecture. Local workers remain responsive UX; only an isolated server judge may create trusted completion evidence.

## Resource limits and pending decisions

The service has no silent production defaults: source bytes, output bytes, test count, per-test input bytes, execution timeout, and memory bytes are mandatory configuration. Tests use conservative synthetic values only. Production values require sandbox selection, load testing, cost review, and engineering approval. Concurrency must be bounded at the execution service and claims must retain transactional duplicate protection.

Pending release gates:

- select and provision a production-grade Python sandbox;
- decide whether Java activities become rewardable and provide equivalent isolation;
- add canonical hash and protected tests to Daily Challenge publication;
- define approved per-activity reward amounts and policy versions;
- define Daily Challenge recurrence/once-per-period semantics;
- implement atomic durable verification evidence/claim integration;
- expose an authenticated, abuse-limited endpoint only after the above gates pass;
- add UI states `Solved Locally`, `Verify for Coins`, `Verified`, and a distinct policy-unavailable result.

## Streak boundary

Future high-assurance streak updates may consume a durable `SERVER_VERIFIED_ACTIVITY` event. MVP local completion must remain explicitly labeled `LOCAL_VERIFIED_ACTIVITY`; it cannot masquerade as server verification or financial evidence.
