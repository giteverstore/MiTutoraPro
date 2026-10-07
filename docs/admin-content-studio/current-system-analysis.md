# Current system analysis

## Application and deployment

The learner application is React 18 on Vite 6. `src/main.jsx` mounts one root and `src/App.jsx` performs application selection and internal route state; it does not use React Router. Pages are lazy loaded. The same build can serve the standalone compiler based on host/path and `VITE_YCODERS_DEPLOYMENT_TARGET`, injected by `vite.config.js` from `YCODERS_DEPLOYMENT_TARGET`.

`vercel.mjs` currently describes two deployment targets (`main`, `compiler`), shared security routes, SPA rewrites, two long-running function settings, and target-specific daily cron sets. APIs are Vercel functions under `api/`, backed by modules in `server/`. Firebase Functions under `functions/` own trusted activity, rewards, payment, and certification operations. Firebase Auth, Firestore, Storage, Functions, and App Check clients live under `src/firebase/`.

Frontend state is primarily React context plus repository/service objects. Auth, subscription access, bookmarks, learner activity, course progress, compiler state, and user data have separate providers. There is no general client state store.

Environment rules are important: browser variables are `VITE_*`; server variables are not. The build has a dependency-boundary validator specifically preventing `firebase-admin` from browser modules.

## Authentication and authorization

`src/auth/AuthRepository.js`, `AuthService.js`, and `AuthProvider.jsx` wrap Firebase Auth. The normalized browser user intentionally contains profile data, not privileged roles. Server APIs verify bearer ID tokens with Firebase Admin, including request-scoped WIF support (`server/firebaseAdminApp.js`, `server/ai/auth/FirebaseAITutorAuthenticator.js`).

There is no reusable Content Admin role system today. The relevant precedent is certification review: `functions/src/certification/ReviewService.js` trusts only server-managed `admin: true` or `certificationReviewer: true` custom claims. Firestore profile fields are not authorization. This is the pattern to generalize, not necessarily the exact claim names.

`firestore.rules` is owner-centric. Public learning metadata is readable; learner progress and active projects are scoped below `users/{uid}`. Current rules have no Admin draft/publishing permissions. `storage.rules` permits reads only for ACTIVE JSON artifacts in known published prefixes and denies all writes. Publishing is currently Admin SDK tooling, not browser writing.

## Projects

Projects are bundled JavaScript records. The canonical constructor is `src/projects/models/projectModel.js`; catalog loading is in `ProjectCatalog.js`; `cliTaskManagerProject.js` is the real multi-language project and `easyProjects.js` contains older compatibility records. Runtime resolution is in `projectRuntimeRegistry.js`.

`createProject` adapts legacy single-project records into one checkpoint. Current guide types are `heading`, `paragraph`, `note`, `list`, `code`, `expected-output`, `runtime-command`, `language-hint`, and `language-section`. They render through `ProjectGuideRenderer.jsx`, separately from Course blocks.

Language variation uses shared checkpoint guides plus `languageContent`, `languageOverrides`, `byLanguage`, and runtime defaults. Starter workspaces are normalized by `projectWorkspaceFiles.js` and `projectFilesystem.js`. `ProjectExecutionService.js` passes the virtual filesystem into the shared compiler manager and captures mutations when supported.

Validation has two generations. Legacy Python projects append a controlled harness. New projects use `project-checks` with `source_matches` and `execution` in `ProjectValidator.js`. Patterns and outputs may vary by language. This browser orchestration is learning feedback, not sufficient alone for trust-sensitive rewards.

`ProjectProgressService.js` caches locally, debounces cloud saves, tracks revisions, and stores checkpoint completion. `ActiveProjectRepository.js` transactionally writes metadata at `users/{uid}/activeProjects/{projectId}` plus a `files` subcollection. Schema v1 stores `currentCheckpoint` and `completedCheckpoints`, but no content version or task state.

Contextual AI is explicit-selection based. `projectAIContext.js` bounds selected content, nearby guide text, current-file content, and recent terminal output. `ProjectAIClient.js` sends authenticated requests to `/api/ai/explain`; conversation is capped to six turns. There is no task-specific mentor plan. `ProjectExporter.js` creates multi-file ZIPs and retains a legacy Python export path.

## Courses and shared blocks

`schemas/learning-course.schema.json` is the most mature content contract. It uses JSON Schema 2020-12, schema version `1.0.0`, metadata, navigation, modules/sections/lessons, and a discriminated block union. Blocks include headings, paragraphs, code, image, note, warning, quiz, exercise, compiler, divider, callout, video, table, AI explanation, and solution.

`BlockRenderer.jsx` dispatches through `blockRegistry`; renderers live in `src/components/blocks/`. `RichText.jsx` supports a small safe Markdown subset through React nodes rather than raw HTML. `Layout.jsx` separates compiler content, uses the shared compiler dock, and records trusted completion through `LearningProgressContext` and server verification.

Courses use a small outline manifest plus versioned module JSON. `CourseSession.js` lazy-loads modules, prefetches the next, and bounds its cache. `CourseContentRepository`, `CourseService`, and `StorageContentLoader` resolve Firestore metadata to Storage JSON with integrity and size checks.

`loadCourseBundle.mjs` validates metadata, paths, limits, schema, identities/counts, and hashes. `FirebaseCoursePublisher.mjs` uploads immutable version paths, downloads and verifies hashes, records READY, then atomically activates Firestore metadata and a publication pointer.

## Practice and Challenges

`practice-question.schema.json` reuses Course blocks and adds problem metadata, a function contract, examples, constraints, hints, concepts, mistakes, public tests, implementation metadata, and a required compiler block. `createCanonicalPracticeQuestion.js` generates current blocks from JS specs. Versioned JSON already lives under `firebase-content/practice/`. `PracticeRepository`/`PracticeService` load hash-verified artifacts. `PracticeProblemContent.jsx` still assumes meanings from certain block types/titles.

`daily-challenge.schema.json` also reuses blocks and adds date, motivation, difficulty, reward, and streak increment. `ChallengeService` loads a dedicated artifact or derives one from a Practice reference. Trusted activity/reward systems mean authored reward values must never become browser authority.

## Validation inventory

Reusable commands/modules include `validate:course`, language course validators, `validate:practice` plus bank/source/metadata checks, `validate:challenge`, `validate:projects`, `validate:content-limits`, `analyze:content-complexity`, `audit:content-integrity`, trusted completion/security rule tests, AJV schemas, `contentLimits.js`, and immutable publication helpers under `scripts/publishing/`.

Most validators currently read repository paths and exit the process. Pure schema, cross-reference, limit, and bundle logic should be extracted behind callable functions before Admin uses them; CLI wrappers should remain thin consumers.

## Compatibility constraints

1. Projects and Courses use different block and validation vocabularies.
2. Project definitions are executable JS objects rather than JSON artifacts.
3. Project learner state lacks pinned content version and per-task state.
4. Published content already uses metadata plus immutable Storage JSON; extend rather than replace it.
5. Trusted completion/rewards must resolve canonical published content server-side.
