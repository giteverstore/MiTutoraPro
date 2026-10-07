# Phase 7: Project task progression

Canonical task-based Projects use the hierarchy `Project → Checkpoints → Tasks`. Legacy Projects without canonical `checkpointId` and `taskId` structures continue through the earlier checkpoint workflow.

## State and sequencing

Task statuses are `NOT_STARTED`, `IN_PROGRESS`, and `COMPLETED`. Successful verification is the transition to `COMPLETED`; a separate persisted `VERIFIED` state would duplicate that fact. Checkpoints are derived as `LOCKED`, `IN_PROGRESS`, or `READY`, and become persistently `COMPLETED` only after their cumulative validators pass.

Tasks unlock in authored order. A later checkpoint stays locked until the preceding checkpoint's cumulative validation succeeds. Completed tasks remain revisitable and editable. Editing code does not erase historical evidence; checkpoint and final validation are explicit regression gates.

## Persistence

Active project schema version 2 adds `activeCheckpointId`, `activeTaskId`, `taskProgress[taskId]`, `checkpointProgress[checkpointId]`, and `finalValidation`.

Evidence stores its timestamp, evidence format version, pass state, and at most 50 compact `{ validatorId, validatorType, status, passed }` records. Source trees and stdout/stderr are not duplicated in progress. The active workspace files remain authoritative.

Progress remains pinned to the selected language and published `contentVersion`. Resume must load that exact version; failure does not fall forward to ACTIVE. Changing language follows the existing destructive reset flow and clears task, checkpoint, final validation, and workspace state.

## Validation lifecycle

`Verify Task`, `Validate Checkpoint`, and `Verify Final Project` are explicit learner actions. They use `TrustedDescriptorExecutor` and the existing declarative validator registry. Empty or unsupported validator sets fail safely; validator-less tasks are not silently completed. Phase 7 does not add acknowledgement tasks because the current canonical content does not define a trusted acknowledgement policy.

Final completion requires every checkpoint to be completed and all final validators to pass. Failed cumulative or final validation preserves earlier completion history.

## Concurrency and compatibility

Firestore saves retain the existing revision transaction. A stale browser receives `projects/conflict` rather than overwriting a newer save. Older local records normalize missing progress fields to empty values. Firestore schema-v1 records can be read and are upgraded to schema v2 on their next successful save.

Reset returns to language selection semantics: `contentVersion` and all progression/workspace state are cleared when a new language attempt begins.

## Security and trust

Firebase rules restrict progress documents to their owner, enforce schema-v2 top-level fields, cap task/checkpoint maps, and preserve monotonic revisions. Canonical validator descriptors always come from the already-loaded pinned Project, never from progress documents.

Task verification currently runs in the browser using isolated compiler workers. It is useful learner feedback but is not server-authoritative grading; a determined owner can forge their own progress document. No certificates, rewards, or security-sensitive entitlement may rely on this state.

Validation messages render as React text, outputs are bounded by the existing executor, and persisted evidence excludes output. External AI payloads remain unchanged: task completion history and validation failures are not transmitted without separate data-sharing authorization.

## UI and accessibility

The Checkpoints panel exposes checkpoint counts and nested tasks with text labels for Completed, Available, and Locked states. Buttons are keyboard accessible, locked controls explain why they are disabled, and verification updates use an `aria-live` region. The existing responsive IDE grid remains unchanged.

## Recovery

Cloud reload restores task/checkpoint evidence and active IDs. Missing pinned published versions surface the existing safe delivery error and do not mutate progress. Legacy bundled Projects continue to use the former checkpoint validation path.
