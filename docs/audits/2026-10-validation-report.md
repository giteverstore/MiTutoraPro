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
