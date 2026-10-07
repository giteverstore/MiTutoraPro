# Y Coders Admin Content Studio architecture

Status: Phase 0 architecture plus the implemented Phase 1 Admin foundation, Phase 2 canonical shared content contracts, and Phase 3 core structured content editor. Domain-specific authoring, publishing, schema migration, and production deployment remain unimplemented.

## Decision summary

- Build a separate Admin Vite application in this repository, deployed as a separate Vercel project at `admin.ycoders.com`.
- Extract canonical, runtime-neutral content contracts and validators into shared packages. Do not import learner state, server secrets, or Admin editing state across applications.
- Use Firestore for draft/version/catalog metadata and immutable Firebase Storage artifacts for published JSON and media.
- Publish through authenticated, role-checked server APIs using the repository's existing upload -> hash verify -> READY -> activate protocol.
- Pin every learner start to a published content version. Existing starts remain on that version unless an explicit compatible migration is supplied.
- Extend Projects from checkpoint-only progress to checkpoint -> task progress, while retaining cumulative checkpoint validation.
- Generate most AI mentor grounding from project/checkpoint/task/contract structures; retain a small bounded freeform mentor-note field.
- Use trusted declarative validator descriptors mapped to an allowlisted server/runtime validator registry. Never execute arbitrary author JavaScript.

## Documents

- [Current system analysis](current-system-analysis.md)
- [Proposed architecture](proposed-architecture.md)
- [Content schema](content-schema.md)
- [Project task model](project-task-model.md)
- [AI mentor model](ai-mentor-model.md)
- [Validation model](validation-model.md)
- [Publishing and versioning](publishing-versioning.md)
- [Security and authorization](security-auth.md)
- [Deployment](deployment.md)
- [Migration plan](migration-plan.md)
- [Risks](risks.md)
- [Implementation roadmap](implementation-roadmap.md)
- [Phase 1 Admin foundation](phase-1-admin-foundation.md)
- [Phase 2 shared content contracts](phase-2-shared-content-contracts.md)
- [Phase 3 core structured content editor](phase-3-structured-content-editor.md)
- [Phase 3.5 visual and browser hardening](phase-3-5-browser-hardening.md)

## Architectural principles

1. Authors control content and order; Y Coders owns rendering and design.
2. Drafts are mutable, published versions are immutable.
3. Preview and learner delivery consume the same normalized contracts and renderer primitives.
4. Browser authorization improves UX; server authorization is authoritative.
5. A content version, schema version, validator version, and learner-progress version are separate identities.
6. Publishing is fail-closed and auditable. A partially uploaded version is never active.
7. Migration is incremental. Existing bundled content remains supported behind adapters until parity is proven.

## Locked V1 product decisions

- Roles are `SUPER_ADMIN`, `CONTENT_ADMIN`, `CONTENT_EDITOR`, and `CONTENT_REVIEWER`.
- Publishing is single-person for V1; reviewer approval is not mandatory.
- V1 authoring is English-only, while future contracts remain locale-aware.

## Product decisions still required

- Whether learners automatically receive compatible content revisions or remain pinned indefinitely.
- Retention periods for drafts, audit events, archived versions, and orphan media.
- Whether the first release permits custom validators at all, or only platform-owned validator templates.
# Admin Content Studio

- [Phase 4 Projects authoring](./phase-4-projects-authoring.md)
- [Phase 5 Project preview and trusted validation](./phase-5-project-preview-validation.md)
# Phase 6

- [Cloud drafts, immutable publishing, and learner delivery](./phase-6-cloud-publishing.md)
