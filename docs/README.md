# MiTutora Developer Documentation

This directory is the living technical reference for MiTutora. It describes the code that exists today, the contracts that content and runtime implementations must follow, and the workflows used to extend and release the application.

## Start here

- [System overview](architecture/system-overview.md) — application boundaries and data flow
- [Project structure](development/project-structure.md) — where responsibilities live
- [Course JSON schema](content/course-json-schema.md) — canonical authoring contract
- [Adding a course](development/adding-a-course.md) — end-to-end content workflow
- [Adding a language](development/adding-a-language.md) — runtime and editor extension workflow
- [Current roadmap](roadmap/current-roadmap.md) — known gaps and planned work
- [Glossary](content/glossary.md) — shared platform terminology

## Documentation map

### Architecture

- [AppShell](architecture/app-shell.md)
- [Learning Engine](architecture/learning-engine.md)
- [Compiler architecture](architecture/compiler-architecture.md)
- [Runtime adapters](architecture/runtime-adapters.md)
- [Progress system](architecture/progress-system.md)
- [Practice](architecture/practice.md)
- [Daily Challenges](architecture/daily-challenges.md)
- [Library and Bookmarks](architecture/library-bookmarks.md)
- [Settings](architecture/settings.md)
- [Certificates](architecture/certificates.md)
- [Referrals](architecture/referrals.md)
- [Monaco integration](architecture/monaco-integration.md)
- [Pyodide runtime](architecture/pyodide-runtime.md)

### Content

- [Course JSON schema](content/course-json-schema.md)
- [Lesson blocks](content/lesson-blocks.md)
- [Exercise blocks](content/exercise-blocks.md)
- [Quiz blocks](content/quiz-blocks.md)
- [Glossary](content/glossary.md)

### Development

- [Project structure](development/project-structure.md)
- [Coding guidelines](development/coding-guidelines.md)
- [Adding a course](development/adding-a-course.md)
- [Adding a language](development/adding-a-language.md)
- [Release process](development/release-process.md)

### Architecture decisions

- [ADR index](decisions/README.md)
- [JSON-driven course content](decisions/0001-json-driven-content.md)
- [Monaco Editor](decisions/0002-monaco-editor.md)
- [Pyodide runtime](decisions/0003-pyodide-runtime.md)
- [Reusable AppShell](decisions/0004-app-shell.md)

## Keeping documentation current

Documentation changes are part of the definition of done when a change affects a public contract, folder ownership, content field, block type, runtime interface, persistence format, or contributor workflow. Prefer links to source files and schemas over duplicated implementation detail. If code and documentation disagree, treat the code and executable validation as the current behavior, then update this reference in the same change.
