# Critical

No critical findings were confirmed.

# High

## AUDIT-001

**Severity:** HIGH
**Status:** FIXED (validated 2026-10-01)
**Area:** Compiler runtime isolation
**Title:** JavaScript and TypeScript learner code retains same-origin Worker global access

**Affected files:**
- `src/compiler/runtimes/javascript/javascriptExecution.js`
- `src/compiler/runtimes/javascript/javascript.worker.js`
- `src/compiler/runtimes/javascript/JavaScriptWorkerClient.js`

**Evidence:**
- `executeJavaScriptSource` constructs learner code with `new Function` at lines 35-39.
- Only selected names (`window`, `document`, storage aliases, and parent-window aliases) are shadowed. `globalThis`, `self`, `fetch`, `WebSocket`, `EventSource`, `caches`, and other Worker APIs remain reachable.
- A direct audit execution of `console.log(typeof globalThis.fetch)` returned `function`.
- The Worker is delivered from the application origin. Browser Workers are a responsiveness boundary, not a security sandbox.

**Risk:** Untrusted learner JavaScript/TypeScript can make network requests and access Worker-exposed origin capabilities. Depending on browser credential and storage behavior, this can reach same-origin endpoints or browser-held data, and it violates the expected compiler isolation boundary.

**Realistic failure/exploit scenario:** A pasted exercise calls `globalThis.fetch('/api/...')`, opens outbound connections, or accesses Worker-available storage/cache APIs. The 10-second worker timeout limits CPU duration but does not remove those capabilities.

**Affected users/surfaces:** Standalone compiler and embedded Course, Practice, Challenge, or Project surfaces that execute JavaScript/TypeScript.

**Recommended fix:** Execute hostile JS/TS in a deliberately capability-limited isolated origin or hardened sandbox. Treat name shadowing as defense-in-depth only. Deny network and storage at the platform boundary, validate the isolation with real browser tests, and document residual risk.

**Fix complexity:** Large
**Regression risk:** High

**Suggested tests:** Browser tests proving learner code cannot use `globalThis`, `self`, constructor escapes, `fetch`, XHR/WebSocket/EventSource, Cache Storage, IndexedDB, service workers, or authenticated same-origin APIs.

**Remediation:** The JavaScript Worker now captures its minimum host bridge before installing a fail-closed capability boundary. Network transports, nested Workers/imports, browser storage/filesystem entrypoints, and cross-context messaging are replaced with immutable denial stubs. Dynamic `import()` is rejected by `es-module-lexer` before evaluation, with a Worker-response CSP (`connect-src 'none'; worker-src 'none'`) retained as defense in depth. TypeScript continues to transpile into this same runtime.

**Validation evidence:** Focused runtime/config tests pass 23/23 and the standalone compiler regression passes 93/93. A production build succeeds. Real Playwright Chromium tests pass 12/12 across desktop and mobile projects, including request observation proving no same-origin GET/POST, Share/Feedback POST, external fetch, WebSocket, or remote dynamic-import request escapes; reflected `globalThis` probes for extended transports, nested Workers/imports, IndexedDB, Cache Storage, file pickers, channels, and `postMessage`; safe retained capabilities; normal JS/TS behavior; interactive stdin; cancellation; and post-cancellation recovery.

**Residual risk:** This remains a browser Worker, not a hardened operating-system sandbox. CPU/memory/output exhaustion is handled separately (AUDIT-002/003), intentionally retained read-only metadata and standard compute APIs remain visible, and newly introduced Worker globals must be added to the explicit inventory and hostile-browser matrix. The asset-specific CSP route must remain synchronized with Vite's Worker filename convention.

# Medium

## AUDIT-002

**Severity:** MEDIUM
**Status:** CONFIRMED
**Area:** Compiler resource exhaustion
**Title:** Browser compiler output and terminal transcript are unbounded

**Affected files:**
- `src/compiler/runtimes/javascript/javascriptExecution.js`
- `src/compiler/runtimes/native/nativeCompiler.worker.js`
- `src/compiler/runtimes/r/WebRClient.js`
- `src/standalone-compiler/StandaloneCompilerPage.jsx`
- equivalent browser runtime output capture modules

**Evidence:**
- JavaScript appends every line to `stdout`/`stderr` arrays at lines 9-17.
- Native and R runtimes similarly accumulate output without a byte/line ceiling.
- `StandaloneCompilerPage` appends every streaming event into React strings at lines 129-132.
- Remote Go/Rust and MySQL paths have explicit result limits; no equivalent shared browser-runtime output policy was found.

**Risk:** A short program can flood output, causing repeated large React allocations, memory pressure, UI lockup, or tab termination before the compute timeout.

**Realistic failure/exploit scenario:** Learner code loops printing large strings. The worker emits faster than React can render, and both worker arrays and main-thread transcript grow until the page becomes unresponsive.

**Affected users/surfaces:** Standalone and embedded terminal runtimes.

**Recommended fix:** Introduce a shared byte/line output budget, stop forwarding after the threshold, mark results truncated/output-limited, and render a bounded transcript.

**Fix complexity:** Medium
**Regression risk:** Medium

**Suggested tests:** Per-runtime stdout/stderr floods, streamed-event floods, truncation evidence, bounded DOM/string size, and successful execution after an output-limited run.

## AUDIT-003

**Severity:** MEDIUM
**Status:** CONFIRMED
**Area:** Compiler request limits
**Title:** Browser runtimes lack a shared source and buffered-stdin size gate

**Affected files:**
- `src/compiler/core/CompilerManager.js`
- `src/compiler/runtimes/javascript/JavaScriptWorkerClient.js`
- `src/compiler/runtimes/python/PythonWorkerClient.js`
- other browser Worker clients

**Evidence:**
- `CompilerManager.execute` dispatches arbitrary source/stdin without a global byte check.
- Worker clients stringify and post the full source and buffered stdin.
- Interactive submissions are capped by the 64 KiB SharedArrayBuffer, while initial buffered stdin is not equivalently capped.
- Public share, remote compiler, and MySQL APIs do enforce explicit request/source/stdin limits.

**Risk:** Very large editor content or buffered stdin can trigger expensive structured cloning, parser/compiler memory pressure, or tab failure before runtime timeouts apply.

**Realistic failure/exploit scenario:** A shared/local document loads megabytes of source or stdin and repeatedly runs it, creating initialization and cloning storms.

**Affected users/surfaces:** All browser-executed compiler languages.

**Recommended fix:** Enforce centrally defined UTF-8 byte limits before dispatch and mirror them in UI/share/import paths. Keep runtime-specific stricter limits where required.

**Fix complexity:** Small
**Regression risk:** Low

**Suggested tests:** Boundary and over-limit source/stdin tests, multibyte UTF-8 cases, share-load cases, and confirmation that no worker is created for rejected input.

## AUDIT-004

**Severity:** MEDIUM
**Status:** REMEDIATED
**Area:** Dependency/build boundary
**Title:** Repository fails its own Firebase Admin production dependency boundary

**Affected files:**
- `package.json`
- `scripts/validate-dependency-boundaries.mjs`

**Evidence:**
- `firebase-admin` is listed in production `dependencies` at `package.json:126`.
- `npm.cmd run validate:dependency-boundaries` fails immediately: `firebase-admin must not be a browser production dependency.`
- The production build currently succeeds, so this is a boundary/packaging defect rather than a proven client credential leak.

**Risk:** Server-only dependencies can accidentally enter browser dependency resolution, increase install/deploy surface, or mask future browser/server import mistakes.

**Realistic failure/exploit scenario:** A later client import reaches a server module and pulls an unsupported or sensitive server dependency into browser compilation; CI does not provide a passing guardrail today.

**Affected users/surfaces:** Build, deployment, dependency governance.

**Recommended fix:** Align dependency placement and server packaging with the intended boundary, then keep the validator mandatory in CI.

**Fix complexity:** Medium
**Regression risk:** Medium

**Suggested tests:** Passing dependency-boundary validation and bundle-manifest checks proving Admin SDK modules are absent from client chunks.

**Remediation (2026-10-01):** The original failure was a stale package-classification assertion: it rejected `firebase-admin` whenever it appeared in root production dependencies, even though Vercel serverless handlers require that exact placement. The validator now requires `firebase-admin` in production dependencies, rejects development-only placement, and independently scans every tracked and untracked browser module under `src/` for Admin SDK and related server-only imports. Dedicated fixtures prove that a client import fails closed while a server import remains valid.

**Validation:** `validate:dependency-boundaries` passed across 469 browser modules; positive and negative boundary fixtures passed; compiler Share/Feedback emulator acceptance passed 9/9; payment tests passed 28/28; Admin initialization/WIF tests passed 71/71; the production build passed and the complete `dist` tree contained no `firebase-admin`, Admin subpath, service-account variable, or canonical Admin app strings.

**Residual risk:** This is a source/import and built-artifact boundary, not a general dependency vulnerability audit. New browser source outside the canonical `src/` entry graph must be added to the validator if the client architecture changes.

## AUDIT-005

**Severity:** MEDIUM
**Status:** REMEDIATED
**Area:** Frontend performance
**Title:** Initial CSS and JavaScript exceed project budgets

**Affected files:**
- `src/styles/index.css` and imported stylesheets
- `scripts/validate-bundle-budgets.mjs`
- application entry/import graph

**Evidence:**
- `validate:bundle-budgets` reports initial CSS 419,413 bytes versus 250,000, and gzip 64,004 versus 40,000.
- It also reports `AuthFlow.jsx` and `CourseRoute.jsx` are not dynamic route entries.
- Production build produced initial `index` JavaScript of 994.99 kB (258.63 kB gzip), plus large Monaco/Babel/TypeScript chunks.
- Vite reports several dynamic imports cannot split because the same modules are statically imported elsewhere.

**Risk:** Slow first load, high parse/compile cost, and memory pressure on mobile or constrained devices.

**Realistic failure/exploit scenario:** A low-memory mobile browser loads the public/auth application and pays for large shared CSS/JS before interacting; compiler navigation then loads additional multi-megabyte assets.

**Affected users/surfaces:** Public landing/auth, main application, standalone compiler.

**Recommended fix:** Restore effective route splitting, segment CSS by application surface, audit static/dynamic import conflicts, and set explicit runtime asset budgets.

**Fix complexity:** Large
**Regression risk:** Medium

**Suggested tests:** Enforced raw/gzip budgets, route-level bundle assertions, and mobile performance traces for first load and compiler activation.

**Remediation — 2026-10-01:** The original evidence above is retained as the baseline. Product-surface CSS was removed from the eager foundation stylesheet and attached to its owning lazy route. Public Library, Practice, Projects, Course, and Auth surfaces now cross explicit `Suspense`/dynamic-import boundaries. Referral attribution is dynamically loaded only for sign-ups that supply a referral code, removing its Firestore/user-data path from ordinary startup. No budget was raised or excluded.

**Final metrics:** Initial JavaScript is 973,487 bytes raw / 254,039 gzip (limits 1,000,000 / 260,000). Initial CSS is 30,293 bytes raw / 6,643 gzip (limits 250,000 / 40,000). All 12 required route entries are lazy; Monaco, MediaPipe vision, and Silero remain outside the initial static graph. `AuthFlow.jsx` and `CourseRoute.jsx` now satisfy the route-entry assertions. Compared with the measured remediation baseline of 999,409 bytes / 260,092 gzip JavaScript and 419,413 bytes / 64,004 gzip CSS, this removes 25,922 raw JS bytes, 6,053 gzip JS bytes, 389,120 raw CSS bytes, and 57,361 gzip CSS bytes from the initial path.

**Validation:** `validate:bundle-budgets`, production build, CSS architecture, dependency boundaries, and focused public/auth/AppShell/Home/Library/Practice/Projects/Course/standalone/compiler tests passed. The prior mixed static/dynamic import warnings no longer appear. Expected lazy runtime size warnings remain for PHP-WASM and other on-demand toolchains.

**Residual risk:** The initial JavaScript budget has approximately 6.5 KiB gzip headroom, so new eager dependencies remain a regression risk. Large compiler/editor/runtime assets are intentionally lazy and still require separate cold-activation and long-session profiling. Automated mobile visual/performance tracing remains limited by the separately documented E2E lifecycle issue.

# Low

## AUDIT-006

**Severity:** LOW
**Status:** REMEDIATED
**Area:** Test reliability
**Title:** Coin unit suite references a removed monolithic stylesheet

**Affected files:**
- `tests/coins/redeem-development-ui.test.js`

**Evidence:**
- Line 6 reads `../../src/styles.css`, which no longer exists after the stylesheet architecture refactor.
- `npm.cmd run test:coins:unit` collected 333 passing tests but failed the suite on ENOENT.

**Risk:** Financial/reward regression CI remains red or may be ignored, reducing confidence in meaningful future failures.

**Realistic failure/exploit scenario:** A real redemption regression is obscured because the suite already fails during collection.

**Affected users/surfaces:** CI and coin/redemption maintenance.

**Recommended fix:** Point the assertion at the owned stylesheet/module or replace source-text coupling with rendered behavior assertions.

**Fix complexity:** Small
**Regression risk:** Low

**Suggested tests:** Run the complete coin unit configuration with zero collection errors.

**Remediation — 2026-10-01:** The original evidence above is retained. The failure was primarily a stale test-path assumption: the monolithic `src/styles.css` was intentionally removed. Tracing also found that the route-owned bundle migration left the existing Redeem rules in `src/styles/pages/home.css` while `RedeemPage.jsx` did not load that stylesheet. The route now imports the existing rules; no coin, wallet, pricing, redemption, or theme behavior changed.

The test now reads the semantic owners (`theme.css`, `pages/home.css`, and `layout/app-shell.css`) and verifies the light `#b7791f` and dark `#facc15` coin tokens, token consumption by Redeem and AppShell coin visuals, intentional success coloring, sticky/responsive Redeem layout, and route stylesheet ownership. The complete coin suite passes 35 files / 337 tests, related theme/AppShell coverage passes 18 tests, CSS architecture validation passes, and the production build passes in 39.44 seconds.

**Residual risk:** Redeem presentation remains co-located with Home styles rather than having a dedicated stylesheet. The route import makes ownership explicit and preserves behavior, but a future semantic split may be desirable if the shared sheet grows.

## AUDIT-007

**Severity:** LOW
**Status:** CONFIRMED
**Area:** Test quality
**Title:** Existing compiler isolation tests do not cover Worker global capabilities

**Affected files:**
- `tests/batch-4/compiler-isolation.test.js`
- `tests/compiler/javascript-typescript-runtime.test.js`

**Evidence:**
- Both suites passed while the direct execution probe confirmed `globalThis.fetch` is available.
- Current assertions validate selected shadowed globals and worker lifecycle, not browser capability denial.

**Risk:** Tests provide misleading confidence in a security-sensitive boundary.

**Realistic failure/exploit scenario:** Future reviews rely on a green “compiler isolation” suite while same-origin/network capabilities remain accessible.

**Affected users/surfaces:** Compiler security assurance.

**Recommended fix:** Add adversarial real-browser capability tests and rename tests that only assert responsiveness/lifecycle isolation.

**Fix complexity:** Medium
**Regression risk:** Low

**Suggested tests:** The capability-denial matrix listed in AUDIT-001 on compiler production hosts and aliases.

# Informational

## AUDIT-008

**Severity:** INFO
**Status:** REMEDIATED
**Area:** Deployment headers
**Title:** Production configuration lacks a consolidated browser security-header policy

**Affected files:**
- `vercel.mjs`
- `vite.config.js`

**Evidence:**
- Compiler host routing sets COOP and COEP at `vercel.mjs:16-19`.
- No repository-level CSP, `X-Content-Type-Options`, `Referrer-Policy`, or frame-ancestor policy was found.
- React/HTML preview content is separately protected by `sandbox="allow-scripts"`; this finding does not claim a current preview escape.

**Risk:** Reduced defense-in-depth against future injection/content-type/referrer mistakes.

**Realistic failure/exploit scenario:** A later XSS or unsafe asset route has fewer browser-enforced containment controls than expected.

**Affected users/surfaces:** Main and compiler production hosts.

**Recommended fix:** Define host-specific, tested headers. Start CSP in report-only mode and account for Monaco/WASM/Worker requirements.

**Fix complexity:** Medium
**Regression risk:** High

**Suggested tests:** Header assertions for main, compiler custom domain, stable Vercel alias, and preview aliases; CSP report review.

**Remediation — 2026-10-01:** `config/securityHeaderPolicy.mjs` is now the canonical document, API, compiler-isolation, and local-development policy consumed by Vercel and Vite. Documents receive a narrow enforced CSP for base URI, objects, framing, and form actions plus `nosniff`, explicit referrer/permissions policies, one-year HSTS without preload/subdomain commitment, and frame denial. JSON APIs receive only the appropriate MIME/referrer/permissions/HSTS subset. Compiler hosts additionally retain COOP `same-origin`, COEP `require-corp`, and now explicit CORP `same-origin`; main-site hosts do not inherit those isolation headers. The learner JavaScript Worker retains its stricter deny-network CSP.

**Validation:** Configuration/header tests pass 37/37. Auth/routing and representative Python, JS/TS, C/C++, PHP, R, and .NET runtime contracts pass 115/116 on the first run, with the sole stale route-array assertion updated; the rerun passes. Real Chromium reports `crossOriginIsolated === true` and `SharedArrayBuffer` available with all expected local response headers. The hostile JS/TS browser matrix passes 7/7 before the previously documented Windows Playwright teardown hang. Dependency boundaries and the 43.45-second production build pass.

**Residual risk:** The enforced CSP deliberately omits broad source lists. Firebase/Google auth, Razorpay, jsDelivr Pyodide/MediaPipe, Google-hosted models, blob/module Workers, WebAssembly, and runtime evaluation make an unmeasured `default-src`/`script-src` policy high-risk. These directives should be tightened only after production CSP telemetry and full runtime acceptance. Live production/Vercel response headers and real Google popup auth still require post-deployment smoke verification.

## AUDIT-009

**Severity:** INFO
**Status:** CONFIRMED
**Area:** Test environment
**Title:** Firestore-backed compiler acceptance cannot run reliably from the generic Vitest command

**Affected files:**
- `tests/compiler/compiler-public.acceptance.test.js`
- compiler acceptance/emulator scripts

**Evidence:**
- Nine tests timed out at five seconds and the hook timed out at ten seconds in the combined focused run.
- One token operation attempted the unavailable metadata credential endpoint (`ENOTFOUND metadata`).
- Unit/contract compiler tests passed; the failure was tied to emulator/credential wiring in this shell.

**Risk:** Developers can mistake environment failures for product regressions or omit the real acceptance suite.

**Realistic failure/exploit scenario:** Security-sensitive share/quota behavior changes without the purpose-built emulator wrapper being run in CI.

**Affected users/surfaces:** Compiler Share/Feedback/quotas and CI.

**Recommended fix:** Make the acceptance suite fail fast with a clear prerequisite message, and expose one deterministic wrapper used by CI.

**Fix complexity:** Small
**Regression risk:** Low

**Suggested tests:** Clean-machine run of the wrapper, missing-emulator failure, and authenticated emulator token issuance.

## AUDIT-010

**Severity:** INFO
**Status:** HARDENING
**Area:** Python runtime isolation/lifecycle
**Title:** Pyodide auto-loads imports and reuses a warm runtime without an explicit capability/state policy

**Affected files:**
- `src/compiler/runtimes/python/python.worker.js`
- `src/compiler/runtimes/python/PythonWorkerClient.js`

**Evidence:**
- `python.worker.js:99` calls `pyodide.loadPackagesFromImports(source)`.
- The client keeps the initialized worker warm across successful executions; reset/timeout/dispose terminate it, but ordinary runs reuse it.
- Execution globals are recreated, which reduces direct variable leakage, but package/runtime filesystem/module state can persist.

**Risk:** Unexpected network transfers, memory growth, and same-session state differences between a fresh and warm compiler.

**Realistic failure/exploit scenario:** Learner imports trigger large package downloads or one run mutates runtime-level state that affects later runs in the same compiler instance.

**Affected users/surfaces:** Python standalone and embedded compiler.

**Recommended fix:** Document and enforce an allowed package/network policy, measure warm-state growth, and provide deterministic cleanup/reset semantics.

**Fix complexity:** Medium
**Regression risk:** Medium

**Suggested tests:** Fresh-versus-warm equivalence, filesystem/module-state isolation, package download allowlist, memory growth, reset, timeout, and language-switch cleanup.

### 2026-10-01 hardening follow-up

**Status:** FIXED pending deployment (focused and real-browser validation completed 2026-10-01).

**Root cause:** The runtime treated Pyodide's convenience package loader and a warm Worker as implementation details instead of product capability decisions. `loadPackagesFromImports` could initiate package transfers, while the retained VM preserved filesystem, module-cache, environment, and package state after otherwise successful runs.

**Policy and implementation:** Automatic package loading is removed; no optional package is currently allowlisted. Browser/network bridge imports and learner-visible Worker network/storage capabilities are denied. Each execution now receives a newly initialized Pyodide Worker and the Worker is terminated after success, error, timeout, cancellation, or output-limit termination. Browser HTTP caching of immutable runtime assets remains permitted and is distinct from learner-visible VM state. The full policy is recorded in `docs/security/PYODIDE_RUNTIME_POLICY.md`.

**Validation:** Focused lifecycle/policy and resource-limit tests cover disposable-worker recovery, stale execution IDs, stdin/output limits, and cancellation. Real Chromium covers clean globals, filesystem/module/environment isolation, stdin/output reset, cancellation and input-wait recovery, denied package/network/JS imports, error recovery, and subsequent successful execution.

**Residual risk:** Pyodide and a browser Worker are not a hardened hostile-code sandbox, and browsers do not expose a strict per-Worker memory quota. A fresh VM adds cold-start latency on every Run. Optional third-party packages remain unsupported until an explicit pinned allowlist is reviewed.
## 2026-10-01 compiler resource-limit remediation follow-up

**AUDIT-002 — Status: FIXED (validated 2026-10-01).** Browser execution now has shared UTF-8 byte budgets for stdout (2 MiB), stderr (1 MiB), and the standalone terminal transcript (4 MiB). Stream accounting is outside learner code in `CompilerManager`; a breach aborts the disposable runtime and returns a structured `output_limit_exceeded` or `stderr_limit_exceeded` result. JavaScript additionally enforces the limit inside its Worker producer. The transcript retains its newest portion and displays one `[Earlier terminal output truncated]` marker without changing canonical stdout/stderr. Real Chromium termination/recovery passed for JavaScript on desktop/mobile and for Python, C, PHP, R, and C#.

**AUDIT-003 — Status: FIXED (validated 2026-10-01).** `CompilerManager` now rejects source over 512 KiB and buffered stdin over 256 KiB before runtime initialization, using UTF-8 bytes. Interactive stdin is limited to 32 KiB per submission and 512 KiB cumulatively per execution. Source validation also precedes formatter initialization. Exact, below, above, Unicode, newline, cumulative-input, cleanup, and rapid same-instance replacement contracts pass. Existing stricter Share, remote Go/Rust, and MySQL limits remain unchanged.

**Additional database protection:** Browser SQLite now stops result collection after 1,000 rows. Existing server MySQL row and byte limits remain authoritative.
## Emulator determinism remediation — 2026-10-01

AUDIT-009's generic-invocation ambiguity is repaired. Compiler acceptance now requires its explicit marker, pinned `demo-compiler-public` project, and loopback Auth/Firestore hosts; it uses deterministic emulator UIDs. Five fresh wrapper invocations passed all 9 assertions each, including ID-token issuance and Share/Feedback persistence. Firestore emitted transaction-contention retry warnings during the intentional concurrent-quota test, but all runs passed. The distinct Windows outer-process lifecycle limitation remains tracked by VALIDATION-005.
