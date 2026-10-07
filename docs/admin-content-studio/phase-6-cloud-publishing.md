# Phase 6: cloud drafts, immutable publishing, and learner delivery

## Architecture

Phase 6 adds a server-authorized content lifecycle without changing the canonical schemas in `shared/content`. The Admin browser uses `CloudDraftRepository`; it sends a Firebase ID token to the thin `/api/admin-content/*` API. The API re-verifies the token and permission through `server/admin/AdminAuthorization.js`, then invokes the dependency-injected publication domain service. Browser role checks are presentation only.

The Admin Vercel project proxies `/api/admin-content/*` to the main Y Coders deployment. Local unit tests use `LocalDraftRepository` or the in-memory publication adapters. Set `VITE_ADMIN_DRAFT_MODE=local` only for explicit offline authoring fallback; cloud lifecycle behavior should be tested with the API and Firebase emulators.

## Firestore model

- `adminContentDrafts/{contentId}` contains the canonical authoring document, monotonically increasing `draftRevision`, creator/updater identity and timestamps, validation summary, and lifecycle state.
- `adminContentAssets/{assetId}` is the server-only registry used to confirm that referenced assets exist before publication.
- `publishedContent/{contentId}` contains the ACTIVE pointer, latest allocated version, catalog state, and an `activeRevision` concurrency token.
- `publishedContent/{contentId}/versions/{version}` contains immutable-version metadata, not the full artifact.
- `adminContentAudit/{eventId}` contains append-only publication events without document bodies, credentials, or tokens.

Browser writes to all four paths are denied. Server-side Admin SDK code owns mutations. Learners may read the learner-safe ACTIVE pointer but cannot read version metadata directly or mutate any publication data.

Draft saves compare the caller's expected revision in a Firestore transaction. A mismatch returns `content/draft-conflict`; the UI asks the author to reload and never silently merges or overwrites. Draft JSON is limited to 850,000 encoded bytes so it remains below Firestore's document ceiling with metadata overhead.

## Storage artifacts and state machine

Artifacts use:

```text
published-content/<contentType>s/<contentId>/v<version>.json
```

`contentId` is restricted to a single safe path segment. An upload uses the Storage generation precondition `ifGenerationMatch: 0`, making artifact bytes create-only. Published JSON is limited to 4,000,000 bytes.

Publication proceeds as follows:

1. Reload the requested draft and confirm its revision.
2. Normalize and re-run the shared schema and semantic validation on the server.
3. Verify referenced image asset IDs through the configured asset resolver.
4. Allocate the next monotonically increasing version transactionally and create `CREATING` metadata.
5. Upload create-only bytes with Storage metadata `CREATING`.
6. Download the artifact and verify its SHA-256 digest.
7. Change Storage metadata to `READY`.
8. Transactionally mark version metadata `READY` and update the ACTIVE pointer if `activeRevision` is still current.
9. Append publication and activation audit entries.

Failures mark allocated metadata `FAILED` where possible and leave the previous ACTIVE pointer unchanged. Version numbers are never reused. A storage artifact is never overwritten or deleted by this workflow.

## ACTIVE, rollback, and archive

New learners resolve only an `ACTIVE` pointer. Rollback transactionally moves that pointer to an older `READY` version and increments `activeRevision`; it does not copy, mutate, or delete artifacts. Archive changes catalog status to `ARCHIVED`, hiding content from ACTIVE discovery. Exact-version delivery remains available so an existing pinned learner can resume.

Only `SUPER_ADMIN` and `CONTENT_ADMIN` possess `CONTENT_PUBLISH` and can publish, activate, or archive. `CONTENT_EDITOR` can create/edit/save/validate/preview. `CONTENT_REVIEWER` can read/validate/preview. Every API operation enforces the corresponding permission on the server.

Audit events are `DRAFT_CREATED`, `DRAFT_UPDATED`, `CONTENT_PUBLISHED`, `CONTENT_ACTIVATED`, `CONTENT_ROLLED_BACK`, and `CONTENT_ARCHIVED`.

## Learner delivery and pinning

`PublishedContentRepository` resolves ACTIVE content for a new learner and fetches an exact version for a resumed learner. Server delivery verifies metadata status, SHA-256, JSON parsing, content identity, schema version, normalization, and semantic validation before returning content. Corrupt or missing artifacts fail closed.

Active Project state now accepts `contentVersion`. The first start stores the resolved version; subsequent starts preserve it. A later ACTIVE change therefore does not silently migrate that learner. If no cloud ACTIVE publication exists, the repository falls back to the existing bundled `ProjectCatalog`, preserving the current CLI Task Manager and other legacy Projects.

## Rules and security boundaries

Firestore rules deny browser writes to drafts, pointers, versions, and audit logs. Storage rules deny all writes and allow reads only for JSON artifacts whose server-controlled metadata is `READY`. Server publication validates IDs and relative starter paths, uses trusted validator descriptors only, and never exposes Firebase Admin credentials to browser code.

## Local emulator testing

Use isolated Firebase Auth, Firestore, and Storage emulators. Configure server-side Admin SDK variables for the emulator project and hosts, then run the main API through Vercel development tooling so `/api/admin-content/*` functions execute. Point the Admin proxy at that local API when exercising the end-to-end lifecycle. Never use real production data for publication integration tests.

For offline UI work only:

```powershell
$env:VITE_ADMIN_DRAFT_MODE = "local"
npm run admin:dev
```

This fallback does not test publishing. Integration acceptance must cover stale saves, concurrent allocation, failed uploads, ACTIVE races, rollback, archive, exact-version delivery, corruption, authorization, Firestore rules, and Storage rules against emulators.

## Recovery

A `FAILED` or abandoned `CREATING` version is retained for diagnosis and is never ACTIVE. Operators correct the draft or infrastructure problem and publish again, receiving a new version number. If a bad but valid release is ACTIVE, an authorized administrator activates an older READY version. Existing pinned attempts remain untouched in both cases.

## Deliberate limitations

This phase does not implement collaboration, merging, reviewer approvals, comments, arbitrary JSON uploads, executable custom validators, GitHub publishing, automatic learner migration, task-level learner progress, full media management, or real Bingo content.
