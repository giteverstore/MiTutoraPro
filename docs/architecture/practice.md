# Practice

Practice is an AppShell product page under `src/practice/`. Its reusable catalog, filters, cards, detail workspace, bookmarks, progress display, Monaco editor, shared compiler dock, repositories, schemas, loading states, and error boundaries remain available.

## Current content state

The finalized learner-safe Q250 bank is bundled through `src/practice/practiceData.js`: 250 stable questions, 750 examples, 750 public fixtures, 750 progressive hints, and 2,250 starter templates across nine languages. The checked-in v3 Firebase payload is prepared and hash-validated but has not been published.

Until a separately reviewed Firebase activation publishes Q250, the runtime source is explicitly the bundled local catalog. This prevents deleted legacy Production records from reappearing. Daily Challenges remain content-empty and are not automatically populated from Q250.

The archive-to-Practice mapping is reproducible through `scripts/import-q250-practice.mjs`. Learner Markdown supplies statements, constraints, examples, hints, complexities, and starters; learner fixture/contract JSON supplies public fixtures and execution/serialization metadata. Internal reference solutions, hidden fixtures, hashes, reports, and oracle implementations are not imported.

## Production data migration note

This ingestion does not delete Firebase user progress, bookmarks, submissions, or Production content documents. Existing `BLIND150-*` records can naturally reconnect where IDs match exactly. Deleted non-Q250 identifiers remain orphaned until a separately reviewed migration policy maps or archives them. Q250 publication and activation are separate future operations.
