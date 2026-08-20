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

For unpublished content testing, create an untracked `.env.local` containing `VITE_PRACTICE_CONTENT_SOURCE=local`, then restart `npm run dev`. This development-only override reads the canonical `practiceData.js` catalog directly. With no override, Practice remains Firebase-first and uses the existing local fallback only when Firebase throws and `VITE_ENABLE_LOCAL_PRACTICE_FALLBACK` permits it. Production always remains Firebase-backed.

The canonical Fundamentals bank is complete at 200 questions: eight 20-question topic batches, 15 input/output/parsing questions, 19 error-handling/mixed questions, and the six original questions included in that total. Topics cover variables/data types/expressions, conditionals, loops, functions, strings, arrays/lists, dictionaries/hash maps, sets, input/output/parsing, and defensive mixed-fundamentals work. Batch sources share `createCanonicalPracticeQuestion`; adding a future DSA batch must not duplicate block-generation or compiler wiring.

## Completion

`CompilerPanel` exposes optional verification callbacks while retaining its existing Learning Progress integration. Practice enables `Mark Complete` only after the shared output validator reports `matched`. This state is currently mock in-memory state and does not affect course progress.

When persistence is introduced, add a Practice repository rather than reusing `LearningProgressProvider`.
