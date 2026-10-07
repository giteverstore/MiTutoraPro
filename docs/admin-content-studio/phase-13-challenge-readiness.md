# Challenge authoring and migration readiness

The learner experience is date/assignment driven. `dailyChallenges/{id}` metadata supplies the occurrence date, published flag, activity version, difficulty, and display rewards. An assignment can reference a Practice question (`practiceQuestionId`) or a legacy Storage artifact (`storagePath`). The Challenge hub, Today card, history, and Home calendar read this metadata. The workspace uses the shared compiler and local output comparison before enabling Save Completion; it has no AI control. Recovery passes, streaks, and coins use existing services. The server trusts the daily assignment and reward policy, **not** a published artifact's `reward` field.

## Current inventory

The checked-in dedicated inventory has one published Firestore record and one matching Storage JSON artifact: `challenge-balanced-brackets`, dated `2026-08-01`, Python, medium, Stacks, 18 minutes, 20 displayed coins, 50 legacy XP, normalized expected output `Balanced`, stdin `{[()]}`. `src/challenges/challengeData.js` duplicates it as a development fallback and includes five display-only history rows and mock statistics. Daily rotation is a separate generator over eligible Practice questions, weighted easy/medium/hard 40/40/20; it emits date-keyed assignments with Practice references and a fixed 20-coin policy. It is not a Challenge catalog.

| Legacy source | Canonical Challenge field | Admin editable | Learner mapping / loss |
| --- | --- | --- | --- |
| Inner `schemaVersion` | Envelope `schemaVersion` | No | Contract version retained in envelope |
| `id` | `challengeId`, envelope `contentId` | Stable after create | `id`; none |
| `date` | `date` | Yes | Daily occurrence match; none |
| `title`, `summary`, `motivation` | Same | Yes | Same; none |
| `language`, `difficulty`, `topic`, `estimatedMinutes` | Same | Yes | Same; language normalized to canonical ID |
| `reward.coins`, `reward.streakIncrement` | Same | Visible, fixed to server policy (20/1) | Display only, not entitlement authority |
| Non-compiler `blocks` | `blocks` | Yes, shared block editor | Same for supported types |
| Compiler `starterCode`, `stdin`, `expectedOutput`, `validator` | Top-level `starterCode`, `stdin`, `verification` | Yes | Compiler block reconstructed; `normalized` maps to `normalized-lines` |
| `rewardXp` in Firestore metadata | Daily assignment metadata | No | Assignment/reward pipeline; not embedded in canonical Challenge |
| `practiceQuestionId` | Daily assignment metadata | No | Existing Practice reference path; not migrated into a Challenge artifact |
| `storagePath`, metadata `version`, `published` | Publication/assignment metadata | No | Existing legacy fallback retained |

## Delivery and version boundary

Published canonical Challenge artifacts are immutable and available through the generic publication API. A daily occurrence is **not** created by publication. A separate Admin-only assignment action creates a date-keyed document after checking the ACTIVE pointer, rejecting occupied/past dates, and pinning `canonicalContentId` plus numeric `canonicalVersion`. It fixes the daily activity version to `v1` and reward to 20 coins from server policy. The learner repository retrieves that exact artifact, validates the canonical type, and checks its date/difficulty against the assignment. Today/future archived canonical content is excluded from discovery; historical assignments can still resolve an immutable version. Legacy Practice references and Storage artifacts remain unchanged.

Publishing v2 does not rewrite a date assignment. New v2 delivery requires a new occurrence whose date is authored in the immutable v2 artifact. The server reward policy currently recognizes daily activity `v1`; artifact v2 does **not** imply daily activity `v2`. Completed records remain keyed to their original occurrence/activity version. No browser-authored reward field is promoted to entitlement authority.

The publication **ACTIVE** pointer selects a canonical version; it does not make that dated artifact eligible for every future day. For example, if v1 contains Date A and v2 contains Date B, rollback from v2 to v1 leaves Date A pinned to v1 and Date B pinned to v2. On Date C, the assignment service still derives Date A from v1 and rejects it as past (or rejects an already occupied Date A); it cannot create a Date C assignment from that artifact. Serving v1-equivalent content on Date C requires authoring a new immutable version whose own date is Date C. Completion records retain daily activity identity/version `v1`; the canonical version is recovered through the immutable date assignment, not stored as the completion's activity version. Archive removes current/future discovery but preserves assigned historical artifacts, completions, and reward history.

## Open acceptance boundary

The Admin can explicitly assign a new ACTIVE Challenge to an unoccupied current/future date, but the existing bulk generator only rotates Practice questions. Assignments are immutable here; a v2 artifact for an already-assigned date will not silently replace v1. The server also records `LOCAL_VERIFIED_ACTIVITY`: local code execution and output matching provide learner feedback, but a hostile client can attempt completion without server-side code proof. The server controls reward issuance through the existing completion and coin policy; this is not anti-cheat-grade authoritative assessment. This pre-existing limitation is not fixed by authoring. Hostile-client verification and migration of already-occupied dates require separate design before claiming full Phase 13 acceptance. No production Challenge migration was performed.
