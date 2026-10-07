# Draft, publishing, and versioning

## Lifecycle

```text
DRAFT -> IN_REVIEW -> VALIDATED -> PUBLISHING -> PUBLISHED -> ARCHIVED
                \-> DRAFT                \-> FAILED
```

Only drafts are editable. Editing published content forks/resumes a new draft from that immutable version. `PUBLISHING` is server-owned. Failed uploads remain inactive and can retry idempotently.

## Identity

- `contentId`: stable lineage (`project-bingo`)
- `draftId`: mutable branch
- `versionId`: globally unique immutable candidate
- `version`: monotonic human number in the lineage
- `schemaVersion`: parser compatibility
- `revision`: optimistic concurrency for a draft
- `contentHash`: canonical artifact/manifest hash

Record created/updated/validated/published timestamps and UIDs, source version, notes, compatibility classification, and renderer/validator requirements. Use server timestamps and verified identities.

## Hybrid storage

```text
Firestore
  contentItems/{contentId}                       catalog + activeVersionId
  contentItems/{contentId}/drafts/{draftId}      draft metadata/revision
  contentItems/{contentId}/versions/{versionId}  immutable manifest metadata
  contentDraftDocuments/{draftId}/parts/{partId} bounded draft parts
  contentAudit/{eventId}                         append-only events
  mediaAssets/{assetId}                          metadata/usage state

Storage
  content/{type}/{contentId}/{versionId}/manifest.json
  content/{type}/{contentId}/{versionId}/parts/*.json
  media/{assetId}/{immutableVariant}
```

Split large Projects/Courses by checkpoint/module to stay well below Firestore's 1 MiB limit and localize conflicts. Firestore catalog metadata remains queryable; published Storage bytes are immutable/cacheable.

## Publication transaction

Extend the existing `ContentPublicationProtocol`:

1. lock the exact draft revision and version candidate
2. validate schemas, references, limits, languages, assets, and validator fixtures
3. canonicalize and hash artifacts
4. upload immutable version paths
5. download and verify hashes
6. write READY version with validation evidence
7. transactionally switch active pointer and append audit
8. mark PUBLISHED and invalidate catalog caches

Storage and Firestore are not one transaction. Active pointers may reference READY hash-verified artifacts only. Orphan uploads remain inactive and are janitor-cleaned.

## Rollback, archive, unpublish

Rollback switches the active pointer to an already verified version and logs actor/reason; it never edits bytes. Archive hides new catalog discovery but preserves pinned learner access. Emergency unpublish blocks new starts; existing pinned access remains by default unless a security takedown explicitly denies it.

## Autosave conflicts

Autosave sends changed parts with `expectedRevision`; the server increments revision transactionally. Conflict UX offers reload, compare, or fork, never last-write-wins. Presence is optional and does not replace revision checks.

## Media model

Media uses stable asset IDs, immutable object versions, MIME/size/dimension limits, alt text, caption/credit, SHA-256, creator, lifecycle, and usage references. Drafts reference asset IDs; publish resolves immutable variants. Published references prevent deletion. Orphan cleanup uses a grace period and server-computed reference graph.
