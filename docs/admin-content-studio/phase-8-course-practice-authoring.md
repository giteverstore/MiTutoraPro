# Phase 8: Course and Practice authoring

## Architecture discovered

Courses use one language per Course. The learner model is a Course containing ordered modules, optional sections, ordered lessons, and domain-owned lesson blocks. The Learning Engine already renders prose, headings, code, notes/callouts, images, tables, quizzes, exercises, compiler blocks, solutions, and expected output. Cloud-delivered legacy Courses use metadata in Firestore plus a content-free manifest and versioned module JSON in Storage; local JSON is a development fallback. Course completion persists lesson IDs, quiz scores, exercise verification, bookmarks, and the published version used by trusted completion.

Practice treats each question as an independent domain object. Questions carry language, difficulty, topic/category, time, XP, instructional blocks, one compiler configuration, starter code, public tests, and normalized expected-output validation. The catalog supports search plus difficulty/topic filters. Solves are recorded against stable activity IDs with the executed content version as evidence; a later publication does not rewrite historical completion.

## Canonical integration

Both domains now use the existing canonical envelope and specialized inner schemas:

```text
envelope -> PROJECT | COURSE | PRACTICE
```

`COURSE` validates stable Course/module/section/lesson/block IDs, deterministic order, reachable default lessons, quiz answer references, language/runtime consistency, safe assets, and non-executable compiler configuration. `PRACTICE` validates one stable question, instructional content, starter code, metadata, and the allowlisted `expected-output` descriptor. Arbitrary JavaScript, shell commands, and author supplied runners are not supported.

Existing bundled Course and Practice formats remain supported by explicit legacy adapters. ACTIVE Course cards merge into the learner library, replacing a matching legacy card by ID. ACTIVE Practice questions merge with the existing catalog by stable question ID, so a partial migration does not hide unmigrated questions. Exact-version retrieval for pinned learners does not fall back to a different version.

## Course Studio

Routes are `/content/courses`, `/content/courses/new`, and `/content/courses/:courseId/edit`. The Studio provides metadata, derived module/lesson counts, stable hierarchy IDs, module/lesson creation and reordering, lesson block editing, quiz/compiler authoring, generated JSON, validation, ephemeral preview, autosave, version history, publish, activate/rollback, and archive. Course preview shows module and lesson navigation, previous/next navigation, and local quiz feedback. It never writes learner progress.

The Course remains single-language. Code and compiler blocks use that Course language; `text`/`plaintext` remains available for explanatory snippets. Images must reference `/assets/` paths or the shared registered asset ID mechanism. The editor exposes controls for the legacy Course block types used by the existing Python and Java Courses, including media, tables, lists, exercise instructions/starter files, solutions, and expected output. Preview renders these blocks and compiler configuration, but does not execute compiler exercises; the authored output contract is covered at the shared compiler-validator layer.

## Practice Studio

Routes are `/content/practice`, `/content/practice/new`, and `/content/practice/:questionId/edit`. One draft represents one question, matching learner catalog and solve semantics. The editor covers metadata, semantic problem blocks, starter code, stdin, expected output, comparison policy, constraints, and hints. Preview provides an ephemeral code editor, Run, captured output, trusted comparison, and Reset for the Admin preview manager's Python, Java, and C++ runtimes. It does not persist completion and contains no reference solution.

## Draft storage and measured size

Measured 2026-10-05:

| Existing Course | Source bytes | Compact canonical-adapter bytes | Modules | Lessons | Blocks |
| --- | ---: | ---: | ---: | ---: | ---: |
| Python Foundations | 303,246 | 172,001 | 1 | 109 | 648 |
| Java Basics | 1,090,039 | 630,318 | 5 | 363 | 2,574 |

Although the compact Java payload currently fits below the existing 850 KB draft limit, it lacks comfortable Firestore headroom and the source representation already exceeds 1 MiB. Course drafts therefore use a segmented implementation behind the same generic publication store: the root draft stores metadata and an ordered module-ID list, while each module is a server-only `courseModules` subdocument. Reads rehydrate the canonical envelope. Every module retains the 850 KB bound; the complete Course retains the 4 MB publication-artifact bound. Publication still emits one immutable JSON artifact in Storage.

Practice questions and Projects remain single draft documents.

## Publication, versions, and learner delivery

All three types use `ContentPublicationService`: load draft, normalize and validate by type, validate assets, allocate a monotonic version, serialize, hash with SHA-256, write an immutable Storage object, verify it, mark READY, then move ACTIVE. The shared history, rollback, archive, optimistic-concurrency, and audit mechanisms are unchanged.

`CanonicalPublishedRepository` provides typed catalog, ACTIVE, and exact-version retrieval. Course artifacts adapt to the current Learning Engine model. The initial Course progress record stores `contentVersion`; repository exact-version retrieval is available for pinned resumes, while new starts resolve ACTIVE. Archived Courses disappear from ACTIVE discovery but immutable pinned versions remain fetchable.

Practice listings resolve ACTIVE questions, then include unmigrated legacy questions with different IDs. Existing solve records remain keyed by stable question ID and retain the version used for completion evidence. New/unsolved opens use ACTIVE. Archiving hides a question from new discovery without deleting historical solves or immutable artifacts. Canonical difficulty values are normalized to the learner filter values (`easy`, `medium`, `hard`). Expected-output comparison is explicitly mapped to the shared compiler validators for normalized lines, trimmed, or exact output.

## Permissions and security

The existing centralized role contract applies uniformly. Super Admin and Content Admin may publish/activate/rollback/archive. Content Editors may edit, validate, and preview. Content Reviewers are read-only and may validate/preview. Server routes remain the enforcement boundary.

The envelope ID must match `courseId`/`questionId`; type-forged payloads fail strict validation. Raw executable validator fields, unsafe image paths, missing asset IDs, malformed quizzes, duplicate IDs, and version tampering fail closed. Draft subcollections and publication metadata remain browser-write-denied. Reference solutions are neither authored nor published in Practice V1.

## Acceptance fixtures

Test-only fixtures include the existing canonical Project progression fixture, `Python Mini Fundamentals` (two modules, three lessons, prose, code, expected output, quiz, and compiler exercise), and three Practice questions covering greeting output, arithmetic, and string transformation. Unit/integration acceptance sends Course and Practice fixtures through real draft, validation, immutable publish, READY/ACTIVE, v2, rollback, archive, and exact-version delivery using the production services with in-memory infrastructure.

## Migration readiness

- Python Course: validates after the adapter; all 648 current blocks are represented. Compact size is about 172 KB. Ready for a controlled migration script.
- Java Course: validates after the adapter; all 2,574 current blocks are represented. Compact size is about 630 KB and will use segmented draft storage. Ready for controlled migration, not a browser JSON upload.
- Practice: all 200 current questions validate after the adapter. Combined compact bank size is about 528 KB, but migration remains one draft/publication per question. Compiler blocks map to starter code, stdin, and normalized expected output.

No bulk migration or arbitrary JSON uploader is included. A future migration command should invoke these adapters, validate the canonical envelope, then save through the authenticated server draft API.

## Course browser acceptance

A synthetic Course is drafted, published as immutable v1, discovered and started in an authenticated learner browser against local Firebase emulators. The browser completes a reading lesson and a server-graded quiz, reloads and retains progress, then verifies that its exact v1 pin survives v2 activation. A second learner starts v2. After rollback, a new learner starts v1 while the second learner remains pinned to v2. Archiving removes the Course from new catalog discovery but both enrolled learners can resume their pinned artifacts. The trusted completion service verifies canonical publication metadata and artifact SHA-256 before issuing lesson evidence; it permits inactive exact versions only for a learner with a matching stored version pin.

The large existing Courses remain un-migrated. Measured compact source JSON is approximately 171 KB for Python and 626 KB for Java; Java's largest individual module is approximately 198 KB, comfortably below the 850 KB per-segment draft bound and Firestore's 1 MiB document limit. Python's single module is approximately 170 KB.

## Known limitations

- Course Preview reuses domain shapes and interaction semantics but is lighter than a mounted authenticated Learning Engine; compiler execution is not available in Admin Preview. It displays starter code, language/runtime, stdin, and expected output; local quiz feedback is ephemeral.
- Practice Preview uses an Admin-only Monaco editor and the existing shared compiler manager. A real browser Python Run/Verify/Reset test passes using pinned same-origin Pyodide assets. Java/C++ are configured in Preview but were not browser-verified in Phase 8B/8C. Published questions use the learner compiler.
- Authenticated learner Practice browser assertions pass with real Python execution, version-aware completion, reload, rollback, and archive. The Windows root Playwright process still hangs during teardown after reporting passing assertions; this is tracked separately from product behavior.
- Practice V1 supports trusted expected-output comparison only. It does not accept arbitrary test code or hidden reference solutions.
- Existing Course progress records created before Phase 8 may not contain `contentVersion`; they retain legacy resolution behavior until their next canonical start.
- Media authoring uses stable references; a full asset-manager UI remains out of scope.
- Challenges and Bingo authoring are not part of this phase.
