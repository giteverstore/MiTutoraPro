# Validation Environment

## Firebase emulator test contract (October 2026)

Java 21 and the repository-pinned Firebase CLI (`firebase-tools` 15.26.0) are required. No live Firebase credentials are required or permitted.

- Rules mode uses `firebase emulators:exec`, a unique `demo-*` project per suite, isolated temporary CLI state, and fresh emulator data. Run `npm run validate:content-security`, `npm run validate:certification-security`, `npm run validate:storage-security`, or `npm run test:coins:rules`. Firestore uses `127.0.0.1:8080`; Storage uses `127.0.0.1:9199`. Wrappers refuse occupied ports.
- Compiler integration uses `demo-compiler-public`: Auth `19099`, Firestore `18080`, Hub `14400`, logging `14500`; run `npm run test:compiler-public:acceptance`.
- Browser integration uses `demo-mitutora`: Auth `9099`, Firestore `8080`; run `npm run test:e2e`.

Compiler acceptance requires its marker, matching project variables, and loopback Auth/Firestore hosts, so missing wiring fails instead of reaching live Firebase. Admin SDK hosts come from `emulators:exec`; the browser build enables and connects client emulators before first use. Rules suites get a fresh process/project, compiler collections are deleted after the suite, and every Auth invocation starts fresh. The browser provisions fixed `browser-learner@example.test` credentials and obtains a new emulator token.

On Windows the E2E harness checks exclusive port ownership, probes readiness, records owned PIDs, and uses exact-PID `taskkill /T /F` cleanup. Residual limitation: assertions and port cleanup complete, but the outer Playwright PowerShell/PTY can remain open after its servers exit; coin-ledger Vitest also retained an open handle. Full deterministic closure is not claimed until clean command exit repeats.

## Authenticated Playwright ownership

- The application preview uses a per-Playwright-process port communicated through `E2E_APP_PORT`; port `4173` is not assumed.
- `scripts/start-e2e-preview.mjs` is the only application-server owner and validates the assigned port before starting Vite preview.
- Playwright starts Firebase Auth and Firestore through the Firebase CLI for project `demo-mitutora` on `9099` and `8080`.
- The login helper provisions its user only after Playwright reports both web servers ready, enters `/login`, waits for the sign-in marker, and waits for the authenticated shell before opening a protected route.
- On Windows, validate descendant cleanup explicitly. Killing an `npm.cmd` or test wrapper does not guarantee that Firebase's Node and Java descendants exit.

## Browser runtime harness

- `scripts/browser-runtime-harness.mjs` allocates an operating-system-selected loopback port, binds Vite strictly, and verifies a dedicated HTML marker over HTTP before returning.
- Runtime scripts must navigate to the dedicated probe document rather than a JavaScript source URL or the full application root.
- Assembly diagnostics capture page console errors, page errors, failed requests, worker creation/close, and named execution stages.
- In the current Windows/Vite-dev environment, fresh Assembly workers take roughly 80–90 seconds to instantiate WASM and preload the assembler. This remains an open validation performance limitation; do not treat a larger timeout as closure.

## Required closure evidence

- Auth: 10 independent start/authenticate/protected-route/stop cycles with ports free and no Node/Java descendants after every cycle.
- Assembly: minimal execution 10/10 plus the full suite, all bounded and leaving no worker/Vite process.
