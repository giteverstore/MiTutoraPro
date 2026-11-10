# Implementation roadmap

This is a recommended sequence, not implementation approval.

## Phase 0 — asset inventory and decisions

- **Objective:** establish verifiable Blind 150 inputs and product policies.
- **Scope:** inventory/hashes/license; schema and cross-language semantics; retention/reward decisions.
- **Dependencies:** actual archive and owners.
- **Affected areas:** new audit/import tooling and design records only.
- **Security:** classify public/protected material before any build.
- **Tests:** manifest uniqueness/counts, archive integrity, leak baseline.
- **Acceptance:** all reported assets/counts independently reproducible; unresolved questions assigned.
- **Complexity:** medium.

## Phase 1 — versioned contracts and public ingestion

- **Objective:** model Mode B without changing Course behavior.
- **Scope:** public question/template schema, tagged values, callable/mutation/state contracts, validated public artifacts.
- **Dependencies:** Phase 0 semantics.
- **Affected areas:** Practice/content models and repositories, compiler definition normalization, ingestion scripts.
- **Security:** protected fields rejected from public artifacts.
- **Tests:** schema compatibility, serialization corpus, bundle leak scans, old-content regression.
- **Acceptance:** current Mode A content loads unchanged; a fixture question loads all admitted templates.
- **Complexity:** high.

## Phase 2 — browser public-run harness

- **Objective:** implement Mode B Run for public cases while reusing the UI.
- **Scope:** execution strategy, per-language harness interface, per-case result UI.
- **Dependencies:** Phase 1 and runtime conformance fixtures.
- **Affected areas:** `CompilerPanel`, `useCompilerExecution`, runtime adapters, output region.
- **Security:** clearly advisory; no completion/reward authority.
- **Tests:** nine-language public corpus, errors/timeouts, mutations/state, Mode A regressions.
- **Acceptance:** public cases produce deterministic normalized results; Course is unchanged.
- **Complexity:** very high.

## Phase 3 — Python judge non-production proof

- **Objective:** operationalize and prove the existing Python Firecracker design.
- **Scope:** authenticated API, queue, protected registry, pinned image, isolated worker, result protocol.
- **Dependencies:** KVM environment, security ownership, Phase 1 contracts.
- **Affected areas:** `functions/src/python-judge/`, new deployment/operations resources, submission repository.
- **Security:** full threat gates, teardown proof, no network/credentials, redacted diagnostics.
- **Tests:** conformance, malicious corpus, fault injection, contamination, replay, load, provenance.
- **Acceptance:** all security gates pass in non-production; no learner/reward endpoint enabled.
- **Complexity:** extreme.

## Phase 4 — shadow Submit and trusted result persistence

- **Objective:** validate end-to-end authority without changing learner outcomes.
- **Scope:** submit client, queue/status UI, shadow comparison, idempotent records.
- **Dependencies:** Phase 3 approval.
- **Affected areas:** Practice/Challenge orchestration, activity completion service, Firestore schema/rules, judge API.
- **Security:** authenticated bindings; protected data never enters client/logs.
- **Tests:** tampering, retries, auth, stale versions, queue failure, result attestation.
- **Acceptance:** stable shadow agreement and operational SLO/cost evidence.
- **Complexity:** high.

## Phase 5 — Python authority cutover

- **Objective:** make verified Python Submit authoritative for selected questions.
- **Scope:** cohort rollout, rewards/progress integration, support/rejudge workflow.
- **Dependencies:** policy approval, Phase 4 evidence.
- **Security:** circuit breaker, quotas, monitoring, incident response.
- **Tests:** transactional rewards, legacy compatibility, rollback, production canary.
- **Acceptance:** approved error/latency/cleanup/cost thresholds with no protected leakage.
- **Complexity:** high.

## Phase 6 — additional languages

- **Objective:** admit Java, then remaining languages independently.
- **Scope:** pinned image and harness per language; resource profiles and conformance.
- **Dependencies:** successful Python operations and language-specific security review.
- **Affected areas:** judge images/adapters/registries and language manifests.
- **Security:** repeat—not inherit—containment, dependency, CVE, and abuse gates.
- **Tests:** reference corpus, semantic edge cases, hostile corpus, load/cleanup per language.
- **Acceptance:** each language passes its own approval; unsupported question/language pairs stay unavailable.
- **Complexity:** extreme.

## Phase 7 — Daily Challenge migration and optimization

- **Objective:** reference authoritative question versions from Daily Challenges and scale safely.
- **Scope:** assignment bindings, historical compatibility, measured pooling/autoscaling where approved.
- **Dependencies:** stable judge languages and content publication workflow.
- **Affected areas:** challenge content source, completion verification, operations.
- **Security:** no protected fixtures in assignment documents; snapshot reuse only after proof.
- **Tests:** date/version resolution, historical replay, burst/load, rollback.
- **Acceptance:** deterministic assignments, trusted completion, measured SLO and budget.
- **Complexity:** high.
