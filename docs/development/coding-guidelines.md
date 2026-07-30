# Coding Guidelines

## Boundaries

- Keep React presentation, content data, progress, and runtime execution separate.
- Pages must not recreate AppShell navigation.
- Learning Engine components must not import Pyodide or a concrete runtime.
- Runtime adapters must not import React or progress context.
- Course content must come from course JSON, not JSX constants.
- Use repositories as the persistence boundary; do not scatter localStorage access.

## Components

- Receive content and actions through props or focused contexts.
- Prefer small components with one ownership responsibility.
- Render repeated data with shared components and arrays, not duplicated markup.
- Use semantic HTML, labeled controls, and visible focus states.
- Preserve keyboard behavior and support reduced motion.
- Use design tokens from `src/design-system/`; avoid isolated color and spacing values.

## Registries

Block types, runtimes, and validators use registries. Add one registration at the composition root instead of introducing type switches across the UI.

## State

- Store state at the narrowest owner.
- Keep current editor source authoritative; never execute starter code after edits.
- Derive progress centrally through `deriveProgress`.
- Treat IDs as persistent keys, not display labels.
- Abort stale async work and release workers/listeners in cleanup.

## Content and schema

- Update schema, example, renderer, validator, and docs together when adding a field or block.
- Prefer canonical compiler fields over compatibility aliases.
- Do not publish empty lessons, missing assets, dangling navigation IDs, or placeholder copy.
- Use stable kebab-case IDs and semantic course versions.

## Imports and files

- Keep language-neutral compiler code under `compiler/core`.
- Put concrete runtimes under `compiler/runtimes/<id>`.
- Put block components under `components/blocks`.
- Avoid circular dependencies between providers and consumers.

## Verification

Before merging:

```sh
npm run build
npm run validate:course
npm run validate:python-course
npm run test:navigation
```

Run checks relevant to the change and document known unrelated warnings. The current build emits Pyodide browser-externalization and Monaco chunk-size warnings; do not hide them without resolving their causes.
