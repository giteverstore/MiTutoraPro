# Practice

Practice is an AppShell product page under `src/practice/`. It is independent from course loading and learning progress, but reuses the platform’s content and execution infrastructure.

## Composition

```text
PracticePage
├── PracticeFilters
├── PracticeQuestionCard list
├── PracticeStatistics
└── PracticeDetail
    ├── BlockRenderer
    └── CompilerPanel
        └── CompilerManager → runtime + validator
```

Catalog filtering and mock solved state belong to Practice. The catalog filters by search, difficulty, and topic; language selection remains in the shared compiler workspace. Selecting a question opens `PracticeDetail` directly. Runtime initialization, execution, Monaco source editing, terminal output, and normalized validation remain owned by the existing compiler modules.

## Question contract

Canonical question-bank entries describe category, subtopic, question type, a language-independent function contract, examples, constraints, concepts, skills, prerequisites, common mistakes, complexity, public tests, and language implementation metadata. These fields describe the problem independently from the renderer. Language adapters remain under `implementations`; the problem statement must not depend on Python syntax.

Protected tests and reference implementations are deliberately excluded from browser-delivered question objects and generated Storage JSON. Validator-only material lives under `scripts/fixtures/`. This separation prevents the Practice UI and client bundle from exposing hidden expected values. A future server-side judge can consume the same conceptual split without changing the learner-facing schema.

`schemas/practice-question.schema.json` defines a standalone question using the Learning Engine’s existing block definition by reference. A question includes catalog metadata and an ordered `blocks` array containing exactly one compiler block. Problem statements, examples, and constraints therefore use the same registered heading, paragraph, code, and note components as lessons.

Run `npm run validate:practice` to validate every question in `src/practice/practiceData.js`. Run `npm run validate:practice-bank` to verify canonical batch distributions, metadata completeness, public/protected separation, and every test case with Pyodide.

The catalog is metadata-first: Firestore returns deterministic 24-item cursor pages, cards render without Storage downloads, and only a selected question loads its full JSON. The active publication supplies filter facets and version binding. Numbered pagination retains a bounded map of established cursors and recent metadata pages; it never fabricates unreachable page numbers or downloads question bodies. Search and filter changes reset the cursor chain to page 1. Selected-content errors are retryable and never erase the catalog.

### Safe loading diagnostics

Practice preserves the original Firebase/content exception while attaching an out-of-band diagnostic at one of four boundaries: `publication-read`, `metadata-query`, `metadata-normalization`, or `storage-download`. The diagnostic contains only the stage, a sanitized error code/name, a broad category, and retryability. It deliberately excludes messages, URLs, session identifiers, credentials, UIDs, response bodies, and question/user content. The existing learner-facing message and Retry behavior remain unchanged; safe `data-practice-error-*` attributes let browser automation identify the failed stage without exposing request details.

The publication pointer is an optimization for active-version/facet binding. A denied pointer read currently degrades to the existing published-metadata query; it does not authorize a local production fallback. The checked-in Firestore rule permits the root `contentPublications/practice-python` document only while its status is `ACTIVE`. It does not permit the nested immutable version record, which the browser does not currently request. Production denied the independently tested root pointer read despite the pointer being ACTIVE, indicating deployed-rule drift from the repository. Deploying the existing root rule would reconcile that drift; permitting the nested version would require a separate explicit nested match and is neither necessary nor recommended for the current client.

For unpublished content testing, create an untracked `.env.local` containing `VITE_PRACTICE_CONTENT_SOURCE=local`, then restart `npm run dev`. This development-only override reads the canonical `practiceData.js` catalog directly. Explicit `firebase` selection never falls back. With no override, Practice remains Firebase-first; fallback is disabled by default and only runs when explicitly enabled. Production always remains Firebase-backed.

The canonical Fundamentals bank is complete at 200 questions: eight 20-question topic batches, 15 input/output/parsing questions, 19 error-handling/mixed questions, and the six original questions included in that total. Topics cover variables/data types/expressions, conditionals, loops, functions, strings, arrays/lists, dictionaries/hash maps, sets, input/output/parsing, and defensive mixed-fundamentals work. Batch sources share `createCanonicalPracticeQuestion`; adding a future DSA batch must not duplicate block-generation or compiler wiring.

## Completion

`CompilerPanel` exposes optional verification callbacks while retaining its existing Learning Progress integration. Practice enables `Mark Complete` only after the shared output validator reports `matched`. This state is currently mock in-memory state and does not affect course progress.

When persistence is introduced, add a Practice repository rather than reusing `LearningProgressProvider`.
