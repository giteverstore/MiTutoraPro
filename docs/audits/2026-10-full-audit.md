# Executive Summary

This time-boxed audit reviewed the highest-risk YCoders trust boundaries first: browser and remote compilers, interactive stdin, authentication/authorization, Firebase rules, public/server APIs, compiler Share/Feedback, payments, secrets, and deployment configuration. It then sampled Projects, frontend state, accessibility, performance, dependencies, and test quality.

No critical payment, authentication, Firestore authorization, or server-side remote-runner bypass was confirmed. The audit originally confirmed one **high-severity** JavaScript/TypeScript runtime-isolation weakness. That finding (AUDIT-001) was remediated on 2026-10-01 with a fail-closed Worker capability boundary, pre-evaluation dynamic-import rejection, Worker-only CSP, and a passing real-Chromium hostile-capability matrix.

The audit records 10 findings: **0 Critical, 1 High, 4 Medium, 2 Low, and 3 Informational**. The production build succeeds. Compiler, API, project, auth-layout, and financial focused tests produced 694 passing assertions in the executed runs, with known collection/emulator failures documented separately.

# Scope

Reviewed repository entrypoints and representative real paths for the public site, auth, AppShell, learning content, Practice, Challenges, Projects/Workspace, compiler surfaces, Firebase, Vercel APIs, payments, AI, and deployment/build tooling. All registered compiler families were mapped; browser runtime lifecycle and stdin implementations received deeper attention than cosmetic UI.

No production traffic, destructive security testing, deployment, dependency upgrade, commit, or application fix was performed.

# Methodology

1. Enumerated tracked files, deployable API entrypoints, server modules, compiler modules, tests, and deployment configuration.
2. Traced input through client, Worker/runtime, API handler, service, persistence, cleanup, and error boundaries.
3. Reviewed auth/token verification, ownership enforcement, canonical-content authorization, rate limits, feature gates, request limits, signatures, idempotency, and response sanitization.
4. Reviewed Firestore and Storage rules and their negative tests.
5. Performed targeted static searches for dynamic execution, DOM injection, storage, messaging, Workers, SAB/Atomics, fetch, timers/listeners, and environment variables.
6. Ran focused unit/contract tests, project tests, compiler tests, financial tests, repository validators, a safe runtime capability probe, and a production build.
7. Classified only evidenced issues; theoretical risks are marked `POTENTIAL` or `HARDENING`.

# Overall Risk

Overall residual risk is **Moderate**. JavaScript/TypeScript compiler isolation is no longer an open High finding, although a browser Worker remains a capability-controlled execution boundary rather than a hardened OS sandbox. Remote Go/Rust code is designed around authenticated/canonical authorization, HMAC-signed runner calls, quotas, timeouts, and container isolation, but production infrastructure was not exercised in this audit.

# Fully Audited Areas

- Compiler registry/manager dispatch and JavaScript/TypeScript Worker execution.
- HTML/React preview iframe boundary and message validation.
- Interactive stdin protocol, execution IDs, SAB sizing, timeout/cancel lifecycle for JS, Python, native, PHP, R, and .NET implementations; Java confirmed buffered-only.
- Compiler public API routing, Share, Feedback, janitors, public remote, and public MySQL handlers.
- Remote compiler control-plane auth, canonical content authorization, quotas/signing code paths, and feature gates by inspection and contract tests.
- Payment API routing, raw webhook body handling, Razorpay signatures, reconciliation auth, provider evidence, and server-side persistence orchestration.
- Firestore and Storage rules, especially user ownership, compiler collections, finance collections, certification records, and published content.
- Vercel host routing, function consolidation, compiler COOP/COEP, deployment targets, and daily crons.
- Secret hygiene over all 1,940 tracked files.

# Partially Audited Areas

- Python, Java, C/C++, PHP, R, .NET, Assembly, SQL/SQLite, and MySQL runtime internals: lifecycle and representative tests were reviewed; every third-party WASM host import was not manually reverse-engineered.
- Auth UI/session synchronization: main flows and server token verification were traced; live Google/email reset flows were not exercised.
- AI: auth, premium guard, quota, provider key placement, sensitive-content filters, and smoke authorization were sampled; model behavior was not live-tested.
- Projects Workspace: multi-file operations, preview gating, local preferences/state, and focused tests were reviewed; long-session Monaco memory profiling was not performed.
- Accessibility/responsiveness: important semantics were inspected and component tests sampled; no full assistive-technology or device matrix was run.

# Unaudited Areas

- Live production Firebase, Razorpay, AI provider, Go/Rust runner, or MySQL infrastructure.
- Full browser E2E across Chromium, Firefox, and Safari.
- Exhaustive reverse engineering of bundled third-party WASM/native assets.
- Visual regression at every responsive breakpoint.
- Full dependency advisory lookup (registry access failed in the audit shell).
- Exhaustive dead CSS/component reachability analysis.

# Critical Findings

None confirmed.

# High Findings

- **AUDIT-001 (fixed 2026-10-01):** Same-origin JavaScript/TypeScript Worker formerly retained network and Worker-global capabilities.

# Medium Findings

- **AUDIT-002:** Browser compiler output and React transcript growth are unbounded.
- **AUDIT-003:** Browser runtimes lack a central source/buffered-stdin byte gate.
- **AUDIT-004 (remediated 2026-10-01):** `firebase-admin` remains a required production serverless dependency; the repository now enforces its absence from browser source and build artifacts instead of rejecting correct server packaging.
- **AUDIT-005:** Initial CSS/JS exceed enforced project performance budgets.

# Low Findings

- **AUDIT-006:** Coin suite references removed `src/styles.css` and fails collection.
- **AUDIT-007:** Compiler “isolation” tests omit Worker capability-denial coverage.

# Informational / Hardening

- **AUDIT-008:** No consolidated CSP/content-type/referrer/frame policy exists in repository deployment configuration.
- **AUDIT-009:** Compiler Firestore acceptance depends on a purpose-built emulator/credential wrapper and times out under generic Vitest.
- **AUDIT-010:** Pyodide package auto-loading and warm reuse need an explicit network/state policy.

# Compiler Runtime Findings

The compiler architecture cleanly separates registry metadata, manager dispatch, runtime clients, and Workers. Timeouts generally terminate disposable workers. Remote runners have materially stronger request/result/container policies than browser runtimes.

The central security distinction remains important: a Web Worker/WASM runtime is not a hardened hostile-code sandbox. HTML/React preview uses `sandbox="allow-scripts"` without `allow-same-origin` and validates `event.source` plus a random channel. JavaScript/TypeScript now uses an explicit fail-closed Worker-global capability boundary, pre-evaluation dynamic-import denial, and Worker-only CSP; real Chromium request observation validates the network boundary.

Remote Go/Rust handlers use strict feature gates, Firebase token verification for learning executions, canonical content/language authorization, transactional quotas, request byte limits, signed runner calls, cancellation, and sanitized public errors. Public remote execution is separately gated and rate-limited. MySQL uses ephemeral databases/users, restricted grants, SQL policy checks, byte/row/time limits, cancellation, and cleanup, while production public execution remains feature-gated.

# Interactive STDIN Findings

The shared protocol binds submissions to an execution ID and only accepts input while the channel state is `WAITING`. Interactive UTF-8 payloads are bounded by a 64 KiB SAB. Compute timers pause during human input and a separate approximately 90-second input timer prevents indefinite waits. Cancellation terminates/disposes runtime state in the inspected clients.

No stale-input cross-execution bug was confirmed. Java is correctly buffered-only. Remaining risk is resource-related: initial buffered stdin is not governed by the interactive 64 KiB limit, streamed output/transcripts are unbounded, and real multi-browser SAB/Atomics acceptance remains a test gap.

# Auth / Authorization

Server APIs use Firebase Admin ID-token verification rather than trusting client UID fields. Sensitive learning compiler execution re-resolves canonical content and premium entitlement server-side. Auth return navigation accepts only same-origin absolute paths beginning with `/` and rejects protocol-relative redirects. Firestore rules prevent clients from assigning privileged roles or mutating server-owned financial/certification state.

No usable client-only privilege boundary or cross-user authorization bypass was confirmed. Live token refresh, revocation timing, Google popup behavior, and custom-claim operational workflows were not exercised.

# Firebase / Data Rules

Rules enforce owner reads for user-scoped records, monotonic progress revisions, constrained profile fields, published-only public content, and deny client writes to financial, compiler backend, reward, certification, and audit collections. Storage permits only active JSON content at enumerated public paths and denies all writes/default access.

Rule tests include cross-user, anonymous, forged financial, forged certificate, admin-role injection, and public-content cases. The emulator-backed acceptance gap is documented as AUDIT-009; it is not evidence that the deployed rules fail.

# APIs

Eight deployable API entrypoints were enumerated. Compiler and payment families are thin routers over service handlers. Inspected handlers validate methods, content types, request sizes where exposed to public execution, auth, origin where browser-public, quotas, feature gates, and sanitized responses. Unknown compiler/payment routes return 404.

Development-only API behavior is gated in local Vite plugins rather than exposed as production Vercel entrypoints. Cron handlers require secrets and use timing-safe comparison. No direct runner bypass was found by inspection; internal runner calls are HMAC signed with timestamp and execution ID.

# Compiler Share / Feedback

Shares use 16 random bytes encoded as 22-character base64url IDs, a 30-day TTL, immutable creation, 64 KiB source/stdin limits, and generic not-found behavior. Stdin is stored only when explicitly included. Feedback allowlists fields and bounds description/context. Anonymous/authenticated requests are transactionally rate-limited using UID or a truncated hash of client address. Firestore client access to all backing collections is denied. Janitor authorization is secret-based and timing-safe.

The privacy contract should continue to tell users that anyone holding a share link can read its code and optional stdin until expiration.

# Payments

Order and verify endpoints require Firebase authentication and server-side rate limits. Provider amounts, currencies, order/payment linkage, signatures, capture/refund/dispute evidence, and lifecycle states are validated server-side. Webhooks use the raw request body with HMAC verification and provider event IDs; body parsing is disabled at the Vercel entrypoint. Reconciliation is protected by a minimum-length cron secret and timing-safe comparison. Financial collections are client-denied by rules.

No client-trusted amount, unsigned webhook path, or direct financial Firestore write was confirmed. Unit tests covered provider, webhook, settlement, idempotency, wallet, referral, and subscription logic; the stale stylesheet collection failure is AUDIT-006.

# AI

AI API keys remain server-side. The explain endpoint authenticates Firebase users, enforces premium access, reserves quota, bounds/filters tutor context, and provides a separate signed/one-use smoke authorization path. AI output is rendered as application text rather than privileged tool actions in the inspected workspace.

Live provider behavior and adversarial model-output testing were not performed. Production-readiness validation was not relied on because that script is already dirty in the user's worktree.

# Projects Workspace

Focused tests validate file create/rename/delete contracts and premium guide gating. Preferences and progress are localStorage-based; this is appropriate only if the product intentionally treats them as device-local state. Project editor/preview/runtime state shares compiler limitations from AUDIT-001 through AUDIT-003. No confirmed path traversal into a host filesystem exists because project files are in-browser models.

# Frontend / State

Abort controllers and worker clients generally cancel on reset/new runs, and preview message listeners are removed on cleanup. Auth/profile synchronization avoids rendering authenticated application state until Firebase and local profiles agree. No confirmed cross-account local profile exposure was found in the traced flow.

Large components and source-text-coupled tests remain maintenance risks. Long-duration navigation/model disposal was not memory-profiled.

# Privacy

Sensitive server collections are client-denied. Share stdin is opt-in. Feedback explicitly does not attach source/stdin automatically and persists allowlisted context. Public rate limits retain hashed address-derived identifiers with expiry. Server logs reviewed use error codes, execution IDs, and hashes rather than learner source or secrets.

Residual privacy risks are capability access from learner JavaScript (AUDIT-001) and intentional public share-link disclosure. No committed credential was found.

# Accessibility

Key inspected controls use buttons, labels, tab roles, dialog focus handling, terminal `role="log"`, and descriptive aria labels. The compiler terminal uses `aria-live="polite"`; unbounded rapid output can itself become an assistive-technology performance issue. A full keyboard/screen-reader audit was outside the time-box.

# Performance

The production build took 57.98 seconds and succeeded. Initial CSS is 419.41 kB (64.00 kB gzip); initial JS is 994.99 kB (258.63 kB gzip). Monaco, Babel, and TypeScript each produce roughly 2.9-3.6 MB minified chunks. PHP WASM assets are roughly 20 MB each, ONNX is 2.33 MB, and ONNX runtime WASM is 13.48 MB. Heavy runtimes are largely lazy-loaded, but route/static import conflicts and global CSS defeat intended budgets.

Output flooding and oversized source/stdin are additional runtime performance risks (AUDIT-002/003).

# Deployment / Vercel

`vercel.mjs` distinguishes `main` and `compiler`, preserves the consolidated compiler API rewrite, and applies COOP/COEP only to compiler custom/stable/preview hosts matching the host regex. Main YCoders is not globally cross-origin isolated. Compiler receives the share janitor daily; main receives payment reconciliation and share janitors daily. No Hobby-incompatible subdaily cron remains.

Environment target selection is build/config-time. Browser app selection also checks compiler hostnames and the local `__compiler` route. Header defense-in-depth is AUDIT-008.

# Dependencies

Secret hygiene passed over 1,940 tracked files. `npm audit` could not reach the registry advisory endpoint in this restricted environment, so current CVE status is unverified. Build warnings identify `eval` inside PHP-WASM dependencies and browser externalization of `worker_threads`; these are third-party/runtime compatibility observations, not proof of an exploit.

The original dependency-boundary validator failed on correct production placement of `firebase-admin` (AUDIT-004). The repaired rule requires production server availability while rejecting Admin SDK imports from all canonical browser source. Positive/negative fixtures, server regressions, a production build, and a clean browser-artifact scan now close this finding.

# Test Gaps

- Real-browser hostile JS/TS capability denial.
- Bounded output/source/stdin across every browser runtime.
- Long-session WASM/Monaco/Pyodide memory measurements.
- Deterministic generic invocation of compiler Firestore acceptance (AUDIT-009).
- Cross-browser SAB/Atomics interactive stdin.
- Live remote runner/container and production provider paths in this audit environment.
- Full accessibility and responsive-device matrix.
- Dependency advisory scan with registry connectivity.

# Dead Code / Maintainability

No dead code was deleted or conclusively classified. The source still includes multiple development/runtime validation paths by design. One demonstrably stale artifact is the coin UI test's reference to removed `src/styles.css`. Large route/components, duplicated runtime client lifecycle patterns, and capability checks distributed across metadata/client/UI increase regression risk.

# Recommended Remediation Order

## P0 — Fix before next production release

1. AUDIT-001: establish a real capability/origin boundary for learner JS/TS.
2. AUDIT-002: cap streamed and accumulated compiler output.
3. AUDIT-003: enforce central source and stdin byte limits.

## P1 — Fix immediately after P0

1. AUDIT-004: remediated; retain the passing Firebase Admin browser/server boundary guard.
2. AUDIT-006/007/009: restore trustworthy financial/compiler security test signals.

## P2 — Reliability/performance work

1. AUDIT-005: reduce initial CSS/JS and restore effective route splitting.
2. AUDIT-010: formalize Pyodide network, state, memory, and reset policy.

## P3 — Maintenance/polish

1. AUDIT-008: roll out tested host-specific security headers/CSP.
2. Complete accessibility, responsive, dead-code, and long-session profiling passes.

# Appendix: Files / Areas Reviewed

The audit inventory covered **1,940 tracked files** by secret/static validation. **Approximately 185 files were directly reviewed or exercised** through source tracing and focused test/build execution, including:

- all 8 `api/**` deployable entrypoints and compiler/payment routers;
- 76 `server/**` modules by inventory, with direct tracing through compiler-public, remote compiler, MySQL, auth credential, AI auth/quota, payment, coin/activity, and Firebase Admin boundaries;
- 99 compiler files by inventory, with direct review of manager/registry, preview, JS/TS, Python, Java, native C/C++, PHP, R, .NET, Assembly, SQL, MySQL, remote clients, stdin protocol, and output normalization;
- `firestore.rules`, `storage.rules`, Firebase setup/repositories, and security-rule tests;
- Vercel/Vite/build scripts, `package.json`, lockfile metadata, and validation scripts;
- auth providers/context/service/navigation, access policy, project workspace/services, standalone compiler, shared compiler UI, and representative AppShell/public components;
- 73 focused test files executed across compiler, projects, auth layout, and financial domains.

# Appendix: Commands / Tests Run

- Repository inventories with `rg --files`, API/server/compiler/test counts, and targeted static searches.
- Safe JavaScript capability probe: `executeJavaScriptSource` with `typeof globalThis.fetch` → `function`.
- Focused Vitest compiler/project/auth run: **36 passed files, 1 skipped, 1 environment-failed; 361 passed tests, 2 skipped, 9 emulator-dependent failures**.
- `npm.cmd run test:coins:unit`: **34 passed files; 333 passed tests; 1 collection failure** from removed `src/styles.css`.
- `npm.cmd run validate:secret-hygiene`: passed, 1,940 tracked files.
- `npm.cmd run validate:dependency-boundaries`: originally failed on `firebase-admin` placement; after remediation it passed across 469 browser modules.

## Firebase Admin dependency-boundary remediation — 2026-10-01

AUDIT-004 and VALIDATION-006 were caused by package classification, not by a client import or proven bundle leak. Moving `firebase-admin` to development-only dependencies would recreate the historical Vercel runtime failure, so it remains in root production dependencies. The validator now fails closed on Admin SDK and related server-only imports in browser source, while server/API modules, Node scripts, Functions, and Node tests retain legitimate access.

The existing `server/firebaseAdminApp.js` remains canonical: ordinary serverless calls reuse the named `mitutora-server` app through a module-level promise; federated request-scoped apps are explicitly deleted; credentials come only from server `process.env`; malformed or missing production configuration becomes a sanitized `ai/server-unavailable` error. Emulator endpoints remain environment-driven.

Validation passed: boundary fixtures 3/3, compiler/API focused tests 25/25, compiler-public Auth/Firestore emulator acceptance 9/9, payment server tests 28/28, Admin initialization/WIF tests 71/71, Node Admin import and script syntax probes, production build, and recursive `dist` scan with no Admin SDK or credential markers. Residual risk is limited to future browser roots outside `src/`, which must be enrolled in the validator.
- `npm.cmd run validate:css-architecture`: passed, 20 stylesheets, no duplicate/circular imports.
- `npm.cmd run validate:bundle-budgets`: failed initial CSS raw/gzip budgets and dynamic-route assertions.
- `npm.cmd audit --json`: blocked by restricted registry access; no advisory result available.
- `npm.cmd run build`: passed in **57.98s**, with PHP-WASM eval/worker externalization, ineffective dynamic import, and large-chunk warnings.
- Final `git diff --check` is recorded in the handoff; only these audit documents were authored by this phase.
## Compiler resource-limit remediation follow-up — 2026-10-01

AUDIT-002 and AUDIT-003 have an implemented shared browser policy in `src/compiler/core/compilerResourcePolicy.js`. It applies before heavy runtime initialization across standalone and embedded compiler consumers. Final values are: 512 KiB source, 256 KiB buffered stdin, 32 KiB interactive submission, 512 KiB cumulative interactive input, 2 MiB stdout, 1 MiB stderr, 4 MiB rendered transcript, and 1,000 SQLite result rows. Remote Go/Rust, Share, and MySQL retain their stricter existing server limits.

Streaming stdout/stderr are incrementally measured; exceeding a canonical stream aborts the active runtime and prevents expected-output validation from accepting truncated output. The standalone transcript retains only its newest 4 MiB and inserts one visible truncation marker. Same-instance rapid runs abort their predecessor and all resource-limit paths clear manager state in `finally`.

Unit/runtime regression coverage passed. Production builds passed in 1m14s and 56.95s with the pre-existing PHP-WASM, import-splitting, and chunk-size warnings. After granting the test browser access to the pinned Pyodide CDN and correcting the test's PHP/C# source entry, real Chromium output exhaustion and recovery passed for JavaScript/TypeScript, Python, C, PHP, R, and C#. The strict representative-browser closure gate is satisfied.

## Bundle/performance remediation follow-up — 2026-10-01

AUDIT-005 and VALIDATION-007 are remediated without changing their budgets. The measured initial payload moved from 999,409 bytes / 260,092 gzip JavaScript and 419,413 bytes / 64,004 gzip CSS to 973,487 bytes / 254,039 gzip JavaScript and 30,293 bytes / 6,643 gzip CSS. All 12 required route entries now pass, including Auth and Course. Product CSS is owned by lazy surface entrypoints, public heavy routes are lazy, and referral attribution no longer pulls the user-data/Firestore path into ordinary startup.

The production build and unchanged budget validator pass. CSS architecture, dependency boundaries, and focused public/auth/AppShell/Home/Library/Practice/Projects/Course/standalone/compiler tests pass. Mixed static/dynamic import warnings observed in the baseline are resolved. Monaco, MediaPipe vision, Silero, Babel, TypeScript, PHP-WASM, WebR, .NET, TeaVM, native, and Assembly tooling remain on-demand; no runtime implementation, dependency version, budget, or source-map policy changed.

Residual risk is the modest JavaScript gzip margin and the cold cost of intentionally large lazy runtimes. Mobile visual/performance automation remains constrained by VALIDATION-005/009, so this remediation proves bundle graph and component behavior rather than a complete device performance matrix.

## Stale coin-test remediation follow-up — 2026-10-01

AUDIT-006 is remediated. The obsolete `src/styles.css` read was replaced with semantic checks against `theme.css`, `pages/home.css`, and `layout/app-shell.css`. Trace work also caught a route-ownership regression from CSS splitting: the Redeem rules remained in Home CSS but the Redeem route did not load them. `RedeemPage.jsx` now imports that existing sheet. The light/dark coin tokens remain `#b7791f` / `#facc15`, coin visuals consume `--color-coin`, and intentional success styling remains token-driven.

The complete coin configuration passes 35 files / 337 tests with no collection error. Related light/dark/brand/AppShell tests pass 18/18, CSS architecture validation passes, and the production build passes in 39.44 seconds. Product coin amounts, wallet logic, redemption prices, theme catalog, and flows were not changed.

## Security-header hardening follow-up — 2026-10-01

AUDIT-008 is remediated through `config/securityHeaderPolicy.mjs`. Main-site documents now receive an enforced, compatibility-safe CSP (`base-uri`, `object-src`, `frame-ancestors`, `form-action`), `nosniff`, explicit referrer and permissions policies, HSTS without preload/includeSubDomains, and frame denial. Compiler hosts add COOP `same-origin`, COEP `require-corp`, and CORP `same-origin`; main hosts do not. API responses receive an appropriate reduced policy, and the learner JavaScript Worker retains its separate deny-network CSP. Vite development/preview uses the same document policy without HSTS and deliberately enables isolation for runtime testing.

The policy inventory documents Firebase/Google, Razorpay, jsDelivr, Google model storage, Workers, WASM, Monaco, and runtime-evaluation constraints. Broad source-list directives were not added without telemetry. Header/config/routing tests, auth and runtime contracts, hostile JS/TS Chromium tests, real Chromium cross-origin isolation, dependency boundaries, and the production build pass. Live deployed-host and Google-popup smoke verification remains post-deployment work.
## Firebase emulator remediation note — 2026-10-01

AUDIT-009's fail-open/generic-invocation ambiguity is repaired: compiler acceptance requires its wrapper, pinned demo project, and loopback hosts, and passed five fresh 9-test runs. Rules suites now use owned, isolated wrappers and coin rules passed five consecutive runs. The remaining Windows outer-process hang is validation infrastructure rather than product behavior and remains open under VALIDATION-005; see `docs/audits/validation-environment.md`.
