# Project task and learner progress model

## Current gap

`ProjectProgressService` records checkpoint indices/IDs. `ActiveProjectRepository` v1 has no content version, task completion, or validation evidence. Tasks therefore require a learner-state migration, not just new guide markup.

## Content model

```text
checkpoint.id
  task.id
    validators[]
  checkpointValidators[]
```

IDs are semantic, unique within their parent, and immutable once published. Reordering never changes identity. Changing task meaning requires a new content version and compatibility classification.

## Active Project v2 shape

Keep files in the existing subcollection. Extend metadata conceptually:

```json
{
  "schemaVersion": 2,
  "contentVersionId": "01J...",
  "contentVersion": 3,
  "currentCheckpointId": "geometry",
  "currentTaskId": "define-win-lines",
  "taskProgress": {
    "setup/create-entrypoint": {
      "status": "completed",
      "completedAt": "...",
      "attempts": 2,
      "lastValidation": {
        "validatorSetVersion": "project-bingo:v3:task:create-entrypoint",
        "status": "passed",
        "validatedAt": "...",
        "resultDigest": "sha256:..."
      }
    }
  },
  "checkpointProgress": {
    "setup": { "status": "completed", "completedTaskCount": 2, "taskCount": 2, "completedAt": "..." }
  }
}
```

Do not put full compiler output or unbounded attempt history in metadata. Store bounded status/digests; add a capped, retained subcollection only if durable attempt history becomes a requirement.

## Transitions and aggregation

- Starting pins a published version and language.
- A task completes only after its validator set passes against the current workspace.
- A checkpoint completes only when required tasks complete and cumulative validation passes.
- A project completes only after all checkpoints plus final validation pass.
- A later cumulative failure marks the relevant scope `needs_attention`; it does not erase historical timestamps.

Checkpoint display derives `completed required tasks / required tasks`. Optional tasks do not affect the denominator unless explicitly configured. Content owns order; learner state owns stable IDs.

## Backward compatibility

On first v1 read, map each checkpoint to a synthetic `{checkpointId}/legacy-completion` task. Preserve known checkpoint completion and dates; do not infer completion for newly split tasks. Read both versions, write v2 only after an idempotent migration, and update Firestore rules for bounded task maps.

## Content updates after start

Default to the pinned `contentVersionId`. A newer publication declares:

- `compatible`: wording/content changes; IDs and validator meaning are stable
- `migratable`: signed mapping of old checkpoint/task IDs to new IDs
- `breaking`: learner stays pinned or explicitly restarts

Never silently reinterpret progress under a breaking version.
