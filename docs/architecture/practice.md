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

`schemas/practice-question.schema.json` defines a standalone question using the Learning Engine’s existing block definition by reference. A question includes catalog metadata and an ordered `blocks` array containing exactly one compiler block. Problem statements, examples, and constraints therefore use the same registered heading, paragraph, code, and note components as lessons.

Run `npm run validate:practice` to validate every mock question in `src/practice/practiceData.js`.

## Completion

`CompilerPanel` exposes optional verification callbacks while retaining its existing Learning Progress integration. Practice enables `Mark Complete` only after the shared output validator reports `matched`. This state is currently mock in-memory state and does not affect course progress.

When persistence is introduced, add a Practice repository rather than reusing `LearningProgressProvider`.
