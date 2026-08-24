# Batch 8 Python v2 Content Integrity Decision

**Decision:** **B — the local artifact is newer and is the intended canonical representation.** Production is a valid earlier rendering of the same learner-facing content, not corrupt bytes and not an unexplained manual edit.

## Evidence

The comparison downloaded `course-content/python/v2/module-1.json` through Firebase Admin in read-only mode and parsed both copies successfully.

| Property | Current local/generated artifact | Production object |
| --- | --- | --- |
| Bytes | 273,891 | 272,123 |
| SHA-256 | `11d3d3edf79ec6ee9fd5150d042f0da888228a5bf831fbdfa98b3e809bbc088f` | `30054d821def96a82ad94bc0e1e2928b3f389bdad17a1a1b8b735d1863c285ff` |
| Production generation | — | `1786946964862798` |
| Production updated | — | `2026-08-17T06:09:24.866Z` |
| Sections / lessons / blocks | 10 / 109 / 648 | 10 / 109 / 648 |
| First / last lesson IDs | `lesson-1-1-introduction-to-python` / `lesson-9-15-finish` | same |

All quizzes (20), exercises (18), solutions (18), compilers (63), code blocks (145), images (17), notes (10), and tables (2) have identical counts. A positional comparison found exactly 26 changed blocks and **zero learner-text mismatches**. The later converter changed 17 paragraphs and 9 headings into semantic `callout` blocks titled `Next step`; no lesson was added, removed, reordered, or rewritten.

Git history explains the timing:

- production object updated on 2026-08-17 at 06:09 UTC;
- the canonical CTA semantic conversion was committed in `4931918` on 2026-08-18 at 20:42 +05:30;
- the current generated module is clean relative to that commit and matches the course converter output contract.

Therefore the mismatch is a normal unpublished successor, not production corruption. The same `v2` path was reused across two representations, which created version ambiguity.

## Authority and hash decision

Do not overwrite production v2 and do not label the current local bytes as the hash of production v2. The production bytes can safely be hashed as the exact, legitimate object currently served, but only after the release decision records them as the historical/current deployed v2 artifact. Its correct hash is the production hash above.

The current local artifact should be published later as a new immutable version (recommended `v3`) and validated before switching Firestore metadata. Reusing `v2` again would preserve the ambiguity and undermine hash-based publication controls. Once v3 is active, production v2 can remain as a hashed historical object with an explicit non-active state if the publication protocol supports that state. This task does not publish, relabel, or activate either copy.

## Safe migration sequence

1. Freeze and validate the current canonical local course bundle.
2. Generate a new versioned `v3` bundle without changing lesson IDs or course ID.
3. Dry-run the publication protocol and record manifest/module hashes.
4. Publish v3 objects as non-active/staged content.
5. Read back bytes and hashes.
6. Atomically update `courses/python` to v3 using the existing publication protocol.
7. Verify all 109 lessons, trusted-completion manifest derivation, and rollback pointer.
8. Migrate Storage custom metadata for the verified active set, including the exact bytes of any version that remains served.
9. Only after every served object has `publicationState=ACTIVE` and a verified SHA-256 may the checked-in Storage rules be deployed.

No object deletion is part of this plan. The ten unreferenced Python v1 objects remain untouched pending a separate retention decision.

## Reproducible read-only audit

```powershell
$env:FIREBASE_PROJECT_ID = 'mi-tutora-pro'
node scripts/compare-production-python-v2.mjs
```

The script reports hashes, shape/count summaries, and property paths only. It does not dump learner content or mutate Firebase.

## Status

MIT-023 remains **PARTIALLY RESOLVED**: the cause and authority decision are established, but no new immutable course version has been published and production remains unchanged.
