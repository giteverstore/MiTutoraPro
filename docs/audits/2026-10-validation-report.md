# Full Validation / Failure Discovery Report — 2026-10-01

# Executive Summary

This was a test-first, no-fix validation pass over commit `7495fb734513f5a2459350301ccdd37d211a9530` on `main`, including the user's dirty worktree. The production build succeeded. The primary Vitest run produced **1,271 passed, 12 failed, and 2 skipped assertions** across 92 files; targeted reruns and independent suites added **95 non-duplicated/diagnostic passing assertions**. One landing failure was confirmed flaky. Three stale source/config tests, one Java acceptance harness, the authenticated Playwright helper, and the Vite-backed runtime browser harness are reproducibly broken. No new Critical or High product defect was proven.

The repaired JavaScript/TypeScript capability boundary passed its complete hostile real-Chromium matrix: **12/12 on desktop and mobile**. Payments passed **46/46** focused tests. Share/Feedback emulator acceptance passed **9/9**. The production build completed in **3m24s**. Known dependency and bundle-budget findings remain open.

Final classification: **FULL_VALIDATION_FAILURE_DISCOVERY_COMPLETE**.

# Environment

- Windows PowerShell, `C:\Work\MiTutoraPro`
- Node.js 25.9.0
- Vitest 4.1.11
- Chromium through Playwright
- Firebase emulators were available for the dedicated compiler-public acceptance and initial rules checks, then stopped before two later direct scripts.
- Registry/network access was restricted, blocking `npm audit`.

# Commit / Worktree

- Branch: `main`
- Commit: `7495fb734513f5a2459350301ccdd37d211a9530`
- Dirty tracked files at baseline: `firebase-debug.log`, `package-lock.json`, `package.json`, `scripts/validate-ai-tutor-production-readiness.mjs`, `src/access/PremiumGate.jsx`, JavaScript runtime files, `src/home/HomeSections.jsx`, compiler routing/runtime tests, `vercel.mjs`, and `vite.config.js`.
- Untracked baseline included emulator/temp output, audit docs, JS capability-boundary source/tests, a screenshot, and generated .NET output.
- The recent JS/TS capability repair is present in the dirty worktree.
- Recent interactive-stdin implementations are present.
- This pass changed only the two validation documents.

# Test Strategy

Validation proceeded through static validators, the full unit/integration suite, isolated reproductions, emulator-backed compiler API acceptance, real Chromium security tests, payment tests, Firebase/Storage rule scripts, browser runtime scripts, the production build, and bundle checks. Failures were rerun when bounded and safe. No product source was fixed.

# Passed Areas

- 86/92 files passed in the primary Vitest run.
- Dedicated compiler Share/Feedback acceptance: 9/9.
- JS/TS hostile real-browser isolation: 12/12.
- Payment/reconciliation focus: 46/46.
- Auth layout and profile navigation: 11/11.
- Content, certification, and Storage rule scripts passed while emulators were available.
- Secret hygiene passed across 1,940 tracked files.
- CSS architecture passed across 20 stylesheets.
- Production build passed.
- Compiler unit/contract coverage in the main suite passed for Python, JS/TS, C/C++, PHP, R, .NET, SQL, MySQL policy, Assembly, HTML/React preview, and remote Go/Rust contracts except where explicitly listed below.

# Confirmed Failures

See `2026-10-validation-findings.md`. Reproducible failures are stale Vercel routing, cron-index, and AI diagnostic tests; a stale authenticated Playwright sign-in helper; Java runtime script resolution; dependency-boundary validation; bundle-budget validation; and the Vite-backed runtime browser harness.

# Flaky Tests

`public-landing.test.jsx` timed out once at five seconds under the full-suite load and passed alone in 734 ms. It is classified as a TEST FLAKE, not silently discarded.

# Environment Blockers

- npm advisory registry access unavailable.
- Authenticated browser E2E blocked by its stale sign-in helper.
- Runtime browser scripts blocked by Vite dep-scan/server shutdown behavior.
- Two late direct Firestore rule scripts found no emulator on port 8080.
- Live Google auth, payment providers, production Firebase, remote Go/Rust runner, and production MySQL were not invoked.

# Compiler Matrix

| Runtime | Unit/contract evidence | Real-browser evidence in this pass | Result |
|---|---|---|---|
| Python | Passed in broad compiler coverage | Authenticated/general browser matrix blocked | Partial pass |
| JavaScript | Passed | Hostile + normal + stdin/cancel/recovery passed desktop/mobile | Pass |
| TypeScript | Passed | Hostile + normal + stdin/cancel/recovery passed desktop/mobile | Pass |
| Java | Unit contracts present | Dedicated script blocked before execution by module resolution | Incomplete |
| C / C++ | Unit and browser-compatible Clang cases passed in Vitest | Dedicated live script lost Vite server | Partial pass |
| PHP | Unit contracts passed | Dedicated live script hit Vite failure and 10s timeout | Partial/failure discovery |
| R | Unit contracts passed | Dedicated live script not trusted after shared Vite blocker | Partial |
| C# / Visual Basic | .NET contracts passed | Dedicated live matrix not completed | Partial |
| HTML/CSS / React | Preview contracts passed | Broad authenticated E2E blocked | Partial pass |
| SQL/SQLite | Contracts passed | No separate visual browser pass | Pass by contract |
| Assembly | Unit contracts passed | Dedicated live navigation timed out | Partial |
| Go / Rust | Remote contracts and disabled policy passed; two gated integration tests skipped | No live runner | Correctly unavailable/Coming Soon |
| MySQL | Public/learning contracts and disabled policy passed | No live database | Correctly unavailable/Coming Soon |

# Interactive STDIN Matrix

JS and TS passed real Chromium cases including normal input, cancellation, and recovery through the hostile matrix. Other interactive runtimes retained passing unit/protocol evidence from the broad suite, but the requested complete real-Chromium matrix could not be truthfully claimed because the common Vite test harness failed. Java remains buffered-only by design, but its dedicated validation script failed before runtime execution. Canonical cross-language input/output cleanliness therefore remains partially validated.

# JS/TS Isolation Matrix

Passed 12/12 across desktop and mobile Chromium. Verified denial/no request escape for same-origin and external fetch, POSTs to Share/Feedback, WebSocket, EventSource, XHR, WebTransport, WebRTC entrypoints, nested Worker, SharedWorker, `importScripts`, IndexedDB, Cache Storage, BroadcastChannel, MessageChannel/MessagePort, learner `postMessage`, remote dynamic import, filesystem entrypoints, and close. Normal JS/TS, interactive stdin, cancellation, and post-cancel recovery also passed.

# Auth

Auth layout/profile component checks passed 11/11: centered sign-in/sign-up, preserved fields/actions, accessible inline errors, responsive shared shell, forced light auth surface, primary sidebar cleanup, profile utility routes, close behavior, and sign out. Real authenticated navigation, persistence, invalid credentials, stale claims, password reset, and Google provider behavior were not completed because the Playwright helper never entered the auth UI.

# APIs

Compiler Share/Feedback acceptance passed 9/9 through Auth and Firestore emulators, including ownership, quotas, janitor, and concurrency. The full compiler/API contract suite otherwise passed except stale AI diagnostic source-file assertions. Complete method/auth/malformed/oversize permutations for every route were not independently repeated.

# Firebase

Content rules, certification rules, and Storage rules passed (Storage 3/3) with expected denial logs. Compiler-public emulator acceptance passed 9/9. Coin and compiler-public direct scripts later failed only because port 8080 was no longer listening. No rules bypass was observed, but final coverage is partial.

# Payments

Six focused payment suites passed 46/46, covering amount authority, signatures/raw HMAC, webhook handling, lifecycle evidence, idempotency, duplicates/refunds/disputes, reconciliation authorization, and malformed routes. No live provider call was made.

# Projects

Broad suite contracts passed for shell, file create/edit/switch/rename/close/delete, nested explorer, Guide/AI state, results/status bar/compiler selector/settings, Premium gating, theme propagation, responsiveness, editor loading, and removal of Reset/Validate actions. Current runtime behavior is entry-file-only; Python imports/multi-file execution were not claimed. Long-session Monaco model profiling was not completed.

**Monaco lifecycle follow-up — 2026-10-01:** The previously open long-session gap is closed for Monaco. A confirmed Project Workspace URI-model retention leak was repaired with explicit open-tab ownership and project-scope cleanup. Real Chromium covered 50 file models, close/rename, 20 project switches, 20 route cycles, 30 language switches, and 50 standalone/compiler edit-reset-unmount cycles; counts returned to zero after final unmount, Worker count remained bounded, and forced-GC heap remained stable. Shared compiler surfaces use the same editor component and dispose their anonymous active model on unmount. Full ownership rules and evidence are in `docs/testing/MONACO_MODEL_LIFECYCLE.md`. Broader WASM-runtime memory and accessibility/device matrices remain outside this closure.

# Memory / Cleanup

Worker cancellation/recovery passed for JS/TS and lifecycle contracts passed in unit suites. No comprehensive retained-worker, Monaco model, timer/listener, observer, or heap profile was available. Browser output/transcript and source/buffered-input resource limits remain known open findings.

# Accessibility

Available semantic contracts passed for auth alerts, dialogs, tabs, buttons, profile navigation, and terminal/log structures. No axe-style suite or assistive-technology matrix was present. Keyboard behavior is covered selectively, not comprehensively.

# Responsive

Structural responsive component tests passed, and JS/TS isolation passed in mobile Chromium. Full mobile/tablet/desktop visual flows for auth, profile menu, project workspace, language picker, input drawer, and terminal were blocked by the authenticated E2E harness or not separately automated.

# Performance

The production build took 3m24s under validation load. Major emitted assets included initial CSS 419.41 kB (64.00 kB gzip), initial JS 994.99 kB (258.64 kB gzip), Monaco 2.86 MB (741.38 kB gzip), Babel 3.03 MB (683.72 kB gzip), TypeScript 3.60 MB (1.03 MB gzip), PHP WASM assets near 19.9 MB each, and ONNX runtime WASM 13.48 MB. No reliable browser performance trace was produced.

# Build

`npm.cmd run build` passed after transforming 2,785 modules. Warnings: PHP-WASM `worker_threads` browser externalization, `eval` in PHP-WASM, static/dynamic import conflicts for Firestore/referral and `UserDataService`, and chunks over 500 kB.

# Bundle Budgets

Failed. Initial CSS exceeded raw and gzip ceilings; `AuthFlow.jsx` and `CourseRoute.jsx` failed dynamic-route-entry requirements. This reproduces AUDIT-005.

# Security Checks

- JS/TS hostile capability matrix: passed.
- Secret hygiene: passed, with no secret values printed.
- Dependency boundary: originally failed on `firebase-admin` (AUDIT-004); remediated 2026-10-01 and now passes across 469 browser modules.
- Package advisory audit: environment-blocked.
- `git diff --check`: reports pre-existing trailing whitespace in dirty `firebase-debug.log` and `src/access/PremiumGate.jsx`; no report-file whitespace errors were introduced.

# Recommended Fix Order

1. Stabilize the authenticated Playwright sign-in helper and Vite-backed runtime acceptance server so release evidence can run.
2. Keep the JS/TS isolation matrix mandatory; do not regress the repaired boundary.
3. Add shared browser compiler source/stdin/output/transcript limits (AUDIT-002/003).
4. Keep the remediated `firebase-admin` browser/server boundary (AUDIT-004) mandatory in CI.

## Firebase Admin boundary closure — 2026-10-01

The original failure was reproduced exactly: the validator categorically rejected `firebase-admin` in root production dependencies. That classification was incompatible with Vercel serverless packaging and the prior compiler-public production incident. The package remains a production dependency; the validator now requires that placement and separately rejects Admin SDK imports in canonical browser source.

Evidence: negative client and positive server fixtures passed; 469 browser modules passed the source boundary; focused compiler routes/services passed 25/25; Share/Feedback emulator acceptance passed 9/9; payment tests passed 28/28; Admin configuration, WIF, sanitized-error, request disposal, and client-secret-boundary tests passed 71/71; production build passed in 1m43s; recursive browser-artifact and worker scan found no Admin SDK or server credential markers.

Residual risk: any future browser entry root outside `src/` must be added to the scan. No Firebase rules, payment behavior, compiler runtime behavior, or credential architecture changed.
5. Repair stale Vercel/AI/Java test harnesses.
6. Restore bundle budgets and route splitting (AUDIT-005).
7. Add deterministic emulator ownership, long-session resource profiling, accessibility, and responsive matrices.

# Commands Run

## Validation infrastructure repair follow-up — 2026-10-01

VALIDATION-001 through VALIDATION-004 and VALIDATION-008 are remediated. Vercel tests use the active configuration API and semantic route selection; AI diagnostics follow the consolidated entrypoint; the landing suite passed 20/20 consecutive runs; Java validation no longer imports the application/Firebase browser graph and passes its full matrix.

VALIDATION-005 and VALIDATION-009 remain partially open. Auth trace evidence identified stale preview reuse as the reason emulator credentials were sent to live Identity Toolkit; reuse is disabled, the helper enters `/login`, and failures are explicit. An interrupted retry still left/encountered port 4173 ownership, preventing the required 10/10 authentication proof. The new browser harness passed 10/10 free-port/readiness/teardown cycles, but the full Assembly command hung after readiness. These are harness lifecycle failures, not demonstrated product failures.

### Final infrastructure closure attempt — 2026-10-01

The fixed `4173` assumption was removed. Playwright now chooses one per-process preview port, exports it to workers and the preview command, waits on `/login`, and invokes Firebase CLI without the `npx.cmd` shell layer. Emulator authentication and protected `/settings` rendering were observed. Normal Windows teardown still left Firebase's Node and Firestore Java descendants alive after a failed test; interrupting the owning Playwright process released them. A global-setup ownership experiment cleaned the tree but introduced a Playwright worker hang and was reverted. VALIDATION-005 therefore remains open and its 10-cycle gate was not claimed.

Assembly diagnostics now report server readiness, page load, worker creation/close, request/page errors, and named execution stages. The worker was waiting on Emscripten WASM/assembler preload dependencies, not a stale selector or missing worker. With a 120-second bounded initialization allowance, two consecutive minimal executions succeeded; each fresh worker required roughly 80–90 seconds in the Vite development harness. The requested 10-cycle and full-suite gates were stopped because this is not acceptable deterministic validation performance. VALIDATION-009 remains open as a harness/environment performance issue. No product runtime change was made.

Focused validation passed 72/72, Java passed, dependency boundaries passed, and production build passed in 56.68s. See `docs/testing/VALIDATION_ENVIRONMENT.md`. Final classification remains pending until authenticated Playwright and a full browser-runtime command repeat cleanly.

Thirty-one validation command invocations were made, including the full Vitest suite; isolated reproductions; compiler-public acceptance; Playwright broad and hostile JS/TS runs; build; dependency, secret, CSS, and bundle validators; payment tests; Firebase/Storage rule scripts; Java/Assembly/native/PHP runtime scripts; npm audit; focused auth/profile tests; status/process inspection; and `git diff --check`.

Primary assertion accounting: 1,271 passed, 12 failed, 2 skipped. Additional successful diagnostic runs contributed 95 passing assertions (some intentionally overlap failed-suite coverage), while isolated stale-test reruns added 2 repeated failures. Command-level failures/blockers are reported separately and must not be interpreted as product assertions.

# Files / Areas Not Fully Tested

- Complete real-Chromium stdin matrix for Python, C/C++, PHP, R, C#, and VB.
- Java buffered-mode acceptance after the script's import failure.
- Live auth providers, password reset delivery, token revocation timing, and stale claims.
- Live Go/Rust runner, MySQL infrastructure, payment provider, AI provider, or production Firebase.
- Every API-route method/auth/oversize permutation independently.
- Multi-file runtime execution (not currently claimed), long-session Monaco/WASM memory, worker/timer/listener leaks.
- Full accessibility tooling and mobile/tablet/desktop visual regression.
- Package advisories due network restrictions.
## Compiler resource hardening follow-up — 2026-10-01

The resource findings have been implemented through one shared browser policy. Limits: 512 KiB source; 256 KiB buffered stdin; 32 KiB per interactive submission; 512 KiB cumulative interactive stdin; 2 MiB stdout; 1 MiB stderr; 4 MiB terminal transcript; and 1,000 SQLite result rows. Source and buffered input are rejected before runtime initialization. Output breaches abort the active runtime with structured errors, while transcript truncation is presentation-only and keeps canonical output separate.

Focused results: resource-policy/isolation/stdin tests 17/17; runtime-family contracts 85/85; final focused compiler/embedded regression set 111/111; SQLite 10/10; production builds passed in 1m14s and 56.95s. Real Chromium passed the JS isolation/output matrix on desktop/mobile and the required hostile-output termination/recovery matrix 5/5 for Python, C, PHP, R, and C#. The Python test used approved access to the pinned Pyodide CDN. The requested representative Chromium closure gate passed.

## Bundle/performance remediation closure — 2026-10-01

AUDIT-005 / VALIDATION-007 are closed. The unchanged bundle validator passes with initial JavaScript at 973,487 bytes raw / 254,039 gzip (1,000,000 / 260,000 limits), initial CSS at 30,293 bytes raw / 6,643 gzip (250,000 / 40,000 limits), 12 lazy route entries, and Monaco, MediaPipe vision, and Silero excluded from the initial static graph. The remediation baseline was 999,409 / 260,092 gzip JavaScript and 419,413 / 64,004 gzip CSS.

The change moved product CSS from the eager foundation index to route owners, made public Auth/Library/Practice/Projects/Course rendering explicitly lazy, and deferred referral attribution until a referral-bearing signup. Production build, focused route/component and representative compiler regressions, CSS architecture, and dependency-boundary validation passed. The only build warnings are expected lazy PHP-WASM worker/eval notices and Rollup's generic large-lazy-chunk advisory; the former mixed static/dynamic import warnings are absent.

No dependency, Vite budget, source-map policy, compiler runtime implementation, security boundary, or resource limit changed. The remaining performance risk is limited gzip headroom and large on-demand editor/runtime cold starts. Automated mobile/theme screenshots were not claimed because the validation report's existing Playwright lifecycle limitation remains open; responsive/component contracts passed where covered.

## Stale coin-test closure — 2026-10-01

AUDIT-006 is closed. The exact collection failure was reproduced before editing: `redeem-development-ui.test.js` attempted to read the intentionally removed `src/styles.css`. The repaired test validates current semantic CSS owners and the light/dark coin-token contract. The Redeem route now explicitly imports its existing rules after tracing exposed a missing route stylesheet introduced by CSS splitting.

Validation passed: focused repair 4/4, complete coin suite 337/337 across 35 files, related theme/brand/AppShell coverage 18/18, CSS architecture validation, and the 39.44-second production build. No financial, wallet, redemption, pricing, or brand-theme behavior changed.

## Security-header policy closure — 2026-10-01

AUDIT-008 is closed at repository/configuration scope. Vercel and Vite now consume one policy module for document, API, compiler-isolation, and local headers. Main hosts avoid compiler-only COOP/COEP; compiler custom/stable/preview aliases retain those headers and add CORP. CSP enforces the safe base/object/frame/form subset while leaving runtime/auth source directives unrestricted until telemetry supports tightening. The API subset excludes document CSP.

Validation passed: 37 focused routing/header/Worker assertions; 115 representative auth/runtime assertions with one stale route-array expectation repaired and rerun; real Chromium `crossOriginIsolated === true` with `SharedArrayBuffer` available; hostile JS/TS browser boundary 7/7; dependency boundaries across 469 browser modules; production build in 43.45 seconds. The established Windows Playwright teardown issue recurred after the 7 browser assertions completed, so the owned wrapper was interrupted. Production response inspection and live Google/Firebase popup verification remain deployment smoke requirements.
## Firebase emulator determinism follow-up — 2026-10-01

Rules wrappers now pin suite-specific demo projects, own startup through `emulators:exec`, isolate Firebase CLI state, reject occupied fixed ports, and receive fresh emulator data. Content, certification, and Storage rules passed; coin rules passed 5/5 invocations. Compiler public acceptance passed 5/5 fresh invocations (9/9 assertions each), including fresh Auth tokens and Share/Feedback persistence. Authenticated browser sign-in/protected-route assertions passed 5/5 and owned Firebase ports were released.

Closure remains partial: on Windows the outer Playwright PowerShell/PTY remained open after its web servers and emulator ports were gone, and coin-ledger Vitest retained an open handle. No production Firebase behavior or security rules changed.

## Accessibility coverage/remediation follow-up — 2026-10-01

Real Chromium axe coverage was added for seven public/auth/compiler routes and eleven authenticated AppShell routes. Initial failures identified contrast defects on landing mentor steps, active navigation, Library metadata, Practice badges/statistics, Bookmarks filters, and Settings navigation; the remediated matrix passed with zero critical/serious findings. Focused component coverage passed 23/23 and verifies the AppShell skip target plus keyboard/value semantics for Project Workspace splitters and file tabs. The keyboard browser smoke passed auth reachability, standalone dialog open/Escape/focus return, and skip-link focus transfer.

This is `ACCESSIBILITY_PARTIAL`, not complete coverage: Course Overview/Learning Engine, opened project details, exam/setup, mobile/200% zoom, and a screen-reader pass remain outstanding. The known Windows Playwright outer-process teardown handle recurred after successful assertions and required interruption after browser/server cleanup.

### Accessibility final coverage closure — 2026-10-01

The previously missing real surfaces were exercised in Chromium. A real Learning Engine lesson, opened Project Workspace, nine-route dark matrix, representative mobile routes, tablet Learning/Project layouts, 200%-reflow routes, and a WCAG text-spacing probe passed their critical/serious axe gates after focused remediation. Learning compiler and standalone result tablists now contain only valid tab children; inactive tabs no longer reference absent panels; scrollable lesson content is keyboard focusable; Project Guide/AI and Results tabs support arrow navigation; static/multi-action file controls use truthful semantics; and confirmed contrast failures were repaired.

Focused Project/AppShell/Learning/Certification component coverage passed 42/42. NVDA was not installed in the execution environment. A live eligible exam could not be reached with the deterministic free emulator identity without creating unauthorized product data or bypassing Premium/canonical eligibility. The current classification is therefore `ACCESSIBILITY_COVERAGE_PARTIALLY_VALIDATED`, with zero known critical/serious findings on scanned surfaces and explicit remaining coverage debt for live exam/setup, quiz/exercise variants, destructive Project file-operation focus restoration, and actual assistive-technology use.

## Stale validation-script closure — 2026-10-01

The Learning layout, Learning compiler, and AI Tutor smoke validators no longer read or import the removed `src/styles.css`. Static validators now assert route ownership plus semantic contracts across `learning-engine.css`, `dashboard.css`, and `editor-themes.css`. The AI smoke uses a dedicated fixture with the current stylesheet graph and explicit local auth, Premium, rollout, and quota test boundaries while retaining a real configured-provider request. Historical audit evidence and the CSS-architecture removal guard remain intentionally unchanged.

## Final release-candidate validation — 2026-10-01

Validated branch `main` at HEAD `7495fb734513f5a2459350301ccdd37d211a9530` with the authorized October remediation work still uncommitted. The broad Vitest run passed 94 files and 1,327 assertions with 11 skipped; its only failed suite was the compiler-public acceptance file intentionally rejecting generic invocation. The required emulator wrapper subsequently passed that suite 9/9. Focused compiler/runtime (239 assertions), Projects/Learning (51), payments (44), AI Tutor (589), routing/Vercel (40), coin-ledger emulator (56), Storage (3), and content/certification/coin rules validations passed; focused counts overlap the broad suite and are not summed as unique coverage.

Static syntax, dependency boundary (469 browser modules), CSS ownership, secret hygiene (1,940 tracked files), script conventions, Vercel routing/cron/function-count, and bundle budgets passed. Documentation-link validation remains red only because it treats historical `docs/old_chat.md` links as current documentation. The production build passed in 65.54 seconds. Initial payload is 973,788 bytes JavaScript raw / 254,112 gzip and 30,293 bytes CSS raw / 6,640 gzip, with 12 lazy route entries. Known warnings remain `worker_threads` browser externalization, PHP-WASM `eval`, and large lazy chunks.

Real Chromium passed all seven JS/TS hostile-capability cases plus C, PHP, R, and C# output-limit recovery. Python browser cases could not fetch pinned Pyodide from jsDelivr in the restricted browser environment; deterministic Python policy/resource tests passed. Accessibility passed all eight logical closure/matrix tests with one authenticated-route retry, then reproduced VALIDATION-005's Windows outer-process handle. Monaco lifecycle returned from 50 models to zero, with bounded Workers and stable forced-GC heap. Content, certification, Storage, coin rules, coin ledger, and compiler Share/Feedback acceptance all used pinned demo projects and shut their emulators down.

Finding status remains evidence-based: AUDIT-001 through AUDIT-010 are fixed or validated at their documented scope; VALIDATION-001–004, 006–008, 010–012, and the Monaco portion of VALIDATION-013 are fixed/validated. VALIDATION-005 remains partially validated because of Windows wrapper teardown. VALIDATION-009 remains an Assembly cold-start/harness limitation. Accessibility remains partially validated because NVDA/Narrator and an eligible Premium exam/setup journey were unavailable.

The registry advisory check is now reachable and reports 14 dependency advisories (1 low, 7 moderate, 6 high), principally transitive `@grpc/grpc-js`, `brace-expansion`, `dompurify` through Monaco, `nanoid`, and `uuid`; remediation was intentionally not attempted in this validate-only phase. No exploit was demonstrated, but these advisories require dependency-owner triage before an unqualified release claim.

The current whole worktree is `NOT_READY_TO_COMMIT`: it contains pre-existing unrelated changes (`firebase-debug.log`, `src/access/PremiumGate.jsx`) and generated/untracked logs, screenshots, emulator state, test results, temporary build/runtime directories, and tool build output that require curated staging or cleanup. Remediation-owned files pass scoped `git diff --check`; global checking fails only on the known log and `PremiumGate.jsx` trailing whitespace. After a curated commit excludes generated/unrelated files, the product evidence supports `READY_TO_DEPLOY_WITH_POST_DEPLOY_SMOKE`.

Required post-deployment checks: load Home/auth/routes/CSS/profile navigation on `ycoders.com`; verify compiler production headers, `crossOriginIsolated`, `SharedArrayBuffer`, Python interactive input, JS/TS, and one native runtime on `compiler.ycoders.com`; create/retrieve a Share and submit Feedback; authenticate a protected Firebase route; exercise the live Google popup; inspect real CSP/COOP/COEP/CORP/HSTS responses; and confirm Pyodide plus other external runtime/CDN assets work under production COEP.

Final classification: `RELEASE_CANDIDATE_READY_WITH_KNOWN_LIMITATIONS`.

## Production Share API blocker hotfix — 2026-10-02

Production release `43c082cf8ac620e63bb71bb66592d1b210ceb47b` exposed a server-runtime compatibility issue on `POST /api/compiler/share`. The request failed while loading the function, before Share business logic ran: `firebase-admin@14.2.0` loads CommonJS `jwks-rsa@4.1.0`, whose `src/utils.js` calls `require('jose')`, while its `jose@6.2.7` dependency is ESM-only. Vercel disables Node's native `require(ESM)` bridge by default, producing `ERR_REQUIRE_ESM`; the same chain succeeds when `--experimental-require-module` is enabled. This dependency state predates the release and is not caused by the Share payload, Firestore, authentication, or the October remediation commit.

The minimal repair adds Vercel's documented `NODE_OPTIONS=--experimental-require-module` runtime configuration to both deployment targets. No Share, Feedback, authentication, payment, AI, Firebase Admin, compiler-runtime, dependency-version, or browser code changed. A focused Vercel regression test locks the option for both `main` and `compiler` configurations.

Validation passed for direct compiler-function module loading under the configured option; compiler routing; Share/Feedback service contracts; stdin preservation; dependency boundaries; and the Firebase Auth/Firestore Share/Feedback acceptance harness (9/9). The production build passed with only the established `worker_threads` externalization, PHP-WASM `eval`, and large lazy-chunk warnings. A redeployment of both affected Vercel projects is required before production HTTP retesting can prove the live fix; this hotfix phase did not deploy.

### Share dependency-compatibility repair — 2026-10-02

Hotfix `cfc42dd1fb7984d6dbf74c67cbd5bdfa23343b63` deployed the `NODE_OPTIONS=--experimental-require-module` workaround to both Vercel projects, but production Share and Feedback requests still failed during function initialization with the same `jwks-rsa` `require('jose')` `ERR_REQUIRE_ESM`. The Vercel runtime did not operationally apply that bridge to the failing function loader, so the global runtime option has been removed.

The dependency repair now scopes `jose@5.10.0` only to the `jwks-rsa` dependency edge. `jwks-rsa@4.1.0` uses `importJWK` and `exportSPKI`; a real RSA signing-key conversion probe confirms those APIs and semantics under v5. The Firebase CLI's MCP dependency retains its separate `jose@6.2.7` copy. With `NODE_OPTIONS` absent and Node's experimental bridge explicitly disabled, the CommonJS probe, Firebase Admin Auth graph, and exact compiler API entrypoint load successfully. The Auth/Firestore Share and Feedback emulator acceptance suite passes 9/9, including Share creation/retrieval, stdin opt-in, authenticated use, and sanitized invalid-token rejection.

This override is temporary compatibility debt. Remove it after Firebase Admin no longer selects the affected `jwks-rsa` release, or after `jwks-rsa` stops synchronously requiring an incompatible ESM-only `jose` build. The focused lockfile/CommonJS regression must remain until that upstream replacement is proven under the Vercel function runtime.

### Share downstream failure diagnosis — 2026-10-02

Production SHA `2b0ded691d03d3811747a353f470e8b4e3003d08` and compiler deployment `dpl_CN2sFaizk9yo2wTzPHqouegMxiby` prove that the `jwks-rsa`/`jose` loader failure is repaired: the compiler function initializes and `POST /api/compiler/share` reaches the Share handler. A harmless anonymous JavaScript request (`application/json`, 14 source bytes, no stdin) still returns the sanitized `500 compiler-public/server-error`; the prior `ERR_REQUIRE_ESM` is absent.

The downstream root cause is deterministic in the production configuration and was reproduced locally without accessing Production data. `createShareHandler()` validates the request envelope and then calls `createCompilerPublicDependencies()`. That function calls the singleton `getServerFirebaseApp(process.env)`. Any Vercel Production environment resolves to the managed production tutor profile, so `requiresFederatedTutorCredentials()` returns true. `getServerFirebaseApp()` explicitly rejects that state with `AIServiceError` code `ai/server-unavailable` before resolving Firebase Admin configuration, acquiring Auth or Firestore, entering the rate limiter, validating the Share payload, or writing a document. The router catches this non-`CompilerPublicError`, and `sendCompilerPublicError()` discards its name/code/stack and returns the generic sanitized 500. No server-side diagnostic currently logs the original exception.

The compiler Vercel project has Production entries for `FIREBASE_PROJECT_ID` and `FIREBASE_SERVICE_ACCOUNT_JSON`; the main `ycoders` project has `FIREBASE_PROJECT_ID` plus the AI Tutor WIF identity configuration. Values were not inspected or recorded. Their presence cannot repair this path: Share neither creates a request-scoped WIF credential nor calls the Vercel OIDC/Google STS adapter, and the singleton initializer rejects managed Production mode before selecting service-account JSON or ADC. Consequently the failing request makes no WIF exchange and no Firestore RPC. Share otherwise targets the default Firestore database, with a transactional rate-limit document under `compilerPublicRateLimits/share_<hashed-client-key>_<window-start>` before creating `compilerShares/<22-character-base64url-id>`. A working credential would require Firestore entity read/create/update permissions for those operations (normally an appropriately scoped Datastore/Firestore user role), but IAM is not reached in this failure.

The emulator acceptance path differs materially: it passes emulator-backed Auth and Firestore dependencies directly to `createShare()` and does not call the Production singleton initializer. Existing Firebase Admin tests intentionally assert that `getServerFirebaseApp()` fails closed in a managed production environment, confirming that the Share wiring—not Firestore data, collection geometry, payload content, or IAM—is the incompatibility. No functional repair, diagnostic logging, dependency change, environment mutation, commit, or deployment was made in this diagnosis phase. The next repair should give compiler-public handlers a request-scoped Firebase Admin app backed by the approved Production credential mechanism, with lifecycle cleanup, while preserving the sanitized client error contract.

### Compiler-public request-scoped credential repair — 2026-10-02

The compiler-public dependency factory now reuses the approved Production credential architecture instead of the rejected process singleton. For every Share POST, Share GET, Feedback POST, and authorized Share janitor request, it creates one `createVercelGoogleCredentialContext`, preflights its short-lived credential, injects that credential into a collision-safe `createRequestFirebaseApp`, and obtains both Auth and default-database Firestore from the same Admin app. The router owns the resulting session and closes it in `finally` after success, invalid Auth, payload validation, rate-limit rejection, Firestore failure, or unexpected failure. Local and emulator service-level dependency injection remains unchanged. Managed Production still rejects `FIREBASE_SERVICE_ACCOUNT_JSON`; no long-lived-key fallback was introduced.

Deterministic Production-equivalent tests now reach the transactional rate limiter and Share persistence through the WIF dependency path, while missing WIF configuration retains the sanitized `500 compiler-public/server-error` response. Concurrent requests receive independent app sessions, and dependency materialization failures close partially created sessions. The request-scoped app uses the established `mitutora-request-<UUID>` naming strategy. Share schemas, IDs, expiry, stdin handling, collections, rate limits, Auth semantics, and the `(default)` database are unchanged.

The compiler deployment is not yet runnable because cloud identity authorization is project-specific. Read-only inspection found the existing `vercel-production` provider condition pinned to Vercel project `ycoders` (`prj_mTxdxkbRFgjrrIwvMV37QqPXncRL`) and exact subject `owner:avinashabbigeris-projects:project:ycoders:environment:production`. The `ai-tutor-runtime` service account's `roles/iam.workloadIdentityUser` binding contains only that same subject. The compiler project is `ycoders-compiler` (`prj_AEw1e2AzOwENQVgeAkG0GrUtSntN`) and presents the distinct Production subject `owner:avinashabbigeris-projects:project:ycoders-compiler:environment:production`; its token is therefore rejected by both the provider condition and service-account binding. The runtime identity already has `datastore.entities.get`, `datastore.entities.create`, and `datastore.entities.update` on the default database through its existing conditionally scoped role, which covers the Share rate-limit transaction and document creation after impersonation succeeds. No IAM mutation was made.

Before deployment, the compiler Vercel project must remove `FIREBASE_SERVICE_ACCOUNT_JSON`, retain `FIREBASE_PROJECT_ID`, and add the non-secret `GOOGLE_WIF_AUDIENCE` and `GOOGLE_WIF_SERVICE_ACCOUNT_EMAIL` values pinned by the production runtime profile. `AI_TUTOR_RUNTIME_BOUNDARY` is not required for a Vercel Production deployment because `VERCEL_ENV=production` selects the production boundary automatically; the AI-specific name remains architectural debt rather than being spread into compiler configuration. Separately authorized Google IAM work must explicitly authorize the exact compiler project ID, environment, and subject at both the provider condition and service-account impersonation binding. The compiler must not be deployed until that exact-subject authorization is complete and verified.

### Compiler-public WIF runtime acquisition diagnostic — 2026-10-02

Local source and installed-package tracing did not identify the exact Production stopping point. The compiler route is the consolidated `api/compiler.js` Vercel Node.js serverless function (Node 24 configuration). It reaches `createCompilerPublicDependencies()`, `createVercelGoogleCredentialContext()`, the `@vercel/oidc@3.8.5` `getVercelOidcToken()` helper, `google-auth-library`'s `IdentityPoolClient`, request-scoped Firebase Admin initialization, and then the default Firestore database. The official helper reads the Vercel request-context `x-vercel-oidc-token` value and falls back to `VERCEL_OIDC_TOKEN`; the current no-argument invocation is correct. A custom-audience helper call would invoke Vercel's token exchange and is not appropriate here: the provider accepts Vercel's issuer audience, while the Google external-account `audience` independently identifies the Workload Identity provider.

The external-account configuration remains structurally correct: provider resource project `196429461457`, pool `ai-tutor-vercel`, provider `vercel-production`; JWT subject token type; Google STS `v1/token`; IAM Credentials impersonation of `ai-tutor-runtime@mi-tutora-pro.iam.gserviceaccount.com`; and the `cloud-platform` scope used by Firebase Admin Auth and Firestore. Expected compiler claims are issuer `oidc.vercel.com/avinashabbigeris-projects`, Vercel team audience, exact compiler Production subject, matching owner/project identifiers, and `environment=production`.

Prepared request-scoped diagnostics now emit a correlation ID and safe stages for environment/profile selection, OIDC acquisition, STS, impersonation, Firebase initialization, and the first Share/Feedback Firestore operations. Token diagnostics are limited to presence, byte length, issuer hostname, hashed audience, bounded deployment identity claims, and issue/expiry times. Failures retain only bounded name/code/status/reason metadata; raw JWTs, signatures, Google access tokens, Firebase ID tokens, private keys, learner content, and raw exception messages are excluded. `google-auth-library` performs STS and impersonation within a single `getAccessToken()` call, so the failing endpoint hostname is used to distinguish STS from IAM Credentials rejection.

The project IAM policy has no explicit `auditConfigs` section. STS and IAM Credentials Data Access visibility is therefore not sufficient to treat missing audit entries as proof that no exchange was attempted. The focused WIF/router/service matrix passed 62 assertions, the Auth/Firestore compiler-public acceptance harness passed 9/9, the payment regression passed 27/27, and dependency-boundary and secret-hygiene validations passed. A small Production diagnostic deployment is still required to identify whether the live flow stops at OIDC acquisition, STS, impersonation, Firebase initialization, or Firestore. No functional fix, IAM/provider mutation, commit, or deployment is part of this diagnostic preparation.

Production diagnostic commit `abedae09e7f514f557a412a9f8e0e5a146501021` was deployed to both Vercel Production projects. The single compiler Share request at 2026-10-02 18:26:34 IST returned the unchanged sanitized `500 compiler-public/server-error` response and correlation ID `44bbd08f-d71f-4410-9ae9-4449961c9636`. Its ordered stages prove successful environment/profile selection, external-account construction, Vercel OIDC acquisition, Google STS exchange, service-account impersonation, and Firebase app creation. The exact compiler Production subject, owner, project, environment, issuer hostname, and hashed audience matched expectations; no credential material was logged.

The first failure followed `wif.firebase.success` while materializing Firestore and had code `firestore/invalid-credential`; neither the Share rate-limit transaction nor Share persistence began. Source inspection confirms the exact incompatibility: Firebase Admin accepts the request credential's `getAccessToken()` interface when constructing the app, but its Firestore adapter only accepts its internal certificate credential or application-default credential classes and rejects the otherwise valid custom WIF credential object. A read-only audit query found a successful `GenerateAccessToken` IAM Credentials Data Access event for the target runtime service account at the request time, corroborating impersonation success; no STS record was returned by that query. The recommended functional repair is to retain the request-scoped WIF-backed Firebase Admin app for Auth while constructing default-database Firestore through `@google-cloud/firestore` with the same `IdentityPoolClient`, mirroring the already established named-database WIF pattern. No fix or second deployment was applied.

### Compiler-public direct Firestore WIF adapter repair — 2026-10-02

The compiler-public dependency session now keeps Firebase Admin and the request-scoped app exclusively for Auth while constructing `(default)` database access directly with the existing `@google-cloud/firestore@8.7.0` dependency. The same request's `google-auth-library` `IdentityPoolClient` is injected through the supported `authClient` constructor option; Production fails closed if that client is missing, with no certificate, service-account JSON, key file, or ADC fallback. Request cleanup terminates the Firestore client and deletes the Firebase Admin app. Direct-package `Timestamp` values preserve the stored schema and the existing transaction, Share, Feedback, rate-limit, read, and janitor operations remain unchanged.

Diagnostics now distinguish Firebase Auth materialization, Firestore client construction, and individual Firestore RPC start/success/failure stages. Focused adapter/WIF/router/service tests passed 67 assertions, compiler-public contract tests passed 50 assertions, the Auth/Firestore emulator acceptance matrix passed 9/9, AI Tutor passed 592 assertions, payment regression passed 27 assertions, and dependency-boundary plus secret-hygiene validation passed. The compiler entrypoint loads, the production build succeeds, browser output contains no server Firestore/WIF identifiers, and bundle budgets remain at 973,788 bytes initial JavaScript raw / 254,112 gzip and 30,293 bytes initial CSS raw / 6,640 gzip with 12 lazy route entries. This repair remains uncommitted and undeployed pending explicit authorization.

## FINAL RELEASE CLOSURE — 2026-10-02

Production SHA `debc1968c91c6b753997362da90e4d01e4420cf4` is deployed and READY in both the main deployment (`dpl_4u1yjpeNqBUWDFKMivoSaEsEZCiK`) and compiler deployment (`dpl_Cn4wLGKFvaQo6zF7XrjXikZKm4mN`). The direct Firestore WIF adapter repair is therefore no longer pending: a valid anonymous Production Share returned `201`, its corresponding GET returned `200` with exact source and metadata restoration, a second Share preserved multiline stdin exactly, invalid Auth returned a sanitized `401`, and Feedback persistence returned `201`. Correlated diagnostics prove Vercel OIDC, Google STS, service-account impersonation, Firebase Admin Auth, direct Firestore client construction, transactional rate-limit RPC, Share persistence RPC, Share read RPC, and Feedback RPC success with `credentialMode: wif`. No service-account JSON fallback was restored.

The broader release smoke also passed at the available scope. The main AI endpoint completed its Production WIF preflight before returning the expected unauthenticated `401`; the payment entrypoint returned its safe method-contract `405` without creating a payment. Live standalone JavaScript and Python each produced exactly `release-ok` with no browser console errors. Compiler documents return COOP `same-origin`, COEP `require-corp`, and CORP `same-origin`; real Chromium reports `crossOriginIsolated === true` and `SharedArrayBuffer` available. The main site does not inherit those compiler-only isolation headers.

### Original audit reconciliation

| ID | Original severity and title | Final status | Closure evidence and residual limitation |
| --- | --- | --- | --- |
| AUDIT-001 | HIGH — JavaScript/TypeScript learner code retained same-origin Worker capabilities | CLOSED | Fail-closed capability denial, pre-evaluation remote-import rejection, Worker CSP, and hostile real-Chromium coverage passed. A browser Worker remains a capability-controlled boundary rather than an OS sandbox. |
| AUDIT-002 | MEDIUM — Browser output and terminal transcript were unbounded | CLOSED | Shared stdout (2 MiB), stderr (1 MiB), and transcript (4 MiB) limits terminate disposable runtimes truthfully; real-browser termination and recovery passed across representative runtimes. |
| AUDIT-003 | MEDIUM — Browser source and buffered stdin lacked shared limits | CLOSED | UTF-8 limits now cover source (512 KiB), buffered stdin (256 KiB), interactive submissions (32 KiB each/512 KiB cumulative), rapid-run replacement, and pre-worker rejection. |
| AUDIT-004 | MEDIUM — Firebase Admin dependency boundary failed | CLOSED | The server dependency placement is intentional; browser-source scanning, negative fixtures, built-output inspection, and the 469-module boundary validator pass. |
| AUDIT-005 | MEDIUM — Initial CSS/JavaScript exceeded budgets | CLOSED | Final budgets pass with 973,788 bytes JS raw/254,112 gzip, 30,293 bytes CSS raw/6,640 gzip, and 12 lazy routes. JS gzip headroom remains narrow and should be monitored. |
| AUDIT-006 | LOW — Coin suite referenced a removed stylesheet | CLOSED | The test follows current semantic CSS owners, Redeem loads its owned rules, the full coin suite and CSS architecture validation pass. Redeem rules remain co-located with Home styles. |
| AUDIT-007 | LOW — Isolation tests omitted Worker capability coverage | CLOSED | The adversarial browser matrix now covers network, nested workers, storage/filesystem entrypoints, messaging, constructor/global probes, and remote dynamic imports. |
| AUDIT-008 | INFO — Security headers lacked a consolidated policy | CLOSED | Central host-aware policy is validated locally and in Production; compiler isolation headers and main-host separation are confirmed live. Broader CSP source directives remain intentionally deferred pending telemetry. |
| AUDIT-009 | INFO — Compiler acceptance was unreliable through generic Vitest | CLOSED | The explicit pinned-project emulator wrapper passed five fresh 9/9 runs; the final acceptance rerun passed 9/9. The separate Windows outer-process handle is tracked as VALIDATION-005. |
| AUDIT-010 | INFO — Pyodide auto-loaded packages and retained warm VM state | CLOSED | Automatic import loading is removed, learner-visible network/storage bridges are denied, and every run receives a disposable Worker/VM with reset stdin/output state. Browser Workers still have no strict per-worker memory quota and cold initialization is expected. |

All 10 original AUDIT findings are closed or validated at their intended scope. None is partially validated and none remains release-blocking.

### Validation-finding reconciliation

| ID | Description | Final status | Evidence or remaining scope |
| --- | --- | --- | --- |
| VALIDATION-001 | Legacy routing test required removed `vercel.json` | CLOSED | Tests use the active Vercel configuration API. |
| VALIDATION-002 | Cron test assumed a stale route index | CLOSED | Cron selection is semantic and retains Hobby/project-isolation constraints. |
| VALIDATION-003 | AI diagnostics referenced removed API files | CLOSED | Diagnostics target the consolidated AI entrypoint and retained authorization modules. |
| VALIDATION-004 | Landing test timed out under suite load | CLOSED | Twenty isolated runs passed without weakening the timeout. |
| VALIDATION-005 | Authenticated Playwright helper and Windows lifecycle | ACCEPTED_LIMITATION | Auth/protected-route assertions passed repeatedly and owned ports are released, but the outer PowerShell/PTY or descendant process can retain a handle after assertions. Product behavior is unaffected; authenticated Production journeys remain untested without an authorized session. |
| VALIDATION-006 | Firebase Admin dependency boundary | CLOSED | The corrected source/import boundary and built-artifact scan pass. |
| VALIDATION-007 | Bundle and route-splitting budgets | CLOSED | Current raw/gzip thresholds and all 12 lazy-route assertions pass. |
| VALIDATION-008 | Java validation imported the application/Firebase graph | CLOSED | The dedicated minimal Java harness passes. Java remains intentionally buffered-only. |
| VALIDATION-009 | Browser runtime Vite lifecycle and Assembly cold start | ACCEPTED_LIMITATION | Harness ownership/readiness cycles pass. Fresh Assembly initialization in the Vite development harness takes about 80–90 seconds; prior Production execution passed around seven seconds. This is a development-harness performance limitation, not a demonstrated Production runtime defect. |
| VALIDATION-010 | npm advisory lookup was unavailable | CLOSED | Registry access was restored and produced a real report: 14 advisories (1 low, 7 moderate, 6 high). Remediation remains separate non-blocking dependency-owner triage. |
| VALIDATION-011 | Compiler resource limits were incomplete | CLOSED | Shared source, stdin, stdout, stderr, transcript, SQLite row, abort, cleanup, and rapid-run cancellation contracts pass, including representative real-browser recovery. |
| VALIDATION-012 | Firebase rule suites lacked deterministic emulator ownership | CLOSED | Content, certification, Storage, coin, and compiler-public suites use isolated pinned projects and owned emulator wrappers; Share/Feedback and Auth-token acceptance pass. |
| VALIDATION-013 | Long-session lifecycle, accessibility, and responsive coverage gaps | PARTIALLY_VALIDATED | Monaco lifecycle is closed; automated axe, keyboard, contrast, responsive, reflow, and text-spacing coverage pass on the reached surfaces. Manual NVDA/Narrator, eligible Premium exam/setup, every quiz/exercise variant, and destructive Project focus restoration remain untested. |

There are 13 documented VALIDATION findings: 10 closed, 3 partial/accepted limitations, and 0 open blockers.

### Lifecycle, accessibility, and emulator closure

Monaco lifecycle validation is closed. URI-backed models are explicitly owned and disposed for close, delete, rename, project switch, route switch, and unmount. Language/theme providers register once per Monaco instance; editor disposables, pointer listeners, and pending animation work are cleaned up. Real Chromium covered 50 file models, 20 project switches, 20 route cycles, 30 language switches, and 50 standalone/compiler edit-reset-unmount cycles. The final model count returned to zero, Workers stayed bounded, forced-GC heap remained stable, listeners fell from 271 to 160, and retained documents fell from five to two.

Accessibility remains partially validated but non-blocking: real axe scans cover public/auth/compiler and authenticated application routes, including Learning Engine and an opened Project Workspace. Keyboard navigation, focusability, tab semantics, skip navigation, splitter semantics, contrast, dark mode, mobile/tablet layouts, 200% reflow, and text spacing have passing evidence with no known critical/serious issue on scanned surfaces. Manual assistive-technology testing and Premium-only/fixture-limited journeys remain explicit gaps.

Firebase emulator product correctness is validated separately from Windows process cleanup. Share/Feedback acceptance, rule suites, deterministic Auth-token issuance, quota behavior, and authenticated browser checks passed through pinned projects and owned emulator instances. Ports and owned emulator services are released; only the outer Windows Playwright/PowerShell or retained test-process handle remains as non-product infrastructure debt.

### Security, runtime, and dependency status

The compiler resource policy now enforces source, buffered and interactive stdin, stdout, stderr, transcript, and SQLite-row ceilings; output-limit termination aborts the disposable runtime and rapid repeated Run requests cancel the superseded execution. JavaScript/TypeScript additionally deny learner access to network transports, nested workers/imports, IndexedDB, Cache Storage, filesystem entrypoints, and cross-context messaging, with remote dynamic imports rejected before execution and Worker CSP as defense in depth.

Pyodide uses a fresh Worker/VM per run. Automatic `loadPackagesFromImports` behavior is removed, browser networking/JS bridge imports are denied, optional third-party packages are not implicitly installed, and stdin/output/runtime state is reset with worker disposal after every terminal outcome.

The documented compiler-language result remains unchanged: browser, preview, database, and emulator runtimes retain their validated contract status; Java is intentionally buffered-only. Public Go, Rust, and MySQL execution remains correctly unavailable/Coming Soon where previously classified, while their retained gated implementations are not reclassified as bugs.

The Production WIF/Firestore incident chain is CLOSED: (A) `ERR_REQUIRE_ESM`; (B) ineffective `NODE_OPTIONS` workaround; (C) scoped `jwks-rsa` to `jose@5.10.0` compatibility repair; (D) Production singleton Firebase initializer failure; (E) compiler provider/IAM authorization repair; (F) Firebase Admin Firestore custom-credential incompatibility; (G) direct `@google-cloud/firestore` WIF adapter; and (H) real Production rate-limit, Share, read, and Feedback RPC success.

The dependency state remains `firebase-admin@14.2.0`, `jwks-rsa@4.1.0`, with a scoped `jwks-rsa` override to `jose@5.10.0`. This is temporary dependency compatibility debt, not an active blocker. Remove the override only when an upstream Firebase Admin/`jwks-rsa` combination no longer synchronously requires an incompatible ESM-only `jose` build and the Vercel loader regression remains green.

The Node `url.parse()` deprecation warning remains non-blocking. No application-source `url.parse()` call exists in the repository scan; the warning is emitted from the deployed server dependency graph, but the exact transitive package has not yet been isolated.

### Remaining non-blocking limitations

- **Validation gaps:** no authorized Production session was available for Google login, Settings/profile, Projects Workspace, or Learning Engine; manual NVDA/Narrator and eligible Premium exam/setup flows remain outstanding.
- **Operational validation:** the Production janitor mutation was intentionally skipped because no safe synthetic expired record existed; its code and emulator paths are validated.
- **Tooling/test infrastructure:** Windows outer Playwright/PowerShell teardown can retain a handle; Assembly Vite-development cold initialization is about 80–90 seconds.
- **Dependency debt:** 14 npm advisories require separate owner triage; the scoped `jwks-rsa`/`jose` compatibility override remains temporary; the `url.parse()` dependency warning remains.
- **Observability/cleanup:** Firestore `terminate()` and Firebase Admin app deletion are deterministic and locally validated, but Production does not emit an explicit cleanup telemetry event.
- **Performance monitoring:** current budgets pass, with limited initial-JavaScript gzip headroom and intentionally large lazy editor/runtime assets.

### Release decision

**OPEN RELEASE BLOCKERS: NONE.**

Original AUDIT counts: 10 total, 10 closed, 0 partial, 0 open blocking. Documented VALIDATION counts: 13 total, 10 closed, 3 partial/accepted, 0 open blocking. The Production Share/Firestore blocker is cleared, the validated release may remain live, and the evidence does not support a stronger unqualified classification because the explicitly listed validation and dependency limitations remain.

Final classification: `PRODUCTION_DEPLOYMENT_VALIDATED_WITH_LIMITATIONS`.

Release may remain live: **YES**.

## DEPENDENCY ADVISORY TRIAGE — 2026-10-02

### Audit inventory and count reconciliation

Live registry-backed npm audit evidence was collected without changing `package.json`, `package-lock.json`, or `node_modules`. `npm audit --omit=dev --json` reports **14 production package entries**: 1 low, 7 moderate, 6 high, and 0 critical. The unrestricted `npm audit --json` reports **35 full-tree entries**: 1 low, 18 moderate, 16 high, and 0 critical. The earlier validation report's 14-advisory statement therefore described the production-only tree; the additional 21 entries are development, test, emulator, document-conversion, or Firebase CLI tooling dependencies.

The 14 production entries are `@firebase/firestore`, `@firebase/firestore-compat`, `@google-cloud/storage`, `@grpc/grpc-js`, `brace-expansion`, `dompurify`, `firebase`, `firebase-admin`, `gaxios`, `monaco-editor`, `nanoid`, `retry-request`, `teeny-request`, and `uuid`. Direct application dependencies among them are `firebase@12.17.0`, `firebase-admin@14.2.0`, and `monaco-editor@0.56.0`; the remaining entries are transitive. The full-tree additions are `@firebase/rules-unit-testing`, `@google-cloud/pubsub`, `@opentelemetry/core`, `@xmldom/xmldom`, `basic-ftp`, `body-parser`, `csv-parse`, `express`, `fast-uri`, `firebase-tools`, `get-uri`, `hono`, `ip-address`, `js-yaml`, `morgan`, `pac-proxy-agent`, `proxy-agent`, `qs`, `re2`, `stream-json`, and `undici`.

### Production reachability classification

| Package/advisory family | Installed path and reachable surface | Classification | Disposition |
| --- | --- | --- | --- |
| `@grpc/grpc-js` / Firestore (`@firebase/firestore`, compat, `firebase`) | `@grpc/grpc-js@1.9.16` is selected by the browser Firebase package's Node path; `1.14.4` is nested under `google-gax` for direct server Firestore. Production uses the latter as an outbound Firestore client, not a gRPC server. The high certificate-authorization advisory and low server-error disclosure advisory concern server-side APIs. The grpc package name is absent from built browser assets. | **Group B — reachable dependency, vulnerable behavior not invoked** | Patch Firebase/Firestore in a controlled dependency batch; do not treat the npm severity propagation as proof of a Production exploit. |
| `firebase-admin` / optional `@google-cloud/storage` → `retry-request`, `teeny-request`, `gaxios@6`, `uuid@9` | Firebase Admin Auth is Production-reachable, but no Production API/server module imports Admin Storage or `@google-cloud/storage`; Storage imports occur only in local scripts/tools. The active WIF/auth path uses newer `google-auth-library`/`gaxios@7`, and direct Firestore uses its separate client chain. The UUID flaw additionally requires calling name-based UUID APIs with a caller-supplied output buffer. | **Group B — installed optional chain, unused in Production requests** | Update Firebase Admin in a controlled batch and confirm optional Storage resolution; no emergency runtime change. |
| `dompurify@3.4.8` / `monaco-editor@0.56.0` | DOMPurify occurs only in the lazy `MonacoCodeEditor` browser chunk. Application source does not import DOMPurify or configure its hooks/`IN_PLACE` behavior. Learner source is editor text, not application-provided HTML passed into DOMPurify. Exploitation of the listed configuration-pollution, detached-subtree, or Trusted Types cases is therefore not demonstrated, though the dependency is browser-reachable. | **Group B — browser reachable, constrained/unproven vulnerable invocation** | Evaluate Monaco 0.57.x in a controlled editor regression and bundle batch; it is a 0.x minor with nontrivial integration risk, not a blind patch. |
| `brace-expansion@2.1.4` | Reached through glob/minimatch/rimraf package-management and Google client dependency tooling, not learner-controlled runtime glob expansion. | **Group C — build/package tooling path** | Prefer a lockfile-compatible transitive update to 2.1.7 in a controlled low-risk batch. |
| `nanoid@3.3.16` | Reached through PostCSS/Vite build tooling. Application source does not call the vulnerable custom generator with a zero size, and Nano ID is not present as an application runtime import. | **Group C — build-only** | Prefer a lockfile-compatible update to the patched 3.3.x release in a controlled low-risk batch. |
| 21 full-tree-only entries | Firebase CLI/emulator (`firebase-tools`), Rules testing, Mammoth XML conversion, AJV/tooling, MCP/proxy, Express, telemetry, or test DOM stacks. They are excluded entirely by `--omit=dev` and are not shipped as Production application dependencies. | **Group C — development/test/tooling only** | Upgrade `firebase-tools`, Rules testing, Mammoth, AJV/transitives, and related tooling as separate controlled batches; preserve emulator and publishing regressions. |

No **Group A — Production-reachable and demonstrably exploitable** advisory was identified. Payment, AI, compiler-public Share/Feedback, and Firebase Auth/Firestore request paths were specifically considered. Their reachable authentication and database clients do not expose the vulnerable gRPC server APIs, and the optional Admin Storage chain is not imported by those handlers. Compiler runtime engines are not implicated by the npm findings; Monaco's lazy editor surface is the only learner-facing browser dependency in the 14-entry set.

### Compatibility constraints and warning ownership

The scoped override remains intentional and unchanged:

```json
"overrides": {
  "jwks-rsa": {
    "jose": "5.10.0"
  }
}
```

The installed Production chain is `firebase-admin@14.2.0` → `jwks-rsa@4.1.0` → overridden `jose@5.10.0`; `@vercel/oidc@3.8.5` also resolves to `jose@5.10.0`. The independent development-only MCP chain under `firebase-tools` uses `jose@6.2.7`. Current `firebase-admin@14.5.0` package metadata still declares `jwks-rsa ^4.0.1`, so an Admin upgrade alone is not evidence that the synchronous CommonJS/ESM loader incompatibility is gone. Removing the override would risk restoring the already observed Production `ERR_REQUIRE_ESM` failure. Removal is permitted only after an isolated upstream compatibility test and Vercel loader regression pass.

The Node `url.parse()` deprecation remains a dependency-owned warning rather than an application advisory. Repository and targeted dependency scans found no application-source call and did not isolate a safe direct replacement point. It should be rechecked after the Google/Firebase dependency batch; patching vendored code or suppressing the warning is not justified.

### Remediation sequence

1. **PATCH_NOW_LOW_RISK (controlled lockfile batch):** resolve compatible patched `brace-expansion` and `nanoid` transitive versions if npm can do so without parent major changes; rerun dependency-boundary, build, bundle, and relevant server smoke checks.
2. **PATCH_IN_CONTROLLED_DEPENDENCY_BATCH:** evaluate `@google-cloud/firestore@8.7.1`, `firebase@12.19.0`, and `firebase-admin@14.5.0` individually. Preserve WIF direct-Firestore construction, Firebase Admin Auth, payment/AI paths, emulator behavior, browser bundle boundaries, and the `jose@5.10.0` override. Do not accept npm audit's suggested Firebase downgrade as an automatic fix.
3. **PATCH_IN_CONTROLLED_EDITOR_BATCH:** evaluate `monaco-editor@0.57.0` and verify every embedded/standalone editor, Worker loading, model disposal, themes, accessibility, runtime chunking, and bundle budgets before adoption.
4. **DEFER_DEV_ONLY:** update `firebase-tools@15.32.1`, `@firebase/rules-unit-testing@5.0.2`, `mammoth@1.13.0`, and remaining dev transitive packages in isolated CLI/emulator/publishing batches. Their advisories do not block the deployed application but still require owner follow-up.
5. Rerun both full and `--omit=dev` audits after each batch. Record package-entry counts rather than calling them unique CVEs, and require a Production-path reachability review for any remaining high/critical item.

No dependency was upgraded, removed, overridden, or lockfile-edited during this phase. No commit or deployment was performed. Based on present reachability evidence, the advisory inventory is maintenance debt with a prioritized remediation plan, not a demonstrated Production security blocker.

Final dependency classification: `DEPENDENCY_TRIAGE_NO_PRODUCTION_BLOCKER`.

## RESIDUAL VALIDATION CLOSURE — 2026-10-02

### Repository and Production availability

The final residual pass was performed from `main` at `debc1968c91c6b753997362da90e4d01e4420cf4`; `origin/main` resolves to the same SHA. The only intentional release-documentation change is this report. The pre-existing `src/access/PremiumGate.jsx` modification, deleted `firebase-debug.log`, emulator/debug logs, temporary Firebase/Monaco/TeaVM directories, screenshot, and generated .NET `bin`/`obj` output remain unrelated and untouched.

No existing authorized Production browser session, Playwright storage state, or safe Production test credential was available. The Production Google login/session-restoration, Profile/Settings, Projects list, opened Project Workspace, Learning Engine, and sign-out smoke was therefore not attempted: `AUTHENTICATED_PRODUCTION_SESSION_UNAVAILABLE`. No account was created, no token was synthesized, and no Production user data was changed. A legitimately Premium-entitled Production test identity was likewise unavailable: `PREMIUM_PRODUCTION_JOURNEY_NOT_AVAILABLE`. These are retained validation gaps, not release blockers.

### Focused accessibility and lifecycle sanity

A focused real-Chromium sanity pass reused the deterministic local Firebase emulator identity rather than Production data. Five selected tests passed: the live Learning Engine lesson scan and navigation semantics; opened Project Workspace scan, Results/Guide/AI tab keyboard behavior, and splitter controls; public/auth/catalog/standalone compiler axe matrix; authenticated AppShell route axe matrix including Home; and keyboard skip navigation plus standalone compiler dialog focus restoration. No critical or serious axe finding was reported.

NVDA was absent from `PATH` and both standard Windows installation locations, so `MANUAL_NVDA_VALIDATION_UNAVAILABLE` remains. The automated keyboard sanity passed for skip navigation, auth reachability, compiler dialog open/Escape/focus return, Learning sidebar activation, Project result and assistance tabs, and Project splitters. This is not a substitute for a manual assistive-technology session or exhaustive keyboard traversal.

No Monaco/editor/compiler/CSS file is dirty relative to the validated release SHA. The prior long-session evidence and responsive/text-spacing evidence therefore remain current without repeating their expensive matrices: `MONACO_LONG_SESSION_LIFECYCLE_VALIDATED`. Monaco's portion of VALIDATION-013 stays closed.

### Deferred operational evidence

No explicitly synthetic, safely identifiable expired Production Share was available through an existing test mechanism. The Production janitor mutation was not invoked and remains `JANITOR_PRODUCTION_MUTATION_DEFERRED`; its authentication, direct-Firestore, bounded deletion, and emulator paths retain their existing validated evidence. No Production record was created solely to make this check possible.

Request cleanup remains locally validated for direct `Firestore.terminate()` and Firebase Admin `deleteApp()`. Production does not emit an explicit cleanup-completion event. This is `OPTIONAL_OBSERVABILITY_IMPROVEMENT`, not a correctness defect.

The selected browser assertions completed successfully, but the outer Windows PowerShell/PTY or descendant process again remained alive after assertions until explicitly interrupted. Owned product services/ports are separately cleaned up, and no product assertion failed. VALIDATION-005 therefore remains `ACCEPTED_LIMITATION`; a future tooling task should isolate and close the retained Windows process handle without changing product behavior.

Assembly status is unchanged: a fresh Vite-development initialization can take approximately 80–90 seconds, while previously validated Production execution completed in approximately seven seconds. Production functionality is not disproven. VALIDATION-009 remains `ACCEPTED_LIMITATION`; cold-development startup profiling belongs in a future runtime-performance task.

VALIDATION-013 remains `PARTIALLY_VALIDATED`. Its Monaco lifecycle portion is closed and the focused axe/keyboard sanity is clean. Remaining gaps are an actual NVDA/Narrator session, an eligible Premium exam/setup journey, explicitly untested quiz/exercise variants, and destructive Project file-operation focus restoration.

### Dependency, bundle, and compiler status

Dependency classification remains `DEPENDENCY_TRIAGE_NO_PRODUCTION_BLOCKER`. The Production audit contains 14 package entries (1 low, 7 moderate, 6 high, 0 critical); the full dependency tree contains 35 entries. No package or lockfile was changed. Future maintenance order remains: (1) compatible `brace-expansion`/`nanoid` updates; (2) controlled Firebase/Firebase Admin/Firestore batch; (3) separate Monaco 0.57 editor-regression batch; and (4) Firebase CLI, Rules testing, Mammoth, and other development-tool batches.

The scoped compatibility edge remains `jwks-rsa@4.1.0` → `jose@5.10.0`. It must remain until an upstream Firebase Admin/`jwks-rsa` combination eliminates the synchronous loader incompatibility without restoring `ERR_REQUIRE_ESM`. The `url.parse()` deprecation remains `DEPENDENCY_OWNED_SOURCE_NOT_ISOLATED`; targeted read-only source/import tracing did not identify a safe application-owned replacement point, so no vendored patch or warning suppression is justified.

Bundle budgets remain passing at 973,788 bytes initial JavaScript raw / 254,112 gzip, 30,293 bytes initial CSS raw / 6,640 gzip, and 12 lazy route entries. Narrow initial-JavaScript gzip headroom is `MONITORING_DEBT`, not a defect.

Validated Production compiler evidence remains current and was not repeated unnecessarily: Share POST `201`, Share GET `200`, multiline-stdin Share persistence, invalid Auth `401`, Feedback `201`, direct Firestore RPCs, Vercel OIDC, Google STS, service-account impersonation, Firebase Admin Auth, direct Firestore construction, live JavaScript and Python execution, compiler isolation headers, `crossOriginIsolated`, and `SharedArrayBuffer` availability.

### Final residual backlog

| Group | Description | Release blocker? | Recommended timing | Likely scope |
| --- | --- | --- | --- | --- |
| A — Validation follow-up | Run authorized Production Google/session, Settings, Projects Workspace, Learning Engine, and safe sign-out smoke when a pre-approved test identity/session exists. | No | Next authorized Production validation window | Browser-only read/render smoke; no important data mutation |
| A — Validation follow-up | Exercise an eligible Premium exam/setup journey and representative quiz/exercise variants without bypassing entitlement. | No | When a legitimate test entitlement and canonical fixtures exist | Premium/accessibility browser coverage |
| A — Validation follow-up | Perform a short NVDA or Narrator pass and destructive Project-operation focus-restoration checks against disposable data. | No | Before the next major accessibility certification | Manual accessibility and disposable Project fixture |
| A — Validation follow-up | Validate Production janitor deletion only when an explicitly synthetic expired Share is safely available. | No | Next safe operational maintenance window | One synthetic record, janitor WIF/direct-Firestore evidence, legitimate-record guard |
| B — Test/tooling infrastructure | Repair the retained Windows Playwright/PowerShell/PTY process handle after successful assertions. | No | Normal tooling sprint | Harness process ownership and teardown only |
| B — Test/tooling infrastructure | Profile Assembly's 80–90 second fresh Vite-development initialization. | No | Runtime performance backlog | Development harness/cache/startup; preserve Production runtime |
| C — Dependency maintenance | Apply the four documented controlled dependency batches and rerun reachability/audit evidence. | No | Scheduled dependency maintenance | Lockfile, Firebase/WIF regressions, Monaco regressions, CLI/emulator tooling |
| D — Observability | Optionally emit bounded cleanup-completion telemetry for Firestore termination and Firebase app deletion. | No | Observability backlog | Safe lifecycle event only; no credential or learner data |
| E — Upstream compatibility | Remove the `jose@5.10.0` override only after upstream CommonJS/ESM compatibility is proven; recheck the dependency-owned `url.parse()` source after upgrades. | No | Upstream dependency review | Firebase Admin/`jwks-rsa` loader probe and warning attribution |

### Definitive release state

AUDIT remains 10 total, 10 closed, 0 partial, and 0 blocking. VALIDATION remains 13 total, 10 closed, 3 partial/accepted, and 0 blocking; the three retained items are VALIDATION-005, VALIDATION-009, and VALIDATION-013. Deferred manual or mutation-based evidence is not promoted to a blocker without a demonstrated defect.

**OPEN RELEASE BLOCKERS: NONE.**

Final release classification remains `PRODUCTION_DEPLOYMENT_VALIDATED_WITH_LIMITATIONS`.

Release may remain live: **YES**.

Residual-cycle classification: `RELEASE_VALIDATION_CYCLE_COMPLETE_WITH_ACCEPTED_LIMITATIONS`.
