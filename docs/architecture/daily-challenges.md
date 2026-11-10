# Daily Challenges

Daily Challenges remains an AppShell feature under `src/challenges/`. The hub, calendar, history, rewards, completion state, Challenge Pass behavior, routing, content service, rotation policy, and shared compiler workspace remain intact.

## Current content state

The standalone legacy coding challenge and checked-in assignment metadata were removed before the unified Q250-backed question bank is imported. The challenge content source is temporarily gated to an empty catalog and does not fall back to bundled coding content.

The Challenges route remains functional and reports that today's challenge is unavailable. Direct challenge routes fail safely through the existing unavailable state. No replacement or placeholder challenge is bundled.

The generic challenge schema, repository/service, assignment generator, calendar/reward infrastructure, and Practice-reference model remain available for future publication.

## Production data migration note

No production Daily Challenge records, completions, streaks, unlocks, or rewards were deleted by this repository cleanup. Old published assignments and user records may require a later migration or archival policy before the unified bank is activated.
