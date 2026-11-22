# V2 Practice P6 persistence contract

P6 stores workspace and completion state at `users/{uid}/v2PracticeState/v2_practice_{contentId}_version_{publicationVersion}`. Selected language, per-language drafts, bookmark state, solved state, immutable execution fingerprints, reward outcome, revision, and timestamps are publication-version-specific. Workspace updates use optimistic revisions and cannot clear server-owned completion fields.

The browser runs all public tests. A successful Run submits only immutable identity fingerprints, ordered public-test IDs, an outcome summary, language, execution mode, and a request ID. The backend reloads the exact immutable publication, reproduces both fingerprints, validates the complete ordered test set and result structure, and never receives or executes learner source as completion proof.

The existing Practice reward is 5 coins. Solved state is version-specific, while reward eligibility is the first solve per learner and Practice content ID across every publication version. Reward replay identity intentionally excludes `publicationVersion`, preventing historical-version farming. Later versions can become solved without another coin credit.

Legacy `/practice/:questionId` persistence is unchanged. Course progress, the learner delivery gateway, Editor delivery, publication state, and production resources are outside this boundary.
