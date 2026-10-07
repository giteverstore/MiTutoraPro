# Phase 4: Projects authoring

Status: implemented locally; not committed or deployed.

## Authoring architecture

Projects are authored at `/content/projects`, `/content/projects/new`, and `/content/projects/:projectId/edit`. The landing page lists local drafts and never represents them as published. The editor writes the Phase 2 canonical `PROJECT` envelope directly; there is no second Project schema or raw-JSON editing workflow.

The workspace is split into a hierarchical checkpoint/task tree and focused authoring surfaces for overview metadata, checkpoint and task guide blocks, Project-scoped implementation contracts, task/checkpoint/final validator descriptors, mentor configuration, starter workspaces, completion content, and read-only generated JSON. The existing canonical block palette and canvas are reused at checkpoint, task, and completion scopes.

## Identity and hierarchy

Project, checkpoint, task, block, contract, validator, and hint IDs are stable generated identities. Explicit `order` values remain separate from IDs. Tasks reference Project-level implementation contracts by ID, avoiding duplicated semantics. Supported languages are canonical compiler IDs and control starter workspaces, contract representations, and validator applicability.

## Validation and security

The UI only creates allowlisted validator descriptors from `TRUSTED_VALIDATOR_REGISTRY`; it does not accept executable JavaScript, modules, or shell fields and never runs learner code. `validateProjectContent()` checks the canonical shape and cross-references. Starter entrypoints and file paths must be relative, cannot traverse parents, cannot contain NUL, and cannot use absolute Windows or POSIX paths.

Mentor authoring stores bounded additional context, structured concept boundaries, hints, and reveal policy. Core task objectives, expected behavior, common mistakes, contracts, guide blocks, and validators remain canonical sources and are not duplicated into an authored system prompt.

## Persistence and permissions

Project drafts autosave through `DraftRepository` using a separate local namespace. Generated JSON is read-only. Content Editor, Content Admin, and Super Admin roles can edit; Content Reviewer has read-only access. There is no Firestore publication, ACTIVE pointer, media upload, collaboration, learner progress mutation, or compiler/runtime integration.

## Capability evidence and limitations

The existing non-production schema fixture represents Python, Java, and C++; eight checkpoints; seventeen tasks; contracts; task/checkpoint/final validators; Project facts; hint ladders and reveal policy; language starter files; and completion blocks. It is test data only and is not production Bingo content.

Phase 4 deliberately does not provide publishing/versioning, runtime execution or validator execution, media upload, full Project duplication, collaboration, or learner task UI. Desktop is primary; tablet uses a stacked tree/editor layout and mobile retains the accessible click-to-add block fallback.
