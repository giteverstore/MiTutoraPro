# ADR 0001: JSON-Driven Course Content

- Status: Accepted
- Scope: Learning Engine and content authoring

## Context

MiTutora must support many courses without duplicating lesson JSX or changing UI code for each course. Content writers need a portable, reviewable format that describes modules, lessons, navigation, and heterogeneous blocks. The application currently has no backend CMS.

## Alternatives

1. Hardcode each course in React components. This offers direct control but couples content releases to frontend implementation and creates duplication.
2. Store lessons as unrestricted Markdown/MDX. This is author-friendly for prose but makes interactive quizzes, exercises, compiler configuration, validation, and safe structured evolution harder.
3. Use a backend CMS immediately. This improves publishing workflows but introduces services, authentication, availability, and schema integration beyond the current local architecture.
4. Use versioned JSON documents validated by JSON Schema.

## Decision

Courses are authored as JSON conforming to `schemas/learning-course.schema.json`. A local metadata catalog maps course IDs to documents. The loader normalizes documents into a view model, navigation resolves structure and branches, and a registry maps block types to components.

JSON Schema defines the portable content contract. Cross-reference integrity and production quality checks are handled by scripts because they exceed portable schema capabilities.

## Consequences

### Positive

- UI components remain reusable and content-agnostic.
- Courses can be validated before runtime.
- Interactive blocks have explicit, evolvable structures.
- Local files can later be replaced by API responses using the same document shape.
- Content changes are diffable and reviewable.

### Negative

- Raw JSON is verbose for long-form authors.
- Schema and renderer changes must be coordinated.
- Referential integrity requires validation beyond JSON Schema.
- Released IDs become persistence contracts.

### Follow-up

Build authoring tools on top of this contract rather than bypassing it. Version incompatible schema changes and provide migrations.
