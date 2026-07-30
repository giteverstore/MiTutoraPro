# Daily Challenges

Daily Challenges is an AppShell page under `src/challenges/`. It presents one challenge rather than a searchable catalog and remains independent from course and Practice state.

## Reused infrastructure

The problem statement is an ordered block array rendered by `BlockRenderer`. The single compiler block is normalized with `createCompilerData` and passed to the existing `CompilerPanel`, which continues through `CompilerManager`, the registered runtime, and the output validator.

Challenges does not implement an editor, runtime, terminal, or comparison function.

## Data contract

`schemas/daily-challenge.schema.json` references the Learning Engine’s existing block definitions. A daily challenge includes date, catalog metadata, motivation, reward values, and exactly one compiler block. The current mock document and history live in `src/challenges/challengeData.js`.

Run `npm run validate:challenge` to validate the current daily document.

## Completion flow

Running code produces runtime output. The learner must explicitly check that output. When the shared compiler reports `matched`, the page enables `Claim Reward`. Claiming changes the mock completion state, adds the displayed streak increment, and displays the completed state.

Verification and claiming are intentionally separate, and challenge completion does not alter Learning Progress or Practice state. A future repository should persist challenge claims, streaks, and history without coupling them to the Learning Engine.
