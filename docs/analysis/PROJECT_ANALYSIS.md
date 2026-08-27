# MiTutoraPro Project Analysis

## Audit Methodology

This is a read-only architecture and implementation audit of the repository at commit `766a280` on branch `main`. The repository inventory contained **747 tracked/worktree files outside `node_modules` and `dist`**. The audit enumerated the full tree, mapped imports and persistence boundaries, reviewed the application, Firebase Functions, Firestore rules, content bundles, publishing scripts, validators, documentation, and production build output, and then performed targeted line-level review of security- and correctness-critical paths.

No application source, configuration, content, Firebase resource, deployment, or Git history was changed. The only additions are this report and [ISSUES.md](./ISSUES.md).

## Executive Summary

MiTutora Pro has evolved into a broad, thoughtfully separated platform: JSON-driven learning content, lazy course loading, language-neutral compiler management, browser runtimes, Practice and Projects, an event-driven exam/proctoring subsystem, and server-owned certification records. The content validators are unusually strong for a project at this stage, and the production build passes.

Remediation Batch 1 hardened the evidence boundary. Trusted completion now requires course/version-bound server sessions and type-specific evidence; verification uses an expiring attempt challenge; integrity transport has monotonic sequencing and incomplete telemetry forces review; required certification audits commit atomically with state. Browser reading, hardware observations, and client runtime execution remain explicitly limited-assurance evidence rather than being described as tamper-proof.

Remediation Batch 2 added transactionally revisioned ordinary progress, risk-specific callable request budgets, cursor-paged certification maintenance, root profile field allowlists, and server ownership for referral/achievement/statistics state. The Firestore emulator security suite passes under JDK 21. App Check support is present but enforcement remains intentionally opt-in until the supported browser provider is configured.

Remediation Batch 3 replaced Practice's eager payload fan-out with metadata pagination and on-demand detail loading, bounded and integrity-aware content caching, and failure-safe immutable publication protocols. Remediation Batch 4 adds layered render-failure containment, observable/coalesced settings persistence, per-workspace compiler routing and runtime isolation, a browser-safe pinned Pyodide worker integration, and focused Vitest/React Testing Library/Playwright coverage. The browser suite uses local Firebase emulators and built assets; it is a critical-flow baseline rather than comprehensive journey coverage.

Remediation Batch 6 establishes route/domain performance boundaries. The production entry now contains the authentication core rather than every application domain. Firebase Auth initializes independently from Firestore and Storage; authenticated data, pages, course workflows, certification/exam workflows, Monaco, vision/audio inference, and language runtimes load at their point of use. Production-manifest budgets prevent those boundaries from silently regressing.

Remediation Batch 7 establishes measured publication-time content limits and defensive browser ceilings, one accessible dialog/focus primitive, Settings-owned application theme resolution, and explicit validator naming conventions with compatibility aliases.

The other material concerns are operational scale (Practice eagerly downloads all 200 question payloads), absent version-controlled Storage rules, very large browser bundles, and limited automated coverage at React/integration/browser boundaries. Remediation Batch 2 added revision-guarded progress reconciliation, callable request budgets, paginated certification maintenance, and explicit user-data field ownership.

## Repository Architecture

### Application and navigation

- `src/App.jsx` is the application state/router coordinator.
- `src/app-shell/` owns global navigation, theme, drawer/sidebar state, notifications, and profile presentation.
- Page domains live in focused folders: `home`, `practice`, `challenges`, `bookmarks`, `certificates`, `referrals`, `settings`, `projects`, `course-overview`, and `exam`.
- AppShell/page ownership remains state-coordinated, with an incremental URL adapter for stable page, course, lesson, and Practice resources. Direct loads and browser history restore those resources without placing private exam state in URLs.

### Learning Engine

- `src/course/CourseLoader.jsx` loads course metadata/manifests, owns the current module and lesson, and exposes navigation.
- `src/course/CourseSession.js` supplies navigation-aware lazy module loading, prefetching, and eviction.
- `src/components/BlockRenderer.jsx` uses a registry to map JSON block types to reusable renderers.
- `src/progress/LearningProgressContext.jsx` derives visited/completed/sequential progress and coordinates client and trusted completion.
- Course manifests provide the complete outline; module payloads provide lazily loaded lesson blocks.

### Content infrastructure

- Firestore repositories provide published metadata.
- `src/content/services/BaseContentService.js` normalizes metadata and composes repository downloads.
- `src/content/storage/StorageContentLoader.js` downloads and parses JSON through Firebase Storage.
- `src/content/cache/ContentCache.js` deduplicates concurrent requests and caches resolved content.
- `CourseService`, `PracticeService`, and `ChallengeService` preserve domain-specific validation over the common pipeline.
- `firebase-content/` is a generated publishing/validation artifact, not a browser runtime source.

### Practice and Challenges

- Practice source selection is explicit: development may use the canonical local catalog; otherwise paged metadata is queried from Firestore and a Storage payload is loaded only when its detail is opened.
- Practice reuses BlockRenderer, Monaco, CompilerManager, runtime adapters, output validators, and completion components.
- Daily Challenges reuse the same execution foundation with independent content/service state.

### Compiler and runtimes

- `CompilerManager` is the UI-facing abstraction.
- `RuntimeRegistry` maps language and compiler-instance IDs to isolated adapters.
- Python executes in a dedicated Pyodide worker.
- Java compiles/executes through a dedicated TeaVM worker.
- Monaco is lazy-loaded and configured independently of the learning engine.
- Validators are registered separately from runtimes, preserving language and validation extensibility.
- Compiler keyboard events carry a required instance target, so concurrent panels cannot execute or cancel one another.

### Authentication and user data

- Firebase SDK access is isolated in `src/firebase` and Firestore repositories.
- `AuthRepository`/`AuthService`/`AuthProvider` expose session state to components.
- `UserDataService` coordinates authenticated Firestore-backed user data and memory caches.
- Progress uses a per-course write queue plus transactional revisions; stale cross-tab updates reconcile monotonic learning facts without replacing newer navigation. Bookmarks and settings remain user-owned. Certificates, trusted progress, referral rewards, achievements, and statistics are server-owned/read-only; the current referral presentation is explicitly non-persistent mock data.

### Certification and exams

- Browser detectors emit events; EventBus, monitoring lifecycle, integrity engine, warnings, and reports remain separated.
- Firebase callable Functions own attempts, leases, response persistence, final scoring, certificate issuance, review, and trusted course progress. Certification callables have endpoint-specific transaction-backed request budgets; App Check enforcement is deployment-configurable but not enabled until a browser provider is configured.
- Firestore rules prevent direct client writes to certification records, exam attempts, integrity reports, and trusted progress.
- Reviewer actions require custom claims (`admin` or `certificationReviewer`).
- A scheduled Function expires and finalizes pending attempts.

### Projects

- Project definitions, validation, execution, progress, export, and protected/public test separation are modular.
- ZIP export generation excludes protected tests and cleans known starter-template artifacts.

### Publishing and validation

- Course, Practice, interactive content, and certification exam publishers use Firebase Admin credentials.
- Course content uses immutable versioned paths.
- Practice publication writes metadata and 200 versioned Storage objects.
- Numerous purpose-built validators cover content counts, schemas, protected content isolation, navigation, compiler integration, exam subsystems, and certification.

## Trust boundaries

| Boundary | Authoritative side | Current enforcement |
| --- | --- | --- |
| Authentication identity | Firebase Auth / callable `request.auth.uid` | Strong; client UID is not authoritative |
| Public content publication | Firestore metadata + versioned Storage | Published filter and immutable publisher checks |
| Ordinary learner progress | Client + user-scoped Firestore | User-owned and intentionally mutable |
| Trusted course completion | Callable Function | Server-issued evidence session; server-grades quizzes and validates published exercise output contracts; reading/client execution retain explicit assurance labels |
| Exam answers and score | Server | Answers are client-submitted; scoring uses server exam definition |
| Proctoring evidence | Browser detectors | Server binds monotonic transport to attempt/session and detects gaps; detector-origin omission remains a browser trust limitation |
| Certification decision | Server | Server policy engines, reports, and issuance |
| Reviewer decision | Server + custom claims | Reviewer claim checked inside ReviewService |
| Protected project/practice tests | Build-time artifacts | Validators verify learner-facing exclusion |

## Data and loading flows

### Course

`Course page -> CourseLoader -> CourseService -> CourseContentRepository -> Firestore metadata -> StorageContentLoader -> course manifest -> CourseSession -> on-demand module -> BlockRenderer`

The outline is manifest-driven and independent of module eviction. Initial render needs one module; the next module is prefetched and the cache window defaults to three.

### Practice

`PracticePage -> PracticeService.listMetadataPage -> Firestore query(published == true, cursor, limit) -> metadata cards -> selected question -> StorageContentLoader -> Practice detail`

Development can explicitly select `src/practice/practiceData.js`. Production cannot honor the local override.

### Progress

`LearningProgressProvider -> progressRepository -> UserDataService queue/snapshot -> ProgressRepository transaction/reconciliation -> users/{uid}/progress/{courseId}`

The context derives sequential progress and may initiate saves without awaiting UI state, but persistence is serialized per user/course. Firestore revisions prevent delayed/cross-tab overwrites; stale writes retain newer resume position and merge monotonic completion evidence.

### Certification

`Lesson footer -> TrustedCompletionService -> callable -> CourseCompletionService -> manifest membership check -> trustedCourseProgress`

`Certification UI -> callable endpoints -> AttemptService -> server exam definition/scoring + received integrity events -> decision/report/certificate/review`

## Authentication & Authorization

Firebase Auth identity is centralized through AuthRepository/AuthService/AuthProvider, and callable Functions derive the authoritative UID from `request.auth.uid`. Exam attempts repeat ownership checks inside server transactions. Reviewer mutations require an `admin` or `certificationReviewer` custom claim. Trusted lesson completion additionally requires type-specific evidence. Root user documents now expose only a typed profile allowlist; referral, achievement, statistics, coin, certification, trusted-progress, and certificate trust state is client-write-denied.

## Firebase Architecture

The browser Web SDK, Admin publishers, and Functions Admin SDK are separated. Firestore rules restrict metadata publication and trust-sensitive writes. Repository-managed Storage rules deny client writes/private paths and read only `ACTIVE` versioned JSON objects; publisher object metadata supplies the Storage-side publication boundary because Storage rules cannot query Firestore. Production rule deployment and legacy-object metadata migration remain pending. Certification callables are rate-controlled; App Check remains opt-in. No production Firebase operation was performed.

## Course System

Python validates as 1 module, 10 sections, 109 lessons, 20 quizzes, and 18 exercises. Java validates as 5 modules, 34 sections, 363 lessons, 43 graded quizzes, and 57 exercises. The manifest/course-session design correctly keeps the full outline independent of lazy module content. Course-specific validators are substantially stronger than the generically named `validate:course`, which checks only an example JavaScript course.

## Practice System

The canonical bank has 200 unique Python Fundamentals questions across ten batches. The validator executes Python cases and confirms public/protected test separation; Firebase artifact parity passes. The local source override is development-only. Production renders metadata pages and loads bodies on demand, preserving prior pages when a later page or selected object fails.

## Compiler Architecture

CompilerManager, RuntimeRegistry, adapters, Monaco, output capture, and validators are genuinely separated. Python and Java execute in dedicated per-workspace workers, and cancellation terminates only the owning worker—the correct containment primitive for CPU-bound loops. Instance-scoped events prevent shortcut fan-out. Remaining risks are browser-origin capabilities, memory pressure before termination, and large assets.

## Java Runtime

TeaVM initialization/execution is isolated in `java.worker.js`; `JavaWorkerClient` applies an execution timeout and destroys the worker on abort/error. Program and method transforms remain behind the adapter. Validation covers course shape and representative behavior, not every browser, all 57 exercises, repeated memory-pressure cycles, or hostile sources.

## Python Runtime

Pyodide runs in `python.worker.js`; `PythonWorkerClient` owns request correlation, initialization/execution timeouts, abort handling, termination, and clean worker recreation. The worker imports the pinned official browser distribution rather than bundling Pyodide's Node-capable package graph, eliminating Vite's Node externalization warnings. A built-application Playwright smoke exists, but its final full-matrix Python initialization exceeded the runtime budget on the audit machine. Worker isolation limits UI impact but does not itself remove same-origin network capability.

## Progress & Trusted Completion

The client distinguishes visited, completed, and sequential progress. Same-tab writes are serialized and cross-tab writes use Firestore revisions with monotonic reconciliation. Trusted progress requires an expiring, single-use evidence session bound to user/course/version/lesson. Reading is lower-assurance protocol evidence, quizzes are server-graded, and exercise artifacts are checked against published output contracts with an explicit client-execution limitation.

## Certification

Server-side ownership, explicit states, leases, response revisions, scoring, decisions, reviewer claims, and issuance remain intact. Verification is now challenge/session bound and time-limited. Integrity transport has monotonic ranges, replay handling, gap state, and a final sequence; incomplete telemetry forces review. Required audit records are transactionally coupled to state. Browser detector truth remains client-originated, and scheduled batches still require backlog controls.

## Security

No `dangerouslySetInnerHTML` use or direct Firebase SDK imports from ordinary components were found. Protected Practice/project content is excluded by validators. The critical findings concern evidence authority, not basic UID authorization. Secret hygiene should add ignore/scanning safeguards, and Storage rules should become reviewed infrastructure.

## Data Integrity

Versioned immutable publishing, schema validators, navigation reachability, and cache request deduplication are strengths. Storage/Firestore publication cannot be atomic and may leave inactive orphan objects. Progress writes can reorder. Runtime content would benefit from per-file hashes bound into metadata.

## Performance

Course lazy loading is bounded and efficient. Practice uses bounded metadata pages and on-demand bodies. The initial application JavaScript is 352.90 kB raw / 93.33 kB gzip, down from 1,685.00 kB / 432.76 kB gzip. Route/domain chunks are loaded on demand and production-manifest budgets enforce the boundary. Monaco, lazy Firestore, and runtime/model assets remain substantial, so cold compiler, authenticated data, and proctoring starts still depend on network/device performance. Legacy generic metadata APIs remain unbounded.

## Remediation Batch 6: startup performance

`App.jsx` now declares dynamic domain entries and keeps AppShell navigation available while route content resolves. Course orchestration moved behind a single course boundary so CourseLoader, progress, lesson rendering, and compiler UI are absent from Home startup. Firebase product initialization is separated: Auth is startup-critical; Firestore and Storage load only when the existing repository/content paths request them. The change preserves service ownership and does not add a second router or compiler path.

The measured production entry changed from 1,685.00 kB minified / 432.76 kB gzip to 352.90 kB / 93.33 kB gzip. Home, Course, Practice, Projects, Certificates/exam, setup verification, Monaco, MediaPipe, and Silero are independently emitted. See [Startup Performance](../architecture/startup-performance.md) for budgets and measurement semantics.

## Remediation Batch 7: safety and ownership

## Remediation Batch 8: production hardening readiness

Local readiness now includes optional early reCAPTCHA Enterprise App Check initialization with development-only debug-token isolation, a Node.js 22 Functions target, privacy-safe fail-open structured Function telemetry, and a non-mutating content-integrity inventory. Storage rules, legacy hash/metadata migration, Functions deployment, App Check registration/enforcement, dashboards, and alerts remain explicit production rollout steps requiring approval and verification.

Content generators and publisher bundle loaders share deterministic limits derived from Java, Python, and the 200-question Practice corpus. The largest assembled course measured 626,376 bytes against an 8 MiB limit; the largest module measured 317,461 bytes against 2 MiB; the largest Practice question measured 4,248 bytes against 256 KiB. Runtime Storage downloads use type-specific Firebase Web SDK byte ceilings, while publication remains the authoritative rejection boundary.

Dialog semantics and focus lifecycle belong to one portal-backed primitive used by Settings, compiler replacement, certificates, and exam warnings. SettingsService is the sole persisted application-theme owner; one system-preference observer resolves appearance for every surface. Validator commands now distinguish validation and behavior-test entrypoints, and compatibility aliases prevent workflow breakage.

## UI/UX & Accessibility

Batch 7 routes modal semantics and focus lifecycle through one portal-backed Dialog/ConfirmDialog primitive. It provides labelling, description association, focus entry/trapping/restoration, Escape, background inerting, responsive actions, and reduced-motion behavior. Automated tests prove these mechanics but do not claim full WCAG or assistive-technology compliance. Application appearance now resolves through SettingsService and `useApplicationTheme`; Monaco editor appearance remains intentionally independent.

The implementation generally follows `SKILL.md`: spacing-led hierarchy, nearby controls, responsive sidebar/compiler modes, keyboard resize, and reduced-motion styles. Layered recovery views now preserve context, move focus to actionable feedback, and offer retry/back actions. Gaps remain in modal focus lifecycle and history/deep-link behavior. Real assistive-technology testing remains outside this audit.

## Testing

Batch 7 adds boundary/attack tests for content limits, accessible-dialog component tests, theme ownership/token checks, and validator-command inventory checks. `validate:course` now covers the example, Python, and Java courses while compatibility aliases preserve older workflows.

Purpose-built scripts cover many schemas and invariants. Vitest and React Testing Library now exercise failure containment, settings persistence, compiler isolation, and worker lifecycle. Playwright provides a built-application desktop/mobile critical-flow baseline with Auth/Firestore emulators and real Python/Java runtime smoke attempts. The final matrix was not fully green because of cold authentication and runtime timeouts, so the suite is intentionally not described as comprehensive. Certification Functions, every audited journey, broader browser coverage, accessibility automation, and CI gates remain future work.

## Dependencies & Maintenance

Runtime-heavy dependencies fit the product but require upgrade and bundle budgets. Functions pin Node 20 and Firebase Functions 6.x. Root `firebase-admin` is a tooling-only development dependency, Functions retain their runtime dependency, and automated boundary validation rejects browser imports. No CVE/license scan was run.

## Remediation Batch 5: infrastructure and navigation

Storage authorization is now version-controlled and emulator-tested, with explicit inactive/active object metadata integrated into publishers. Secret-like filenames/debug logs are ignored and tracked content is scanned without revealing values. Stable URL routing incrementally wraps the existing App coordinator. Global design tokens and primitives remain central while new domain CSS has explicit ownership; the large legacy aggregate remains a documented partial migration. The unused legacy Dashboard no longer delays synchronous content by 550 ms. Documentation now uses CURRENT/LEGACY/DEPRECATED/PLANNED status language and validates local links.

The Storage rules have not been deployed. Existing active objects must receive `publicationState=ACTIVE` before deployment. Certification/exam restoration, full CSS extraction, and semantic documentation auditing remain intentionally incomplete.

## Dead Code & Technical Debt

Legacy Dashboard/theme and local repositories coexist with AppShell and Firestore-backed services. They were not labeled dead merely for lacking a direct import because scripts/development adapters may use them, but their presence creates duplicated responsibility. The global stylesheet also has a wide regression radius.

## Production Readiness

The build and content invariants pass, but lesson-derived certification is not tamper-resistant until trusted evidence is fixed. Before larger cohorts, address Practice fan-out, progress ordering, Storage rules, callable abuse controls, error boundaries, monitoring, and scheduler backlog. No payment/billing subsystem was found, so payment security and entitlement handling could not be audited and need a separate review before monetization.

## Architectural Strengths

Keep the registry-based block/runtime design, manifest-outline/session separation, worker containment, Firebase repository layering, immutable content versions, server-owned scoring/issuance, explicit exam states, and protected-content validation. These sound decisions need localized hardening, not replacement.

## Architectural Risks

The systemic risks are confusing server ownership with server-verifiable evidence, treating client telemetry as complete, scaling catalogs with eager full loads, overlapping legacy/current sources, and relying on validators without browser integration coverage.

## Recommendations

The roadmap below prioritizes trust, data correctness, infrastructure reproducibility, and scale. Routing evolution, stylesheet modularization, legacy adapter cleanup, and documentation automation can safely wait behind those risks.

## Quality attributes

### Strengths

- Clear domain folders and reusable abstractions.
- Registry patterns for blocks and runtimes reduce switch-heavy coupling.
- Firebase SDK is largely kept outside components and domain services.
- Versioned content and immutable publication checks reduce accidental overwrite risk.
- Course lazy loading is designed around a stable manifest outline.
- Exam lifecycle transitions, leases, response revisions, and transaction use are deliberate.
- Protected content isolation has explicit validators.
- Accessibility primitives exist: semantic buttons, labels, keyboard resize, reduced-motion styles, and modal roles.
- Build and all selected validators passed.

### Constraints and debt

- `App.jsx` remains a large coordinator and substitutes state routing for URL routing.
- The global stylesheet is monolithic and contains unrelated historical page styles.
- There is no conventional unit/component/E2E test harness or CI workflow in the repository.
- Runtime-heavy packages create large assets and a large initial application chunk.
- Several legacy/local repositories remain beside Firestore-backed implementations, increasing source-of-truth ambiguity.
- Production Storage security configuration is not represented in the repository.

## Validation performed

The following completed successfully:

- `npm run validate:course`
- `npm run validate:python-course`
- `npm run validate:python-foundations`
- `npm run validate:java-course`
- `npm run validate:practice`
- `npm run validate:practice-bank`
- `npm run validate:firebase-interactive-content`
- `npm run validate:certification`
- `npm run validate:certification-trust`
- `npm run validate:trusted-completion`
- `npm run validate:exam`
- `npm run validate:secure-exam`
- `npm run build`
- `git diff --check`

The production build transformed 2,629 modules. Notable outputs were:

- main application JS: 1,648.80 kB (423.22 kB gzip)
- Monaco chunk: 2,820.32 kB (729.19 kB gzip)
- ONNX WASM: 13,479.98 kB (3,461.77 kB gzip)
- Silero model: 2,327.52 kB
- main CSS: 219.71 kB (32.98 kB gzip)

Vite reported chunk-size warnings and browser externalization warnings from the Pyodide package for Node built-ins.

## Remediation Batch 3: content delivery

Practice catalog loading is now metadata-first and cursor-paginated. Firestore returns stable pages ordered by position plus document ID; question JSON is loaded only on selection. The selected-content state is isolated from catalog state, the session cache is bounded, concurrent reads are deduplicated, and retryable body failures do not erase usable metadata pages.

Generated learner artifacts are SHA-256 bound to trusted metadata. Practice questions, course manifests, and course modules are verified before parsing/caching. Publishers upload immutable version objects, download and verify exact hashes, stage a READY record, and only then activate metadata and the version pointer. This is an activation protocol rather than cross-service ACID: failed uploads may leave inactive orphans, but an incomplete version cannot become active.

Practice source selection is explicit. Production is Firebase-only; development `local` and `firebase` selections are authoritative; implicit fallback is opt-in and defaults off.

## Current Practice production diagnostic checkpoint

Practice production content was independently verified healthy: 200 published metadata records, contiguous positions, an ACTIVE v1 pointer, and 200 ACTIVE hash-correct Storage objects. The exact browser SDK query succeeds outside the affected page, but one production browser still reaches the catalog error; `TYPE=terminate` blocking and Brave Shields are not proven causes. Stage-aware diagnostics now distinguish publication reads, metadata queries, metadata normalization, and Storage downloads without logging raw messages, URLs, identities, session data, response bodies, or content. The browser failure remains open until a failing run supplies the sanitized stage/code.

There is separate Firestore-rules drift: the checked-in rule permits an ACTIVE root publication pointer, while an independent production client read returned `permission-denied`. The nested immutable version document is intentionally outside that rule and is not read by `PracticeRepository`. This drift should be handled as its own deployment checkpoint rather than by weakening rules or changing the working catalog query.

## Prioritized roadmap

1. Make trusted lesson completion evidence server-verifiable before treating it as certification authority.
2. Explicitly model proctoring evidence as client-originated and add tamper/gap/heartbeat controls.
3. Paginate/lazy-load Practice metadata and payloads.
4. Serialize progress persistence with monotonic revision/conflict handling.
5. Add and test version-controlled Firebase Storage rules.
6. Add App Check and endpoint-specific abuse controls.
7. Establish component/integration/E2E tests and CI gates.
8. Split the initial application bundle by route/domain.
9. Add top-level error boundaries and resilient empty/error distinctions.
10. Consolidate legacy persistence and theme implementations.

## Files/Areas Inspected

The complete 747-file inventory covered root configuration and lockfiles; 319 `src` files; 51 scripts; 216 generated Firebase-content artifacts; 84 public assets/content files; 42 documentation files; 15 Functions files; schemas, rules, indexes, and tests. Risk-critical flows received line-level inspection; other areas were classified and searched for relevant imports, configuration, generated-data invariants, and risky patterns. Binary/media assets were inventoried but not manually decoded.

## Limitations

- This audit did not write to or query production Firebase, Vercel, Auth, Storage, or Firestore; conclusions concern repository implementation and generated artifacts.
- Browser behavior was not exercised with real camera, microphone, fullscreen, Monaco, Pyodide, TeaVM, or assistive technology.
- “747 files inspected” means the complete file inventory was classified and searched, while risk-critical and representative implementation paths received line-level review; generated binary/media contents were not manually decoded.
- Dependency vulnerability scanning, license scanning, secret scanning, performance profiling, and penetration testing were not run.
- Passing script validators demonstrates their encoded invariants, not full production correctness.
