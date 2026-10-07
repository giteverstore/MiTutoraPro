# Phase 7.5: canonical Project acceptance

## Acceptance fixture

`tests/content-contracts/fixtures.js` defines `phase-7-task-progression-fixture`, a test-only canonical Project with Python and JavaScript starter workspaces, two ordered checkpoints, four tasks, language-specific guide code, and trusted `source_pattern`, `execution_succeeds`, and `output_contains` descriptors. It is not imported by the production catalog and is not a production content definition.

The content-contract acceptance test sends the fixture through the real draft, validation, immutable artifact, SHA-256, READY, ACTIVE, second-version, and archive services. `PublishedContentRepository` then consumes the resulting public delivery contract. This proves ACTIVE discovery, exact-version resume, v1 pinning after v2 activation, and archived discovery behavior without inserting a learner-shaped object directly.

## Browser catalog and runtime strategy

The Playwright build runs in Vite's explicit `e2e` mode. In that mode only, the browser fixture injects:

- a public-delivery fetch adapter at `PublishedContentRepository`'s existing fetch boundary;
- a deterministic execution adapter at `TrustedDescriptorExecutor`'s existing compiler boundary.

The adapters return the production-shaped public document and execution-result contracts. They do not replace progression, persistence, trusted descriptor evaluation, task locking, checkpoint validation, or final validation. `import.meta.env.MODE === 'e2e'` is compile-time folded; normal production builds contain neither hook identifier.

The deterministic executor avoids loading Pyodide or other large compiler assets for every progression assertion. A separate focused compiler smoke remains responsible for the real runtime boundary.

## Covered browser flow

The canonical browser specification covers discovery, language selection, starter workspace, v1 pinning, task success, a failed task followed by repair, cumulative checkpoint regression failure, checkpoint repair, reload/resume, v2 activation while the existing learner remains on v1, second-checkpoint completion, final failure and repair, completion, and completion reload. A second learner starts the active v2 JavaScript workspace and verifies that Python files and guide variants do not leak.

Cloud optimistic-concurrency behavior remains covered independently by the authenticated Projects persistence suite. Artifact absence, hash mismatch, archive retention, and exact pinned-version behavior are covered at the publication/repository integration layer, where failures are deterministic and can assert that no untrusted JSON is rendered.

## Timeout investigation

The earlier browser failures combined real cold compiler startup with stale assertions from the pre-task UI. Runs waited for output or navigation that the task workflow no longer produces, and C++ cold initialization could keep a single assertion alive for minutes. Raising every timeout would hide that mismatch. Phase 7.5 therefore uses a deterministic E2E executor for progression coverage and keeps real compiler validation separate. The browser progression path should complete in seconds after the shared Vite/Firestore startup.

## Limits

- Browser acceptance does not claim server-authoritative grading; trusted validators still execute in the learner client.
- The fixture is synthetic and intentionally has no networking, random behavior, or filesystem complexity.
- Published-content browser injection is test-only; production discovery uses `/api/admin-content/public`.
- Existing pinned learners can resume archived immutable artifacts; archived content is omitted from new discovery.
