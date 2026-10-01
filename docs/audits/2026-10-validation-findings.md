# Validation Findings — 2026-10-01

This file records failures observed during the validation-only pass at `7495fb734513f5a2459350301ccdd37d211a9530`. No remediation was performed.

## VALIDATION-001

**Severity:** MEDIUM
**Type:** TEST FAILURE
**Status:** remediated 2026-10-01
**Area:** Vercel routing tests
**Title:** Legacy routing test still requires removed `vercel.json`

**Reproduction:** Run `npm.cmd exec vitest run -- tests/batch-5/routing.test.js`.
**Expected:** Tests validate the active Vercel configuration.
**Actual:** Collection fails with `ENOENT` for `vercel.json`; the repository now uses `vercel.mjs`.
**Evidence:** Failed in the full suite and in an isolated rerun.
**Affected files:** `tests/batch-5/routing.test.js`, `vercel.mjs`
**User impact:** CI can fail before validating current routing behavior.
**Recommended next step:** Move the assertions to the active config export without changing routing behavior.

## VALIDATION-002

**Severity:** LOW
**Type:** TEST FAILURE
**Status:** remediated 2026-10-01
**Area:** Vercel cron configuration
**Title:** Cron test assumes a stale route-array index

**Reproduction:** Run `npm.cmd exec vitest run -- tests/compiler/vercel-cron-config.test.js`.
**Expected:** Cron isolation assertions locate routes by meaning.
**Actual:** An assertion fails after the JavaScript Worker CSP route was inserted ahead of the expected route.
**Evidence:** Failed in the full suite and isolated rerun; configuration-focused behavior tests otherwise passed.
**Affected files:** `tests/compiler/vercel-cron-config.test.js`, `vercel.mjs`
**User impact:** False-negative deployment-config CI.
**Recommended next step:** Select the route by source/destination rather than array position.

## VALIDATION-003

**Severity:** MEDIUM
**Type:** TEST FAILURE
**Status:** remediated 2026-10-01
**Area:** AI API diagnostics
**Title:** Diagnostic tests reference pre-consolidation API entrypoint files

**Reproduction:** Run `npm.cmd exec vitest run -- tests/batch-8/ai-tutor-isolated-runtime-diagnostics.test.js`.
**Expected:** Diagnostics tests inspect the consolidated AI router and handlers.
**Actual:** Tests attempt to read missing files such as `api/ai/diagnostic-handler.js` and `api/ai/diagnostic-wif.js`.
**Evidence:** Failed in the full suite and isolated rerun.
**Affected files:** `tests/batch-8/ai-tutor-isolated-runtime-diagnostics.test.js`, `api/ai/[...path].js`
**User impact:** AI diagnostic CI is red and no longer protects the current entrypoint architecture.
**Recommended next step:** Retarget source-contract assertions to the consolidated router and retained service handlers.

## VALIDATION-004

**Severity:** LOW
**Type:** TEST FLAKE
**Status:** remediated 2026-10-01
**Area:** Public landing tests
**Title:** Landing render test exceeds the five-second timeout under full-suite load

**Reproduction:** Run the entire Vitest suite; `public-landing.test.jsx` timed out once.
**Expected:** The test completes consistently within its timeout.
**Actual:** It timed out under broad concurrent load, then passed alone in 734 ms.
**Evidence:** One failure followed by a successful bounded isolated rerun.
**Affected files:** `tests/batch-8/public-landing.test.jsx`
**User impact:** Intermittent CI failures; no landing product regression was reproduced.
**Recommended next step:** Profile setup/import contention and remove timing sensitivity rather than increasing the timeout blindly.

## VALIDATION-005

**Severity:** MEDIUM
**Type:** TEST FAILURE
**Status:** partially remediated; lifecycle blocker remains
**Area:** Authenticated browser E2E
**Title:** Shared Playwright sign-in helper waits for auth fields on the public landing route

**Reproduction:** Run `npm.cmd exec playwright test -- --retries=0`.
**Expected:** The helper navigates to Sign in and authenticates before protected-flow tests.
**Actual:** `page.goto('/')` renders the public landing page and the helper waits three minutes for an `Email` field that is not on that page. The first two tests timed out.
**Evidence:** Both timeout contexts contained the public landing DOM; the run was stopped after two three-minute failures.
**Affected files:** shared Playwright auth helper and authenticated E2E specifications
**User impact:** Authenticated browser coverage is effectively blocked; this is not evidence that production sign-in is broken.
**Recommended next step:** Make the helper explicitly enter the current authentication route/UI, then rerun the protected-flow matrix.

## VALIDATION-006

**Severity:** MEDIUM
**Type:** KNOWN AUDIT ISSUE
**Status:** remediated
**Area:** Dependency boundary
**Title:** `firebase-admin` remains in browser production dependencies

**Reproduction:** Run `npm.cmd run validate:dependency-boundaries`.
**Expected:** The dependency-boundary validator passes.
**Actual:** It fails: `firebase-admin must not be a browser production dependency.`
**Evidence:** Reproduces AUDIT-004.
**Affected files:** `package.json`, `scripts/validate-dependency-boundaries.mjs`
**User impact:** Server/browser packaging governance remains unsafe and CI cannot be green.
**Recommended next step:** Resolve dependency placement and prove Admin SDK absence from client bundles.

**Remediation (2026-10-01):** The original reproduction remains documented above. Root `firebase-admin` intentionally remains a production dependency for Vercel functions. The boundary validator now models runtime ownership instead of treating dependency installation as browser reachability: production placement is required, while any Admin SDK import in `src/` fails validation.

**Validation:** Boundary validation passed (469 browser modules); fail-closed client and allowed-server fixtures passed; compiler-public emulator acceptance passed 9/9; payment server tests passed 28/28; Firebase Admin initialization tests passed 71/71; Vite production build passed and the browser artifact scan was clean.

**Residual risk:** Future non-`src/` browser roots require explicit enrollment in the boundary scan.

## VALIDATION-007

**Severity:** MEDIUM
**Type:** PERFORMANCE REGRESSION
**Status:** remediated
**Area:** Frontend bundles
**Title:** CSS budgets and route-splitting requirements still fail

**Reproduction:** Run `npm.cmd run validate:bundle-budgets`.
**Expected:** Configured raw/gzip and dynamic-entry budgets pass.
**Actual:** Initial CSS is 419,413 bytes (budget 250,000) and 64,004 gzip bytes (budget 40,000); `AuthFlow.jsx` and `CourseRoute.jsx` are not dynamic route entries.
**Evidence:** Production build succeeded but also reported large chunks. This reproduces AUDIT-005.
**Affected files:** global CSS/import graph, application route graph, budget validator
**User impact:** Slower first load and higher parse/memory cost, especially on constrained devices.
**Recommended next step:** Restore effective route/CSS splitting and retain enforced budgets.

**Remediation — 2026-10-01:** The original reproduction remains documented above. Route-owned CSS and public-route dynamic entries reduce the initial graph to 973,487 bytes JavaScript (254,039 gzip) and 30,293 bytes CSS (6,643 gzip). The unchanged validator now passes all raw/gzip thresholds, all 12 lazy-route assertions, and the Monaco/vision/Silero exclusion checks. AuthFlow and CourseRoute are dynamic entries. Focused route/component/compiler regressions, CSS architecture, dependency boundaries, and the production build passed. Remaining multi-megabyte runtime assets are lazy by design rather than initial-payload regressions.

## VALIDATION-008

**Severity:** MEDIUM
**Type:** TEST FAILURE
**Status:** remediated 2026-10-01
**Area:** Java runtime validation
**Title:** Java runtime script cannot load extensionless Firebase import in Node 25

**Reproduction:** Run `npm.cmd run test:java-runtime`.
**Expected:** The Java buffered-mode acceptance script starts and validates runtime cases.
**Actual:** Node throws `ERR_MODULE_NOT_FOUND` for `src/firebase/firebase` imported by `src/firebase/auth.js`.
**Evidence:** Script exits before Java runtime evidence is produced.
**Affected files:** `scripts/test-java-runtime.mjs`, `src/firebase/auth.js` and its import chain
**User impact:** Java buffered-mode release evidence is unavailable; no Java product failure was proven.
**Recommended next step:** Make the test harness use the same resolvable module boundary as the application, then rerun the Java matrix.

## VALIDATION-009

**Severity:** MEDIUM
**Type:** ENVIRONMENT BLOCKER
**Status:** partially remediated; runtime execution hang remains
**Area:** Browser runtime acceptance
**Title:** Runtime browser scripts lose their Vite server during dependency scanning

**Reproduction:** Run the Assembly, native C/C++, or PHP browser runtime script.
**Expected:** A stable local Vite server serves the real-browser acceptance harness.
**Actual:** Vite emits many `The server is being restarted or closed. Request is outdated` dep-scan errors. Assembly/native navigation times out; PHP later exceeds its 10-second execution limit.
**Evidence:** Reproduced across three runtime scripts and again with PHP after no relevant ports were listening.
**Affected files:** runtime browser test scripts and Vite test-server lifecycle/configuration
**User impact:** Real Chromium stdin/runtime acceptance for C, C++, PHP, R, C#, VB, Assembly, and related cleanup paths is incomplete.
**Recommended next step:** Stabilize and isolate the browser-test server lifecycle before drawing runtime conclusions.

## Validation infrastructure remediation — 2026-10-01

- **VALIDATION-001/002 (stale tests):** Vercel assertions now import `createVercelConfig`, recognize host-scoped compiler isolation and Worker CSP routes, locate compiler/filesystem/fallback routes by meaning rather than array index, and retain cron/Hobby constraints.
- **VALIDATION-003 (stale test):** AI diagnostics now inspect the consolidated API entrypoint plus retained authorization/probe modules instead of deleted pre-consolidation files. Runtime isolation assertions remain substantive.
- **VALIDATION-004 (flake):** The landing suite passed 20 consecutive isolated runs (540 assertions) without timeout changes. No product failure reproduced.
- **VALIDATION-005 (broken helper plus lifecycle issue):** The helper now enters `/login`, provisions its emulator user deterministically, and emits specific emulator/session failures. Trace inspection proved the former run reused a production-configured preview and contacted live Identity Toolkit. Reuse is now disabled and Firebase CLI state is workspace-local. Repeated runs still exposed an orphan/port-4173 collision after interrupted Playwright teardown; authenticated repeatability is not yet proven.
- **VALIDATION-008 (harness import):** Java validation now constructs its minimal manager/registries directly and no longer imports the application runtime registry/Firebase browser initialization. The complete Java script passed.
- **VALIDATION-009 (harness lifecycle):** A shared harness allocates an OS-selected port, uses strict binding, polls HTTP readiness, disables dependency discovery, and closes Vite on startup failure. Ten allocate/readiness/close cycles passed. The full Assembly runtime command still hung after readiness and was manually stopped, so full runtime repair is incomplete.

## Final infrastructure closure attempt — 2026-10-01

- **VALIDATION-005 remains partially remediated.** Reproduction proved the collision was real: Playwright waited for Firebase while an older delayed preview claimed `4173`, then rejected that unowned server. The app preview now uses a per-Playwright-process port propagated through `E2E_APP_PORT`; `4173` is no longer shared. The Firebase CLI is invoked directly rather than through `npx.cmd`, and both servers have explicit graceful-shutdown requests. Authentication against the emulator succeeded and `/settings` rendered an authenticated shell. However, Windows teardown still retained the Firebase Node/Java tree after a normal failed test until the outer Playwright process was interrupted. An experimental global-setup owner released the tree but caused a new Playwright worker hang and was removed. Required 10/10 lifecycle proof therefore did not complete.
- **VALIDATION-009 remains partially remediated.** Stage instrumentation located the apparent hang in Assembly worker initialization, specifically Emscripten run dependencies for WASM instantiation and preloading `/assembler`. Assets loaded and the worker emitted results when given a bounded 120-second cold-initialization allowance. Observed fresh-worker initialization was approximately 80–90 seconds in the Vite development harness, so the 10-cycle minimal run was stopped after two successful cycles rather than masking the problem with an unbounded timeout. The full suite was not completed. Classification: environment/harness performance issue; no Assembly product-runtime defect was proven.

## AUDIT-006 validation follow-up — 2026-10-01

The coin collection failure was reproduced as `ENOENT` from `tests/coins/redeem-development-ui.test.js` reading removed `src/styles.css`. The assertion now follows the current theme and route-owned stylesheet contracts, and the Redeem route explicitly loads the existing Redeem rules. Coin tests pass 35/35 files and 337/337 tests; focused theme/AppShell tests pass 18/18; CSS architecture validation and the 39.44-second production build pass. No financial or redemption behavior changed.

## AUDIT-008 validation follow-up — 2026-10-01

The browser header policy is centralized and host-aware. Main documents receive CSP framing/base/object/form protections, MIME/referrer/permissions/HSTS/frame headers without compiler isolation. Compiler custom/stable/preview hosts additionally receive COOP, COEP, and CORP. API routes use a JSON-appropriate subset and the learner Worker keeps its strict deny-network CSP. Configuration tests pass; real Chromium proves local isolation and `SharedArrayBuffer`; hostile JS/TS browser tests pass 7/7. The known Windows Playwright teardown hang recurred only after all assertions completed and required terminating the owned wrapper.

**Environment contract:** See `docs/testing/VALIDATION_ENVIRONMENT.md` for Node, Java, browser, emulator ownership, credentials, and skip semantics.

**Regression evidence:** Current Vercel/AI/auth/landing focused tests passed 72/72, dependency boundaries passed across 469 browser modules, Java runtime validation passed, and production build passed in 56.68s. Existing PHP-WASM, import-splitting, and large-chunk warnings remain.

**Residual limitation:** Authenticated E2E teardown/port ownership and full browser-runtime execution must be closed before this phase can be classified fully repaired.

## VALIDATION-010

**Severity:** INFO
**Type:** ENVIRONMENT BLOCKER
**Status:** blocked
**Area:** Package security
**Title:** npm advisory lookup unavailable in the restricted validation environment

**Reproduction:** Run `npm.cmd audit --audit-level=low`.
**Expected:** npm returns an advisory report.
**Actual:** Registry audit access fails; npm also cannot write its normal log location outside the workspace.
**Evidence:** No vulnerability result was produced.
**Affected files:** none
**User impact:** Current dependency CVE exposure remains unknown.
**Recommended next step:** Run the same audit in CI or an approved networked environment without upgrading packages in this phase.

## VALIDATION-011

**Severity:** MEDIUM
**Type:** KNOWN AUDIT ISSUE
**Status:** reproducible by inspection and existing tests
**Area:** Compiler resource limits
**Title:** Browser source, buffered stdin, output, and transcript limits remain incomplete

**Reproduction:** Trace browser dispatch/output paths and run their existing contract tests.
**Expected:** Shared byte/line ceilings reject oversized source/stdin and bound stdout/stderr/transcript growth.
**Actual:** Interactive SAB input is bounded, and public/remote APIs have limits, but browser source/buffered input and streamed transcript growth lack a shared central ceiling.
**Evidence:** Reproduces AUDIT-002 and AUDIT-003; uncontrolled flooding was intentionally not run.
**Affected files:** `CompilerManager`, browser Worker clients/runtimes, terminal transcript state
**User impact:** A bounded-time program can still create browser memory pressure or UI lockup.
**Recommended next step:** Add shared UTF-8 input and output/transcript budgets with truthful truncation evidence.

## VALIDATION-012

**Severity:** LOW
**Type:** ENVIRONMENT BLOCKER
**Status:** environment-dependent
**Area:** Firebase rule validation
**Title:** Some direct rule tests became unavailable after the emulator process stopped

**Reproduction:** Run `node tests/firestore/coin.rules.test.mjs` and `node tests/firestore/compiler-public.rules.test.mjs` without Firestore on port 8080.
**Expected:** Rule harness owns or reaches its emulator.
**Actual:** Both fail with `ECONNREFUSED 127.0.0.1:8080`. Earlier content, certification, Storage, and compiler-public acceptance runs passed while emulators were available.
**Evidence:** Two command-level blockers; no rule denial failure was observed.
**Affected files:** emulator orchestration and direct rules scripts
**User impact:** Final rule coverage is partial in this pass, not proof of a deployed-rules defect.
**Recommended next step:** Give each rules suite deterministic emulator ownership/ports.

## VALIDATION-013

**Severity:** LOW
**Type:** TEST GAP
**Status:** blocked
**Area:** Memory, cleanup, accessibility, responsive coverage
**Title:** Long-session resource profiling and complete automated accessibility/device matrices are absent

**Reproduction:** Inventory test scripts and run the available suites.
**Expected:** Dedicated assertions cover Monaco model counts, worker/timer/listener disposal, axe-style accessibility, and mobile/tablet/desktop flows.
**Actual:** Lifecycle and semantic component contracts exist, and JS/TS passed desktop/mobile Chromium, but no complete profiler/a11y/device matrix was available; authenticated E2E was also blocked by VALIDATION-005.
**Evidence:** No axe dependency or comprehensive leak profiler was found.
**Affected files:** test infrastructure
**User impact:** Regressions in long sessions, assistive technology, or untested responsive flows may escape CI.
**Recommended next step:** Add bounded profiler assertions and automated accessibility/responsive coverage after the blocking E2E harness is repaired.

### Monaco lifecycle closure — 2026-10-01

The Monaco portion of VALIDATION-013 is fixed and validated. Profiling confirmed that Project Workspace file switches created URI-backed models which `@monaco-editor/react` retained, while unmount only disposed the currently attached model. Repeated file visits could therefore grow `monaco.editor.getModels()` monotonically. Repeated Monaco language/theme registration and pointer-resize listeners surviving a mid-drag unmount were additional lifecycle defects.

Ownership is now explicit: open Project tabs retain their URI-backed models for dirty state and undo/redo; close, delete, rename, project switch, and workspace unmount dispose models at the project URI boundary. Language/theme registration occurs once per Monaco instance, editor disposables remain tied to editor disposal, pending focus animation is cancelled, and workspace resize listeners are removed on pointer completion or unmount.

The real Chromium harness observed model counts of 1 baseline, 50 for 50 intentionally open files, 1 after closing 49, 1 after rename, 1 after 20 project switches, 1 after 20 route cycles, and 0 after final unmount. Thirty language switches and 50 standalone/compiler edit-reset-unmount cycles did not increase the count. Dedicated Monaco workers remained bounded at zero in this Monarch/editor-api configuration. Forced-GC heap was stable at 18,200,000 bytes before and after; listeners fell from 271 to 160 and retained documents from 5 to 2. Accessibility and the broader responsive-device portion of VALIDATION-013 remain separate open work.
## Resource-limit remediation follow-up — 2026-10-01

**VALIDATION-011 — Status: FIXED (validated 2026-10-01).** A shared compiler resource policy now enforces UTF-8 source, buffered input, per-submission/cumulative interactive input, stdout, stderr, transcript, and SQLite row limits. Boundary and cleanup contracts pass. Real Chromium output-limit termination and recovery pass for JS/TS, Python, C, PHP, R, and C#.

The implementation preserves stricter server-side limits and the JS/TS capability boundary. No remote-runner, auth, Firebase, payment, or navigation behavior was changed.
## Firebase emulator determinism follow-up — 2026-10-01

- **VALIDATION-012 fixed for rules suites:** content, certification, and Storage commands now share an owned `emulators:exec` wrapper, pin distinct `demo-*` projects, isolate CLI configuration, and refuse occupied ports. All three passed. Coin rules received the same isolated CLI-state/Java treatment and passed five consecutive fresh runs.
- **VALIDATION-005 remains partially remediated:** authenticated sign-in/protected-route assertions passed five consecutive repetitions and ports 8080/9099 were released. The launcher now performs exclusive port preflight, bounded readiness probes, project pinning, ownership recording, secret stripping, and exact-PID Windows cleanup. However, the outer Playwright PowerShell/PTY retained an open handle after server cleanup; coin-ledger Vitest did likewise. Both required bounded interruption, so full lifecycle closure is not claimed.

### Accessibility remediation follow-up — 2026-10-01

The accessibility portion of VALIDATION-013 is partially remediated. A real-Chromium axe matrix now covers landing, authentication, public Library/Practice/Projects, standalone compiler, and authenticated Home, Library, Practice, Challenges, Projects, Bookmarks, Certificates, Referrals, Wallet, Redeem, and Settings. The final scanned matrix has no critical or serious WCAG 2.1 A/AA findings. Confirmed contrast failures were repaired for landing mentor steps, active shell navigation, Library metadata, Practice difficulty/status text, Bookmarks tabs, and Settings navigation.

Keyboard remediation adds an authenticated-shell skip link and keyboard-operable, value-announced Project Workspace splitters. Project file tabs now expose tablist/tab selection semantics. Focused keyboard browser coverage verifies auth-field reachability, standalone language-dialog activation/Escape/focus restoration, and skip-link focus transfer. Closure remains partial: Course Overview/Learning Engine, an opened Project Workspace, and exam/setup experiences were not reached by the automated axe route matrix; mobile/zoom and screen-reader validation remain manual. The existing Windows Playwright outer-process teardown handle also persists after assertions pass. See `docs/testing/ACCESSIBILITY_VALIDATION.md`.

#### Accessibility closure update — 2026-10-01

**VALIDATION-013 accessibility status: PARTIALLY VALIDATED.** Real Learning Engine and opened Project Workspace axe scans now pass with no critical/serious WCAG 2.1 A/AA findings. Dark, mobile, tablet, 200%-reflow, and text-spacing representative checks also pass. Confirmed serious automated findings in compiler tab structure, stale `aria-controls`, scrollable-region focusability, and foreground contrast were fixed and covered by browser regression tests.

Remaining test gaps are not known product failures: an eligible live exam/setup state was unavailable to the free emulator account; the selected course fixture did not expose every quiz/exercise variant; destructive Project file operations were not performed; and NVDA was unavailable. Browser semantic inspection must not be represented as full manual screen-reader certification. The Windows outer Playwright process can still retain a handle after completed assertions; successful assertion output is captured before terminating the owned wrapper.
