# MiTutora Pro Issue Register

Severity definitions: **Critical** enables direct compromise of a primary trust objective; **High** can materially affect security, correctness, availability, or cost; **Medium** has bounded impact or requires conditions; **Low** is maintainability, coverage, or polish debt. Confidence is based on direct source evidence, not likelihood.

## Summary

| Severity | Count |
| --- | ---: |
| Critical | 1 |
| High | 8 |
| Medium | 18 |
| Low | 8 |
| Info | 0 |
| **Total** | **35** |

## Critical

### MIT-001 — Trusted course completion can be self-attested

- **Status:** RESOLVED
- **Category:** Security / certification integrity
- **Confidence:** High
- **Location:** `functions/src/certification/CourseCompletionService.js:30-57`; `functions/src/index.js:41`; `src/progress/LearningProgressContext.jsx:232-240`
- **Description:** The trusted-completion callable authenticates the user and confirms that `lessonId` occurs in the published manifest, then records it. It does not verify end-of-reading evidence, a passed quiz, or a verified exercise. `completionType` is client input and is only normalized to one of three labels.
- **Evidence:** `recordLessonCompletion()` checks `requirements.lessonIds.includes(lessonId)` and immediately adds the ID to `completedLessons`. The client calls it before updating local progress. The validator verifies identity, membership, and idempotency, not proof of completion.
- **Impact:** Any authenticated learner can enumerate manifest lesson IDs, invoke the callable for all 109 Python lessons, become certification-eligible, and bypass the educational requirements.
- **Trigger:** Call `recordTrustedLessonCompletion` repeatedly with valid course/lesson IDs.
- **Recommended fix:** Define server-verifiable completion receipts. Quizzes/exercises should submit attempts to a server-owned evaluator; reading completion needs a signed session/sequence policy or must be explicitly classified as untrusted. Record trusted completion only after validating the appropriate evidence and bind receipts to course version, lesson, user, and idempotency key.
- **Resolution:** Added server-issued, expiring, single-use lesson evidence sessions bound to authenticated UID, published course/version, lesson, and classified evidence type. Reading uses a lower-assurance observed protocol window; quizzes are graded on the server from selected option IDs; exercises require source/output artifacts that the server compares with the published compiler contract. Direct completion assertions and client `completionType` are no longer accepted.
- **Files changed:** `CourseCompletionService.js`, callable endpoints, `TrustedCompletionService.js`, LearningProgressContext, QuizBlock, CompilerPanel/CompilerBlock, CourseLoader, trusted-completion validator.
- **Tests proving the fix:** `validate:trusted-completion` covers direct assertion rejection, invalid lesson/version/user, minimum reading interval, expiry, valid quiz/exercise evidence, and replay idempotency.
- **Remaining limitations:** Reading proves protocol participation, not human attention. Exercise output is produced by a browser runtime; the server validates the submitted artifact against the published output contract but does not independently execute Python/Java. Its assurance is stored as `SERVER_VALIDATED_CLIENT_EXECUTION`, not remote-runtime attestation.

## High

### MIT-002 — Integrity reports are complete only if the client reports every event

- **Status:** RESOLVED
- **Category:** Security / exam integrity
- **Confidence:** High
- **Location:** `functions/src/certification/AttemptService.js:272-282,318-327`; `src/exam/services/ExamPersistenceCoordinator.js`
- **Description:** The server sanitizes received events and calculates penalties, but the browser is the only evidence producer. A modified client can omit blur, face, audio, fullscreen, or other adverse events while continuing heartbeats and submitting answers.
- **Evidence:** Finalization reads only `examAttempts/{id}/integrityEvents`; no server-side sequence completeness, detector attestation, signed event chain, or gap policy is enforced.
- **Impact:** Certification integrity scores can be made artificially clean without modifying server records directly.
- **Trigger:** Suppress or selectively send `saveIntegrityEvents` calls from a modified client.
- **Recommended fix:** Treat events as untrusted telemetry; require monotonic batches with hash chaining, detector/session sequence ranges, periodic signed summaries, and explicit penalties/review for missing telemetry. Document residual browser trust.
- **Resolution:** Integrity batches now carry monotonic start/end ranges, are transactionally bound to attempt owner/session/state, safely recognize replays, persist gaps, and advance an authoritative server sequence. Submission binds the final acknowledged sequence and requires a heartbeat. Finalization adds `TELEMETRY_INCOMPLETE`, forcing review instead of producing a clean result when transport completeness fails.
- **Files changed:** AttemptService, index callable mapping, ExamPersistenceCoordinator, SubmissionCoordinator, ExamProvider, ExamAttempt model, certification evidence validator.
- **Tests proving the fix:** `validate:certification-evidence` covers sequential acceptance, duplicate idempotency, wrong session, detected gaps, late-event rejection, sequence completeness, and incomplete-telemetry flags.
- **Remaining limitations:** A modified browser can still suppress a detector before it enters the sequencing pipeline or generate syntactically valid heartbeats. The model is tamper-evident for submitted telemetry transport, not tamper-proof hardware proctoring.

### MIT-003 — Environment verification is accepted from a client summary

- **Status:** RESOLVED
- **Category:** Security / exam lifecycle
- **Confidence:** High
- **Location:** `functions/src/certification/AttemptService.js:201-205`; `functions/src/index.js:33`
- **Description:** `completeExamVerification` transitions an owned attempt from `VERIFYING` to `READY` using a client-provided summary. The server does not validate independent evidence that checks actually ran or passed.
- **Evidence:** `completeVerification()` normalizes/stores the submitted summary and invokes the generic state transition.
- **Impact:** A modified client can bypass camera/audio/browser environment gating and begin a certification attempt.
- **Trigger:** Call the callable with a fabricated successful summary.
- **Recommended fix:** Bind verification to a server-issued challenge and an auditable sequence of check results; reject missing/stale/inconsistent evidence and route unverifiable sessions to review.
- **Resolution:** Beginning verification now creates an attempt-bound random session/challenge with a ten-minute expiry and atomic audit record. Completion requires the same authenticated owner, attempt state, nonce pair, and all required protocol steps; it is single-use with safe identical retry and rejects stale/conflicting sessions.
- **Files changed:** AttemptService, AuditTrail, callable mapping, certification repository/service/provider, ExamAttempt model, certification evidence validator.
- **Tests proving the fix:** `validate:certification-evidence` covers fabricated summary, wrong user, expiry, valid completion, identical reuse, conflict, and atomic audit rollback.
- **Remaining limitations:** The nonce proves continuity and completion of the expected browser protocol; it does not independently prove camera, microphone, or physical environment truth. Those measurements remain client-originated.

### MIT-004 — Practice startup downloads all published question payloads

- **Status:** RESOLVED

- **Category:** Performance / cost / availability
- **Confidence:** High
- **Location:** `src/practice/practiceContentSource.js:22-29`
- **Description:** The catalog queries all published metadata and executes `Promise.all` over every question. With 200 questions, the page requires 200 Storage reads and JSON parses before returning the catalog.
- **Evidence:** There is no page/window parameter; metadata is sorted then all payloads are downloaded.
- **Impact:** Slow first render, high mobile memory/network use, burst load, increased Storage costs, and total catalog failure if one object fails.
- **Trigger:** Open Practice against the production Firebase source.
- **Recommended fix:** Render metadata-only cards, paginate metadata, and load a question payload only on detail selection; optionally prefetch the adjacent selection and retain ContentCache deduplication.
- **Remediation:** Practice cards now render from paged Firestore metadata. Storage content is requested only for the selected question, while bounded cache entries deduplicate concurrent/session reads. Batch 3 validation proves listing performs zero body loads.

### MIT-005 — Progress writes can arrive out of order

- **Status:** RESOLVED

- **Category:** Data integrity / concurrency
- **Confidence:** High
- **Location:** `src/progress/LearningProgressContext.jsx:208-220`; progress repository/UserDataService path
- **Description:** Each state update starts a fire-and-forget async save. Saves are neither serialized nor revision-guarded, so an older slower request can overwrite a newer state.
- **Evidence:** `repository.save(...).catch(...)` is invoked inside `setProgress` without an await queue, write revision, transaction precondition, or cancellation.
- **Impact:** Rapid navigation/completion/quiz actions can lose newer progress and cause cross-device regression.
- **Trigger:** Two or more updates with variable network latency.
- **Recommended fix:** Use a per-user/course persistence queue with monotonic revisions; coalesce pending snapshots and transactionally reject stale revisions. Preserve the last successfully persisted snapshot.
- **Resolution:** UserDataService retains its per-user/course write queue and snapshot deduplication, while ProgressRepository now commits through a Firestore transaction with a monotonically increasing revision. If another tab advanced the revision, stale navigation is discarded and monotonic learning facts are reconciled instead of overwritten. Firestore rules require revision 1 on create and exactly +1 on update.
- **Files changed:** `UserDataService.js`, `ProgressRepository.js`, `progressReconciliation.js`, `firestore.rules`, Batch 2 validator.
- **Tests proving the fix:** `validate:remediation-batch-2` exercises stale writes, independent concurrent completion, retry-safe reconciliation, and preservation of newer quiz/exercise state. The Firestore emulator suite proves stale/equal revisions are rejected.
- **Remaining limitations:** Ordinary progress remains user-owned and is not certification evidence. A reset from a stale tab cannot erase progress written by a newer tab; the user must reload before issuing that destructive reset.

### MIT-006 — Firebase Storage authorization is not version-controlled

- **Status:** PARTIALLY RESOLVED

- **Category:** Security / operations
- **Confidence:** High
- **Location:** `firebase.json`; repository root (no `storage.rules`)
- **Description:** The repository contains Firestore rules but no Storage rules or Firebase Storage deployment entry.
- **Evidence:** `firebase.json` configures Functions and Firestore only; `storage.rules` is absent.
- **Impact:** Production Storage access cannot be reproduced, reviewed, or regression-tested from source. Console-side drift could expose unpublished/private objects or break content delivery.
- **Trigger:** Manual rule changes or a new environment/project.
- **Recommended fix:** Export the intended least-privilege Storage policy to `storage.rules`, reference it from `firebase.json`, add emulator tests, and deploy through reviewed infrastructure.
- **Remediation:** Repository-managed rules deny every client write and unmatched/private path, and permit reads only for active JSON artifacts in versioned course, Practice, and daily-challenge namespaces. Publishers mark uploads `INACTIVE`, verify bytes, then mark them `ACTIVE` immediately before Firestore activation. Emulator tests cover anonymous/authenticated reads, inactive versions, protected paths, traversal, create, overwrite, and activation attempts.
- **Remaining limitations:** Rules are not production-enforced until separately deployed, and existing active objects need a controlled metadata migration first. Storage rules cannot query Firestore, so a verified object activated immediately before a failed Firestore commit can be readable by a known path while remaining undiscoverable.

### MIT-007 — Callable endpoints lack application attestation and abuse controls

- **Status:** PARTIALLY RESOLVED

- **Category:** Security / cost
- **Confidence:** Medium-high
- **Location:** `functions/src/index.js`; callable Function configuration
- **Description:** Authentication and ownership are checked, but no App Check enforcement, request throttling, per-user attempt quotas, or payload-rate budget is visible.
- **Evidence:** Endpoints use the default `onCall` options and service methods enforce identity/state, not rate.
- **Impact:** Authenticated automation can generate expensive Firestore transactions, attempts, heartbeats, content reads, and integrity writes; stolen tokens are easier to abuse.
- **Trigger:** High-rate callable traffic from scripts or modified clients.
- **Recommended fix:** Enforce App Check where supported, add endpoint-specific quotas/idempotency/rate tracking, cap active attempts, and alert on anomalous traffic.
- **Resolution:** All certification callables now pass through a transaction-backed per-user/per-operation fixed-window budget. Limits distinguish reads, attempt creation, verification, heartbeats, responses, integrity batches, submission, trusted completion, and review operations. Existing attempt/session/evidence idempotency remains authoritative. Callable configuration supports App Check plus replay-token consumption when `ENFORCE_CERTIFICATION_APP_CHECK=true`, while bypassing enforcement in the emulator.
- **Files changed:** `CallableAbuseGuard.js`, Functions `index.js`, Batch 2 validator.
- **Tests proving the fix:** `validate:remediation-batch-2` proves budget exhaustion, user isolation, endpoint-specific capacity, App Check configuration, and emulator compatibility. Existing certification validators cover authentication, malformed input, leases, sequence replay, and idempotent operation IDs.
- **Remaining limitations:** App Check is deliberately not enabled by default because the browser application has no deployed App Check provider configuration. Until configured and enabled, authenticated automation is rate-limited but not application-attested. Fixed-window documents require a future TTL policy/cleanup operation; operational alerting remains MIT-035.

### MIT-008 — Initial application bundle is oversized

- **Status:** RESOLVED
- **Category:** Performance
- **Confidence:** High
- **Location:** `src/App.jsx` import graph; Vite production output
- **Description:** The main JS chunk is 1.65 MB minified (423 kB gzip), while Monaco is 2.82 MB and runtime assets are larger still. Vite emits chunk warnings.
- **Evidence:** Current `npm run build` output; 2,629 transformed modules.
- **Impact:** Slow parse/execute and interaction readiness on lower-end/mobile devices; compiler/exam dependencies risk affecting users who only visit Home.
- **Trigger:** Cold production load.
- **Recommended fix:** Route/domain-level dynamic imports, defer certification/exam/project modules, audit barrel imports, and enforce bundle budgets in CI.
- **Resolution:** Authentication remains in the startup graph, while Auth UI, AppShell, Home, Course, Practice, Challenges, Bookmarks, Certificates, Referrals, Settings, Projects, certification exam, and setup verification are dynamic entries. Firebase initialization is split by product so Auth no longer eagerly imports Firestore and Storage; Firestore-backed user synchronization loads after Auth establishes a session. The production entry fell from 1,685.00 kB / 432.76 kB gzip to 352.90 kB / 93.33 kB gzip. Monaco, MediaPipe vision, Silero/ONNX, Python, and Java remain request-driven.
- **Files changed:** `src/App.jsx`, `src/routing/CourseRoute.jsx`, `src/routing/lazyRoute.js`, Firebase product initializers, AuthRepository, UserDataLifecycle, Vite configuration, bundle-budget validator/tests, and performance architecture documentation.
- **Tests proving the fix:** `test:batch-6` rejects oversized entry assets, eager heavy runtimes, and lost route boundaries. `validate:bundle-budgets` measures the production manifest and enforces initial JS/CSS limits plus lazy Monaco, vision, Silero, and route entries.
- **Remaining limitations:** The global CSS is still 222.47 kB raw and remains tracked by MIT-030. Firestore's lazy shared chunk (529.13 kB) and Monaco (2.82 MB) still trigger Vite's per-chunk warning, but neither belongs to the initial static graph. Runtime startup latency remains network/device dependent and is not hidden by a higher warning threshold.

### MIT-009 — No application-level error boundary

- **Status:** RESOLVED
- **Category:** Resilience / UX
- **Confidence:** Medium-high
- **Location:** `src/App.jsx`, `src/main.jsx`; no `ErrorBoundary`/`componentDidCatch` implementation found
- **Description:** Async resources expose some friendly states, but an uncaught render/effect error can blank the entire SPA.
- **Evidence:** Repository search found no React error boundary.
- **Impact:** A malformed content renderer, browser API edge case, or page exception can destroy navigation and recovery.
- **Trigger:** Any uncaught render/lifecycle exception.
- **Recommended fix:** Add shell-level and high-risk domain boundaries with recovery actions, diagnostic correlation IDs, and non-sensitive reporting.
- **Resolution:** A global boundary now protects application startup, page-domain boundaries preserve AppShell navigation, and focused learning, compiler, Practice, challenge, and exam boundaries contain high-risk failures. Recovery views provide retry/back actions, focus management, accessible status semantics, and non-sensitive diagnostic IDs; stack details remain development-only.
- **Files changed:** `src/errors/ErrorBoundary.jsx`, `src/main.jsx`, `src/App.jsx`, and compiler consumers in Learning, Practice, Challenges, and block rendering.
- **Tests proving the fix:** `test:batch-4` injects render failures, verifies surrounding state remains mounted, and verifies targeted retry recovery.
- **Remaining limitations:** React error boundaries cannot catch failures in unrelated event handlers or arbitrary asynchronous callbacks; those paths retain their existing typed-error handling.

## Medium

### MIT-010 — Storage downloads have no explicit size ceiling

- **Status:** RESOLVED

- **Category:** Security / performance
- **Confidence:** High
- **Location:** `src/content/storage/StorageContentLoader.js:54-84`
- **Description:** `getBytes(ref)` is called without `maxDownloadSizeBytes`.
- **Evidence:** The injected downloader receives only the reference.
- **Impact:** A wrong or compromised metadata path can allocate an unexpectedly large object in browser memory.
- **Trigger:** Oversized Storage JSON object.
- **Recommended fix:** Set content-type-specific byte caps, validate metadata size where available, and return a typed size error.
- **Resolution:** Shared course and Practice complexity limits run in converters/generators and bundle loaders before publication. Firebase Web SDK downloads receive content-specific byte ceilings and oversize failures map to a typed content error. UTF-8 bytes, depth, strings, code, lessons, blocks, options, examples, tests, modules, manifests, and assembled courses are bounded.
- **Tests proving the fix:** `validate:content-limits` validates Python, Java, and all 200 Practice artifacts. `test:batch-7` covers exact/one-over boundaries, UTF-8 sizing, oversized structures, nesting, and pathological collections.
- **Remaining limitations:** These controls protect the repository publishing path and browser loader, not unrelated production tooling that bypasses the pipeline.

### MIT-011 — One broken Practice object fails the entire catalog

- **Status:** RESOLVED

- **Category:** Resilience
- **Confidence:** High
- **Location:** `src/practice/practiceContentSource.js:28`
- **Description:** `Promise.all` rejects on the first missing/malformed question.
- **Evidence:** No per-item settled handling or metadata-only fallback exists.
- **Impact:** One bad publication can turn 199 healthy questions into an empty/error page.
- **Trigger:** Any published metadata points to a missing or malformed JSON object.
- **Recommended fix:** Separate catalog metadata from detail loading; if bulk loading remains, use explicit partial-failure reporting without silently merging sources.
- **Remediation:** Catalog and selected-content state are independent. Metadata-page errors preserve prior pages; a failed selected object produces a retryable detail state without clearing the catalog.

### MIT-012 — Firestore list/query helpers are unbounded

- **Status:** PARTIALLY RESOLVED

- **Category:** Scale / cost
- **Confidence:** Medium-high
- **Location:** `src/repositories/firestore/BaseRepository.js`; content repository list methods
- **Description:** Generic list/query APIs do not require limits or cursors.
- **Evidence:** Catalog consumers request the full published collection.
- **Impact:** Cost and latency grow linearly as courses, Practice, bookmarks, or challenges scale.
- **Trigger:** Hundreds/thousands of records.
- **Recommended fix:** Add cursor/limit contracts to repositories and require pagination for catalog APIs.
- **Remediation:** `BaseRepository.queryPage()` now uses deterministic field/document cursors and bounded `limit + 1` reads. Practice requires this API. Older generic `list()`/`query()` consumers remain the exact follow-up, hence the partial status.

### MIT-013 — Certification audit records are not atomic with state transitions

- **Status:** RESOLVED
- **Category:** Auditability / consistency
- **Confidence:** High
- **Location:** `functions/src/certification/AttemptService.js:182-183,219-220,299-300,349`; `ReviewService.js:60-61`
- **Description:** Critical state transactions commit first; audit writes occur afterward in separate awaits.
- **Evidence:** Attempt/review methods call `audit.record()` after transactions.
- **Impact:** A transient audit failure leaves authoritative state changed without its expected audit event; retries may also produce awkward reconciliation.
- **Trigger:** Firestore/network failure between state commit and audit write.
- **Recommended fix:** Put required audit documents in the same transaction/batch as the state change, using deterministic IDs for idempotency.
- **Resolution:** AuditTrail now builds deterministic authoritative records inside caller transactions. Attempt creation, verification start/completion, start/recovery, submission, evaluation start/finalization/decision/review/certificate issuance, and review start/resolution write required audits atomically with state. Application logger calls remain diagnostic and outside transactions.
- **Files changed:** AuditTrail, AttemptService, ReviewService, certification trust/evidence validators.
- **Tests proving the fix:** `validate:certification-evidence` simulates audit-write failure and verifies state rollback; deterministic retry tests ensure no duplicate state/audit outcome. `validate:certification-trust` verifies review idempotency.
- **Remaining limitations:** Diagnostic Cloud Logging is intentionally non-transactional. Historical records created before deployment are not backfilled by this code change.

### MIT-014 — Scheduled certification processing is capped per invocation

- **Status:** RESOLVED

- **Category:** Operations / availability
- **Confidence:** High
- **Location:** `functions/src/certification/AttemptService.js` expiration/finalization queries
- **Description:** Scheduled processing uses bounded query batches (100) without an in-invocation pagination loop.
- **Evidence:** Each scheduler invocation handles one snapshot batch.
- **Impact:** Bursts above capacity create delayed expiration/finalization and temporary inconsistent UI.
- **Trigger:** More eligible attempts than one batch between scheduler runs.
- **Recommended fix:** Page until empty with runtime safeguards, or enqueue per-attempt tasks and monitor backlog age.
- **Resolution:** Expiration and finalization maintenance now traverse deterministic cursor-ordered pages, use a fixed invocation cutoff for overdue attempts, isolate individual record failures, and stop at an eight-minute runtime budget. Successfully processed records leave the eligible query; failures are retried on the next invocation. Records ordered before an active cursor are picked up by the next invocation.
- **Files changed:** `AttemptService.js`, scheduled Function result logging, Batch 2 validator.
- **Tests proving the fix:** `validate:remediation-batch-2` covers zero, sub-page, exact-page, multi-page, isolated failure, retry, and records inserted during traversal.
- **Remaining limitations:** Resumption uses the authoritative eligible query rather than a durable cursor document. A permanently failing record is retried every invocation but does not block later pages; backlog alerting remains MIT-035.

### MIT-015 — Firestore user document writes lack field validation

- **Status:** RESOLVED

- **Category:** Data integrity
- **Confidence:** High
- **Location:** `firestore.rules` `users/{uid}` create/update rules
- **Description:** An owner can create/update the entire root user document without allowed-key/type/immutable-field checks.
- **Evidence:** Rule is ownership-only.
- **Impact:** Accidental clients can corrupt profile shape; future privileged fields added to the same document could become escalation hazards.
- **Trigger:** Malformed or malicious client write.
- **Recommended fix:** Define allowed keys, field types, immutable identity fields, and keep privileged data in server-only documents.
- **Resolution:** Root user creation now has an explicit allowed-key/type contract tied to authenticated UID and available Auth email claims. Client updates may change only display name, avatar, learning preferences, and last-login metadata. Identity, provider, verification, creation, role, certification, progress, referral, achievement, statistics, and security fields cannot be introduced or changed on the root document.
- **Files changed:** `firestore.rules`, Firestore emulator security tests.
- **Tests proving the fix:** The emulator suite proves valid profile create/update, cross-user rejection, role escalation rejection, immutable identity rejection, and certification-field rejection.
- **Remaining limitations:** `lastLogin` remains client-written operational metadata and must not be used for authorization. Admin SDK writes bypass rules by design and remain responsible for validation.

### MIT-016 — Achievements/statistics/referrals are client-writable

- **Status:** RESOLVED

- **Category:** Trust model
- **Confidence:** High
- **Location:** `firestore.rules` user subcollection matches
- **Description:** Ownership rules allow users to write achievement/statistics/referral records.
- **Evidence:** These paths use owner read/write rules while certificates/trusted progress are correctly read-only.
- **Impact:** These values cannot safely back rewards, rankings, referral payouts, or trust claims.
- **Trigger:** Direct SDK write by an authenticated owner.
- **Recommended fix:** Explicitly classify them as cosmetic/untrusted or make reward-bearing fields server-owned with callable validation.
- **Resolution:** Referral, achievement, and statistics subcollections are owner-readable but client-write-denied, matching coins, certifications, trusted progress, and certificates. The current referral screen is explicitly mock/cosmetic and no longer seeds or resets Firestore data; it remains functional with in-memory mock presentation. No reward-bearing server operation was invented because the product does not yet implement one.
- **Files changed:** `firestore.rules`, `ReferralService.js`, Firestore emulator security tests.
- **Tests proving the fix:** The emulator suite attempts arbitrary referral counts/coins, achievements/points, statistics/streaks, coin transactions, and certificates and verifies every client write is denied.
- **Remaining limitations:** Achievements, referral attribution/rewards, and authoritative statistics do not yet have product event processors. Future reward functionality must use idempotent server transactions rather than reopening client writes.

### MIT-017 — Modal focus management is incomplete

- **Status:** RESOLVED

- **Category:** Accessibility
- **Confidence:** High
- **Location:** `src/certificates/CertificateViewer.jsx:14-27`; `src/exam/components/WarningDialog/WarningDialog.jsx`
- **Description:** Modal roles and Escape handling exist, but no focus trap, initial focus, background inerting, or focus restoration is visible.
- **Evidence:** Certificate viewer installs only a global Escape listener.
- **Impact:** Keyboard and screen-reader users can navigate behind a modal or lose their prior position.
- **Trigger:** Open certificate viewer or warning dialog without a pointer.
- **Recommended fix:** Implement a reusable accessible dialog primitive with focus lifecycle and interruption-safe close behavior.
- **Resolution:** A shared Dialog/ConfirmDialog owns labelling, descriptions, initial focus, trapping, Escape, focus restoration, background inerting, topmost-dialog keyboard ownership, responsive actions, and reduced-motion behavior. Settings, compiler replacement, certificate preview, and exam warnings use it.
- **Tests proving the fix:** Batch 7 component tests cover roles/names/descriptions, focus entry and cycling, Escape, cancel/confirm, destructive presentation, and trigger restoration.
- **Remaining limitations:** Automated tests do not establish complete WCAG or real assistive-technology compliance.

### MIT-018 — Multiple independent theme stores can diverge

- **Status:** RESOLVED

- **Category:** Architecture / UX consistency
- **Confidence:** High
- **Location:** `src/app-shell/AppShell.jsx`; `src/components/Layout.jsx`; `src/dashboard/Dashboard.jsx`; `src/course-overview/CourseOverview.jsx`
- **Description:** AppShell/settings theme state coexists with direct `localStorage` theme state in older screens/layouts.
- **Evidence:** Multiple components initialize and persist `mi-tutora:theme` independently.
- **Impact:** Theme changes can desynchronize across page transitions and bypass Firestore-backed preferences.
- **Trigger:** Change theme in one surface, then enter another independently initialized surface.
- **Recommended fix:** Make the appearance service/context the sole source; remove legacy writers after migration tests.
- **Resolution:** SettingsService is the sole persisted appearance owner. `useApplicationTheme` centrally observes system preference and resolves light/dark/system for AppShell, Learning, Course Overview, Dashboard, and exam surfaces. Legacy theme localStorage writers were removed; semantic tokens remain authoritative.
- **Tests proving the fix:** Batch 7 verifies mode resolution, critical light/dark tokens, and absence of legacy writers. Batch 4 continues to cover settings persistence, reload, failure, and retry.
- **Remaining limitations:** Monaco's editor theme and legitimate code/status colors remain intentionally domain-specific.

### MIT-019 — Legacy local repositories obscure persistence authority

- **Category:** Maintainability / data consistency
- **Confidence:** High
- **Location:** `src/progress/localProgressRepository.js`, `src/bookmarks/localBookmarkRepository.js`, `src/certificates/localCertificateRepository.js`, `src/auth/localUserRepository.js`
- **Description:** Local implementations remain alongside Firestore adapters after migration.
- **Evidence:** Twenty-five localStorage usages remain, spanning both UI preferences and domain repositories.
- **Impact:** Future contributors can accidentally reintroduce dual writes or select the wrong repository; logout/cache semantics become harder to reason about.
- **Trigger:** New feature imports a legacy default or test implementation in production.
- **Recommended fix:** Clearly mark test/legacy adapters, move them under explicit development/testing folders, and document the production binding.

### MIT-020 — Settings writes are invoked without awaiting failure

- **Status:** RESOLVED
- **Category:** Correctness / UX feedback
- **Confidence:** Medium-high
- **Location:** `src/settings/SettingsPage.jsx:52,111-147`; `src/settings/SettingsService.js`
- **Description:** Controls call `settingsService.setSetting` synchronously from handlers without an observed async success/error state.
- **Evidence:** UI helper returns the service call but event handlers do not await or display persistence failures.
- **Impact:** Controls can appear saved while Firestore persistence failed, especially offline.
- **Trigger:** Firestore/network error during a setting change.
- **Recommended fix:** Add optimistic state with rollback/error status, or queue settings writes and expose synchronization state.
- **Resolution:** Settings persistence is serialized and coalesced around immutable snapshots. The service exposes `IDLE`, `SAVING`, `SAVED`, and `ERROR`, retains the last failed snapshot, and supports explicit retry. The Settings page displays quiet live feedback without blocking editing; user changes reset the persistence lifecycle so status cannot leak between sessions.
- **Files changed:** `src/settings/SettingsService.js`, `src/settings/useSettings.js`, `src/settings/SettingsPage.jsx`, `src/app-shell/AppShell.jsx`, `src/styles.css`.
- **Tests proving the fix:** `test:batch-4` covers success, failure, retry, rapid-write coalescing, and reload restoration. The built-browser suite covers Firestore-emulator save feedback and reload persistence.

### MIT-021 — Compiler global run event can address multiple mounted panels

- **Status:** RESOLVED
- **Category:** Interaction correctness
- **Confidence:** Medium
- **Location:** `src/components/CompilerPanel.jsx:213-219`; `src/hooks/useKeyboardShortcuts.js`
- **Description:** Each mounted CompilerPanel subscribes to the same window event.
- **Evidence:** Listener has no panel/workspace identifier or focus ownership check.
- **Impact:** If responsive transitions or hidden workspaces leave more than one panel mounted, one shortcut can execute multiple runtimes.
- **Trigger:** Multiple CompilerPanel instances in the DOM when the global run event fires.
- **Recommended fix:** Route shortcuts through focused workspace context or include a target panel ID.
- **Resolution:** Every compiler panel has a stable instance ID. Run events carry and require that target, Monaco emits to its owning instance, and each language/runtime pair is isolated per instance. Cancellation or reset in one workspace can no longer terminate or overwrite another workspace's runtime/output.
- **Files changed:** `src/compiler/core/compilerEvents.js`, `CompilerManager.js`, `RuntimeRegistry.js`, `CompilerPanel.jsx`, `EditorPlaceholder.jsx`, `MonacoCodeEditor.jsx`, and compiler consumers.
- **Tests proving the fix:** `test:batch-4` covers targeted shortcuts, simultaneous instances, different languages, and cancellation of one instance while another completes.

### MIT-022 — Pyodide packaging emits browser externalization warnings

- **Status:** PARTIALLY RESOLVED
- **Category:** Build / runtime compatibility
- **Confidence:** High
- **Location:** Pyodide import graph; Vite build output
- **Description:** Vite externalizes Node built-ins imported by `pyodide.mjs`.
- **Evidence:** Build warnings list `node:url`, `fs`, `vm`, `path`, `crypto`, and `child_process`.
- **Impact:** Currently selected browser branches build, but package upgrades or a different code path can fail at runtime without a dedicated production smoke test.
- **Trigger:** Pyodide/Vite upgrade or invocation of a Node-dependent branch.
- **Recommended fix:** Follow Pyodide's browser entry guidance, pin/test the supported integration, and add a built-artifact Python execution smoke test.
- **Resolution:** The Python worker now loads the pinned official browser distribution from the configured Pyodide CDN instead of bundling the npm module's Node-capable graph. Initialization and execution have explicit timeouts; abort/timeout terminates the worker and a later request recreates it. Vite no longer emits Node built-in externalization warnings.
- **Files changed:** `src/compiler/runtimes/python/pythonRuntimeConfig.js`, `python.worker.js`, `PythonWorkerClient.js`, `PythonRuntime.js`, `vite.config.js`.
- **Tests proving the fix:** `test:batch-4` covers initialization, stdin payload, stdout/stderr, timeout, cancellation, and worker recreation. The production build proves the Node externalization warnings are gone.
- **Remaining limitations:** The full Playwright run on the audit machine reached the real compiler UI but Python initialization exceeded its runtime budget, so stable built-browser execution is not yet demonstrated by the final matrix. Pyodide remains a large network dependency and the build continues to report general chunk-size warnings tracked by MIT-008.

### MIT-023 — Content metadata/runtime consistency checks are incomplete

- **Status:** PARTIALLY RESOLVED

- **Category:** Content integrity
- **Confidence:** Medium
- **Location:** `src/content/services/CourseService.js`; course manifest validation/publish scripts
- **Description:** Publisher validators enforce rich counts, but runtime checks do not cryptographically bind every downloaded module and all aggregate counts to metadata.
- **Evidence:** Runtime primarily validates IDs, version/path structure, module files, and basic shapes; there is no signed/hash manifest verification in the browser pipeline.
- **Impact:** A partially replaced Storage object can be syntactically valid yet differ from the publication metadata until a domain validator is run externally.
- **Trigger:** Out-of-band Storage mutation or incomplete publication.
- **Recommended fix:** Publish per-file SHA-256 and aggregate manifest hash in metadata; verify after download before caching.
- **Remediation:** Generated Practice metadata and course publication metadata bind exact delivered bytes with SHA-256. Browser and publisher verification are tested. Already-published legacy versions remain readable without hashes until republished, so production migration is still outstanding.

### MIT-024 — Development fallback can hide Firebase integration defects

- **Status:** RESOLVED

- **Category:** Developer experience / reliability
- **Confidence:** High
- **Location:** `src/practice/practiceContentSource.js:5-12,30-33`; `.env.example`
- **Description:** In development, local Practice fallback is enabled unless explicitly set to `false`.
- **Evidence:** `VITE_ENABLE_LOCAL_PRACTICE_FALLBACK !== 'false'` under `import.meta.env.DEV`.
- **Impact:** Local QA may pass against canonical data while Firestore queries, Storage rules, paths, or publication are broken.
- **Trigger:** Any Firebase error in a normal development environment.
- **Recommended fix:** Default fallback off for integration profiles, show a persistent source badge, and run CI against both explicit local and Firebase emulator sources.
- **Remediation:** Fallback defaults off. Explicit `local` never contacts Firebase, explicit `firebase` surfaces Firebase errors, and production always resolves to Firebase.

## Low

### MIT-025 — `validate:course` name overstates its scope

- **Status:** RESOLVED

- **Category:** Test clarity
- **Confidence:** High
- **Location:** `scripts/validate-course-schema.mjs`; `package.json`
- **Description:** The generic command reports only `javascript-foundations`; real Python and Java courses require separate commands.
- **Evidence:** Audit run output: `Valid course: javascript-foundations`.
- **Impact:** Release operators may believe all courses were schema-validated.
- **Trigger:** Running only the apparently comprehensive command.
- **Recommended fix:** Rename it to `validate:course-example` or make `validate:course` orchestrate every registered course validator.
- **Resolution:** `validate:course` now orchestrates example, Python, and Java validation; `validate:course-example` preserves the former scope. Navigation has a canonical validator entrypoint and a compatibility alias. A convention validator rejects missing/mismatched entries.
- **Tests proving the fix:** `validate:script-conventions` inventories 51 commands; Batch 7 runs canonical and compatibility paths.
- **Remaining limitations:** Compatibility aliases intentionally preserve limited naming overlap during migration.

### MIT-026 — No conventional test runner or browser E2E suite

- **Status:** PARTIALLY RESOLVED
- **Category:** Quality engineering
- **Confidence:** High
- **Location:** `package.json`; repository tree
- **Description:** Validation is script-based; there is no `test` script, React component runner, browser automation suite, or visible CI workflow.
- **Evidence:** Package scripts contain validators/build only; `tests` contains the Firestore rules test.
- **Impact:** Regressions in focus, responsive state, routing, async races, and real runtime assets can escape static validators.
- **Trigger:** Refactors that preserve strings/shapes but break behavior.
- **Recommended fix:** Add focused unit tests for engines, React Testing Library for providers, Playwright for critical flows, and CI gates.
- **Remediation:** Vitest, React Testing Library, jest-dom, and Playwright are configured. Batch 4 adds focused boundary, settings, compiler-isolation, and Python-worker tests plus built-application journeys for authenticated AppShell/Home, course overview/learning navigation, Practice pagination/detail, settings persistence, and Python/Java runtime smoke attempts. Authentication and Firestore use local Firebase emulators; no production resources are used.
- **Files changed:** `vite.config.js`, `playwright.config.js`, `scripts/start-e2e-preview.mjs`, `tests/setup.js`, `tests/batch-4/*`, `tests/e2e/core-flows.spec.js`, `firebase.json`, Firebase emulator wiring, and package scripts/dependencies.
- **Remaining limitations:** This is a focused critical-flow suite, not exhaustive coverage of every one of the 21 audited journeys, certification Functions, all browsers, accessibility tooling, or failure injection. The final full matrix had four passes and four failures: one cold authentication timeout, Python/Java runtime timeouts, and a mobile Settings locator issue corrected afterward. CI orchestration is not added in this batch.

### MIT-027 — Git ignore rules do not explicitly cover credential JSON/debug logs

- **Status:** RESOLVED

- **Category:** Secret hygiene
- **Confidence:** High
- **Location:** `.gitignore`
- **Description:** `.env` and `*.local` are ignored, but service-account filename patterns and `firebase-debug.log*` are not.
- **Evidence:** Current ignore file has five short entries.
- **Impact:** A credential copied into the workspace or Firebase CLI debug log could be accidentally staged.
- **Trigger:** Run Admin/CLI workflows from the repository and use broad `git add`.
- **Recommended fix:** Ignore Firebase debug logs and known service-account patterns; add secret scanning/pre-commit checks. Continue storing credentials outside the repo.
- **Remediation:** Precise Firebase/debug/service-account patterns are ignored while `.env.example` remains trackable. `validate:secret-hygiene` checks tracked filenames and likely credential/private-key structures without printing secrets.

### MIT-028 — Firebase Admin SDK is a root production dependency

- **Status:** RESOLVED

- **Category:** Dependency hygiene
- **Confidence:** High
- **Location:** `package.json:52`
- **Description:** `firebase-admin` is used by Node publishers but is declared in browser application dependencies.
- **Evidence:** Browser source uses Firebase Web SDK; Admin imports are in scripts/Functions.
- **Impact:** Larger install/attack surface and increased chance of accidental client import.
- **Trigger:** Dependency install or careless shared import.
- **Recommended fix:** Move Admin tooling to devDependencies or a scripts workspace; keep Functions dependencies in `functions/package.json`.
- **Remediation:** Root `firebase-admin` is now a development dependency for Node publishers; Functions retain their runtime dependency. `validate:dependency-boundaries` rejects Admin imports from browser `src/`.

### MIT-029 — App state routing limits deep links and browser history

- **Status:** PARTIALLY RESOLVED

- **Category:** UX / architecture
- **Confidence:** High
- **Location:** `src/App.jsx`
- **Description:** Major screens are selected through application state rather than URL routes.
- **Evidence:** No routing library/declarative route table exists.
- **Impact:** Refresh/back/forward/share links are less predictable, especially for course lessons, Practice questions, certificates, and reviews.
- **Trigger:** Refresh or share a nested screen.
- **Recommended fix:** Introduce URL-state adapters incrementally while preserving page components and service boundaries.
- **Remediation:** A URL adapter supports AppShell pages, course overview/lesson, and Practice catalog/question URLs with validated stable IDs, direct-load initialization, history writes, `popstate`, and invalid-route recovery. Existing page/service ownership is unchanged.
- **Remaining limitations:** Certification/exam sessions remain intentionally state-only so private/transient evidence is not serialized. Full built-browser refresh/back/forward coverage remains part of the partial MIT-026 matrix.

### MIT-030 — Monolithic stylesheet increases regression radius

- **Status:** PARTIALLY RESOLVED

- **Category:** Maintainability
- **Confidence:** High
- **Location:** `src/styles.css`
- **Description:** Global CSS contains shell, learning, compiler, Practice, projects, settings, certificates, referrals, and exam styles.
- **Evidence:** Thousands of lines and broad global selectors share one cascade.
- **Impact:** UI changes can unexpectedly affect unrelated domains; dead styles are hard to identify.
- **Trigger:** Selector/token changes in the global sheet.
- **Recommended fix:** Retain design tokens globally but colocate domain styles or use cascade layers with ownership conventions.
- **Remediation:** Token, primitive, and coherence ownership is documented; new domain sheets live under `src/styles` with domain prefixes, beginning with routing recovery styles.
- **Remaining limitations:** The legacy `styles.css` still contains most domain styles. A bulk move was avoided because cascade changes would be higher risk without a fully green browser matrix.

### MIT-031 — Artificial dashboard skeleton delay adds avoidable latency

- **Status:** RESOLVED

- **Category:** UX
- **Confidence:** High
- **Location:** `src/dashboard/Dashboard.jsx:38-40`
- **Description:** A fixed 550 ms timer displays loading state independent of actual data readiness.
- **Evidence:** `setTimeout(() => setIsLoading(false), 550)`.
- **Impact:** Fast local/static content is deliberately delayed and automated tests become timer-dependent.
- **Trigger:** Open the legacy dashboard.
- **Recommended fix:** Bind skeletons to real resource state or remove the delay for synchronous mock content.
- **Remediation:** The legacy Dashboard is not imported by the active AppShell/Home path and uses synchronous mock data. Its artificial state and fixed 550 ms timer were removed; genuine asynchronous pages retain resource-driven loading states.

### MIT-032 — Documentation and implementation can drift across overlapping architecture eras

- **Status:** PARTIALLY RESOLVED

- **Category:** Documentation / maintainability
- **Confidence:** Medium-high
- **Location:** `docs/architecture`, legacy Dashboard/local repositories, current AppShell/UserDataService implementations
- **Description:** Documentation is extensive, but older components and repositories remain alongside current architecture, and no automated documentation-link/architecture conformance test exists.
- **Evidence:** Both legacy and current implementations are present; docs describe target ownership more cleanly than the tree enforces.
- **Impact:** Contributors can follow obsolete paths or duplicate state ownership.
- **Trigger:** Extending a domain by searching for similarly named services/components.
- **Recommended fix:** Add status headers to architecture docs, a generated system index, dead-code/import audits, and deprecation markers for superseded modules.
- **Remediation:** A CURRENT/LEGACY/DEPRECATED/PLANNED convention is documented, the index links routing/Storage/style ownership documents, and `validate:documentation` checks tracked local Markdown links.
- **Remaining limitations:** Status headers are not backfilled into every historical document; semantic ownership and diagram accuracy still require human review.

## Additional medium findings

### MIT-033 — Functions runtime lifecycle migration is pending

- **Status:** PARTIALLY RESOLVED

- **Category:** Dependencies / operations
- **Confidence:** High
- **Location:** `functions/package.json` (`engines.node = 20`, `firebase-functions = ^6.4.0`)
- **Description:** The Functions foundation is tied to Node 20 and Firebase Functions 6.x; lifecycle/outdated-package warnings have already been observed during project operations.
- **Evidence:** Runtime and package versions are explicitly pinned in the Functions package.
- **Impact:** Delayed migration can turn planned compatibility work into a deployment blocker or unsupported-runtime incident.
- **Trigger:** Platform runtime retirement or a required Firebase tooling upgrade.
- **Recommended fix:** Schedule a dedicated migration with emulator/security/callable tests and a canary deployment; do not combine it with feature work.
- **Remediation:** Repository runtime and lockfile metadata now target supported Node.js 22 without changing exports or business logic. Production remains on its deployed runtime pending explicit deployment approval and read-back verification.

### MIT-034 — Content publication is not atomic across Storage and Firestore

- **Status:** RESOLVED

- **Category:** Publishing / data integrity
- **Confidence:** High
- **Location:** `scripts/publishing/FirebasePracticePublisher.mjs:29-68`; `scripts/publishing/FirebaseCoursePublisher.mjs`
- **Description:** Publishers upload/verify Storage and separately commit Firestore metadata; the services cannot share a transaction.
- **Evidence:** Storage operations and Firestore batch commits are separate awaits.
- **Impact:** Mid-publication failure can leave orphan version objects, and future ordering regressions could activate incomplete content.
- **Trigger:** Network, permission, quota, or process failure during publication.
- **Recommended fix:** Keep metadata activation last, stage inactive versions, verify hashes, and provide orphan inventory/rollback tooling.
- **Remediation:** Both publishers use immutable paths and upload → hash verification → READY → activation. Active metadata/pointers are committed only after verification. Failure injection proves incomplete versions cannot become active. Storage and Firestore are not claimed to be ACID; inactive orphan objects can remain safely after interruption.

### MIT-035 — Production observability is not defined in repository architecture

- **Status:** PARTIALLY RESOLVED

- **Category:** Operations
- **Confidence:** Medium-high
- **Location:** Functions logger calls; client console error sites; deployment/architecture documentation
- **Description:** Structured Function logs exist, but no client error reporting, alert policy, SLO, trace convention, or operational dashboard configuration is represented.
- **Evidence:** Client failures primarily reach console output; no version-controlled alert/runbook definitions cover content, callables, scheduler backlog, or certification anomalies.
- **Impact:** Browser failures and rising backend errors may depend on user reports and be slow to diagnose.
- **Trigger:** Client exception, content outage, callable error spike, or scheduler backlog.
- **Recommended fix:** Add privacy-safe telemetry, correlation IDs, redaction rules, SLOs, alerts, and runbooks.
- **Remediation:** A fail-open structured Functions logger now supplies stable event/severity/component/environment fields and strips prohibited sensitive fields. Callable rejection and scheduler events use it. Production client reporting, dashboards, alert policies, and deployed-log verification remain pending.

### Practice production loading remains browser-specific after publication verification

- **Status:** OPEN — DIAGNOSTICS ADDED
- **Category:** Reliability / observability
- **Evidence:** The production publication has 200 published, contiguous metadata documents and 200 ACTIVE, hash-correct Storage objects. The exact Firebase Web SDK metadata query returns the expected 25 records independently, and a representative question read succeeds. Brave Shields being disabled did not resolve the affected browser. A blocked `TYPE=terminate` WebChannel cleanup request is therefore not established as causal.
- **Current boundary:** The affected browser still reaches the generic Practice catalog error. The exact exception is not yet captured.
- **Remediation in worktree:** Practice now records sanitized `publication-read`, `metadata-query`, `metadata-normalization`, and `storage-download` diagnostics while preserving original exceptions, UI copy, retries, and Firebase-only production behavior.
- **Separate rules drift:** The root ACTIVE publication pointer is allowed by checked-in rules but returned `permission-denied` in the independent production client probe. The nested version record remains intentionally unreadable to clients and is not used by the current browser loader. Rule deployment drift should be reconciled separately; it is not proven to cause the catalog failure because the pointer denial is nonfatal and the exact fallback metadata query succeeds.

## INFO

No standalone INFO issues were added; non-defect observations are kept in the project analysis so the register remains actionable.

## Top ten priorities

1. MIT-001 — trusted completion bypass. **Resolved in Remediation Batch 1.**
2. MIT-002 — omittable client integrity evidence. **Resolved with documented browser-origin limitation.**
3. MIT-003 — client-attested environment verification. **Resolved with documented hardware-attestation limitation.**
4. MIT-005 — out-of-order progress writes. **Resolved in Remediation Batch 2.**
5. MIT-006 — missing version-controlled Storage rules.
6. MIT-004 — 200 eager Practice downloads.
7. MIT-007 — callable abuse controls. **Partially resolved; rate controls are active in code, App Check awaits provider configuration.**
8. MIT-009 — no top-level error boundary. **Resolved in Remediation Batch 4.**
9. MIT-008 — oversized initial bundle. **Resolved in Remediation Batch 6 with measured route/runtime boundaries and enforced budgets.**
10. MIT-013 — non-atomic certification audit trail. **Resolved in Remediation Batch 1.**

## What should be fixed immediately

- **Completed trust remediation:** MIT-001, MIT-002, MIT-003, and MIT-013 now enforce evidence sessions, sequence completeness, verification challenges, and atomic authoritative audits. The documented browser-origin limitations still apply.
- **Before a larger production cohort:** MIT-004, MIT-006, and completion of MIT-007 App Check rollout.
- **Completed Batch 2 remediation:** MIT-005, MIT-014, MIT-015, and MIT-016. The Batch 1/2 Firestore emulator security suite now passes with JDK 21; MIT-007 remains partial until browser App Check is configured and enforcement enabled.
- **Batch 4 remediation:** MIT-009, MIT-020, and MIT-021 are resolved. MIT-022 is partial: packaging warnings are fixed and worker lifecycle tests pass, but the final built-browser runtime smoke timed out. MIT-026 remains partial until the wider journey matrix, stable runtime smoke, and CI gates are implemented. MIT-025 was resolved in Batch 7.
