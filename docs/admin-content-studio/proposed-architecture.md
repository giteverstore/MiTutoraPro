# Proposed architecture

## Recommendation

Use a **separate application/package in the same repository**, deployed as a separate Vercel project. Do not add Admin routes to `src/App.jsx`, and do not start with a separate repository.

```text
apps/learner/                 learner entry/composition (migration later)
apps/admin/                   Admin Vite entry, shell, editor state
packages/content-contracts/   schemas, IDs, normalization, pure validators
packages/content-renderers/   design-owned renderer primitives/adapters
packages/language-catalog/    stable browser-safe language metadata
server/admin-content/         privileged draft/publish/audit services
```

The root learner application need not move immediately. Phase 1 can add `apps/admin` and shared packages while existing root modules import the packages through workspace aliases.

| Option | Assessment |
|---|---|
| Hidden learner route | Rejected: couples bundles, auth, deployment, CSP, and route-guard failure modes. |
| Second entry in root app | Better than a route, but accidental dependency/config coupling remains likely. |
| Separate package/app, same repo | Recommended: atomic contract changes, independent builds/env, enforceable imports. |
| Separate repository | Defer: sharing and atomic compatibility changes become materially harder now. |

## Runtime topology

```text
Admin browser -> Firebase Auth -> Admin API
  -> custom-claim permission check
  -> draft/version repositories
  -> validation/publication/audit services
  -> controlled media upload

Learner browser -> public Firestore catalog -> ACTIVE immutable Storage JSON
  -> shared normalizer -> learner renderer
```

Admin should not directly write authoritative drafts, states, versions, or pointers. Server APIs combine authorization, revision checks, validation evidence, audits, and transitions.

## Studio composition

The constrained editor has a registry-derived palette, ordered document canvas, schema-driven properties panel, document outline/error list, and keyboard move/insert/delete equivalents for drag/drop. A `BlockDefinition` supplies type, allowed parents, defaults, property schema, validation, preview component, and learner renderer key. Authors never select CSS, fonts, colors, arbitrary HTML, absolute positioning, or freeform columns.

Project hierarchy is structural:

```text
Project -> Checkpoint[] -> Task[]
  checkpoint intro/completion blocks
  task instruction blocks + contracts + validators
  cumulative checkpoint validators
```

## Preview and APIs

Preview compiles a draft into the same normalized read model as learners and identifies draft revision, schema, language, renderer build, and validation time. It never marks progress or rewards. A preview iframe may isolate code, but it loads an Admin preview bundle importing canonical renderers.

Conceptual APIs cover drafts (revision-checked CRUD/validate), preview generation, submit/review/publish/archive/rollback, assets, and append-only audit. Exact URLs are implementation decisions. Every mutation uses an idempotency key and expected revision; publish binds to the exact validated revision/hash.

## Shared boundaries

Share schemas/types, IDs, language catalog, normalization, cross-reference checks, block registry metadata, safe renderer primitives, validator descriptors/result schemas, and artifact hashing/path conventions.

Do not share learner progress/subscription state, Admin editor state, credentials, publishing IAM, hidden tests, protected validators, or financial mutations. Extend the existing dependency-boundary validator: apps import shared packages; shared contracts import neither app; browser packages never import server modules.
