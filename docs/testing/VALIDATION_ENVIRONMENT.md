# Validation environment

Use a current Node release compatible with the lockfile (the October 2026 repair was validated on Node 25.9.0). Java 21 is required for Firestore emulator suites. Playwright Chromium must be installed for browser-runtime and authenticated E2E validation.

Authenticated E2E is self-contained: Playwright starts Auth and Firestore emulators for project `demo-mitutora`, creates its test user through the Auth emulator, builds the application with `VITE_FIREBASE_USE_EMULATORS=true`, and owns its preview server. It must not reuse an externally running emulator or preview because that can mix Firebase projects or production configuration. Firebase CLI state is written beneath `.tmp-firebase-config/`; no live credentials are required.

Rules validation is self-contained through `scripts/run-firebase-rules-test.mjs`: fixed suite-specific `demo-*` projects, temporary CLI state, and explicit port-ownership checks. Compiler acceptance uses `demo-compiler-public` and fails closed unless loopback Auth/Firestore variables and its acceptance marker are present. See `docs/audits/validation-environment.md` for the project/port matrix and residual Windows outer-process limitation.

Live-provider authentication is outside the default local E2E contract. Tests requiring it must use environment-provided credentials and report `SKIPPED — live provider credentials not configured` when absent. Never store passwords, tokens, cookies, service-account JSON, or browser storage snapshots in the repository.

Browser runtime scripts allocate an ephemeral Vite port, wait for `server.listen()` and a resolved URL, and close browser and server in `finally`. Vite dependency discovery is disabled for these isolated source-module harnesses so dependency rescans cannot restart the server during execution. A failed run should retain bounded browser console/page errors through its script or Playwright trace.
