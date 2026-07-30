# System Overview

MiTutora is a client-side React application built with Vite. Course content, user profiles, and learning progress are local; there is no application backend or remote authentication service.

## Runtime composition

`src/App.jsx` composes the major providers and screen states:

```text
CompilerProvider
└── UserProvider
    └── authenticated application
        ├── AppShell → Home and product pages
        └── CourseLoaderProvider
            └── LearningProgressProvider
                ├── Course Overview
                └── Learning Engine
                    └── optional Compiler workspace
```

The providers have deliberately separate ownership:

- `UserProvider` owns the local profile and session abstraction.
- `CourseLoaderProvider` loads and selects course/lesson data.
- `LearningProgressProvider` owns course-scoped learning state.
- `CompilerProvider` exposes a language-agnostic `CompilerManager`.
- `AppShell` owns product navigation and shared shell UI state only.

## Course rendering data flow

```text
public/courses/course-metadata.json
  → courseRepository
  → public/courses/<course>.json
  → createCourseModel
  → createCourseNavigation
  → current lesson
  → lesson.blocks
  → BlockRenderer
  → registered block components
```

`CourseLoaderProvider` exposes the current course, module, lesson, neighboring lessons, branch options, current blocks, and navigation actions. Lesson components receive data rather than importing course content.

## Compiler data flow

```text
compiler block JSON
  → normalizeCompilerDefinition
  → editor state
  → CompilerManager
  → RuntimeRegistry
  → PythonRuntime
  → Web Worker
  → Pyodide
  → execution result
  → OutputValidator
  → exercise verification
```

The Learning Engine does not import Pyodide. It talks to `CompilerManager`, which resolves runtimes and validators by registered IDs.

## Persistence

The current repositories use `window.localStorage`:

- profile/session through `src/auth/userRepository.js`
- course progress through `src/progress/progressRepository.js`
- theme and sidebar preferences through shell/workspace-specific keys

Repository modules are the replacement boundary for a future API. React components should not read or write serialized progress directly.

## Primary contracts

- Course authoring: `schemas/learning-course.schema.json`
- Example course: `examples/course.example.json`
- Course catalog: `public/courses/course-metadata.json`
- Block registry: `src/components/blockRegistry.js`
- Runtime contract: `src/compiler/core/RuntimeAdapter.js`
- Validator contract: `src/compiler/core/OutputValidator.js`

See the [glossary](../content/glossary.md) for terminology.
