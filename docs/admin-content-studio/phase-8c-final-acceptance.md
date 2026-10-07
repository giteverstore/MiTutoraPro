# Phase 8C cross-content acceptance checkpoint

Projects, Courses, and Practice share the canonical outer envelope (`contentId`, `contentType`, `schemaVersion`, `version`, `status`, `locale`, `metadata`, `content`) and `ContentPublicationService`. Their inner schemas, learner adapters, and progression models remain separate. The Admin cloud repository now carries an explicit content type; the server rejects a mutation when that request type disagrees with either the draft record or canonical payload. A typed Admin editor also refuses to load a draft of another type. Existing drafts remain in the shared store: Projects and individual Practice questions are one document each, while Courses are rehydrated from segmented module documents behind the same repository interface.

The cross-content contract test publishes all three fixtures in one store, verifies type-filtered ACTIVE listings, immutable SHA-256 artifacts, independent v2 activation and v1 rollback, retained v2 artifacts after archive, and typed audit entries. Artifact paths are type-separated (`published-content/{projects|courses|practices}/{contentId}/vN.json`). The store uses `contentId` as its pointer/draft key, so IDs must remain globally unique across types; trying to reuse an existing ID with another type fails with `content/type-conflict`. This is a current namespace constraint, not support for same-ID items of different types.

Version models intentionally differ:

| Type | Learner behavior |
| --- | --- |
| Project | A long-running attempt pins `contentVersion` and resumes that exact artifact. |
| Course | Enrollment/progress pins `contentVersion`; an enrolled learner resumes the exact artifact. |
| Practice | A solve records the question version; unsolved/new usage resolves ACTIVE and historical solves are not rewritten. |

Archive removes items from new discovery. Exact artifacts remain available for pinned Project/Course learners and historical Practice reference where authorized. Bundled legacy items remain available when no canonical publication supersedes their ID. No bulk migration is performed.

Representative compact fixture draft sizes measured locally on 2026-10-05: Project 5,841 bytes, Course 2,178 bytes, Practice 896 bytes. Real Python and Java Course adapter measurements and the reason for segmented Course drafts are in the Phase 8 authoring document. The draft/artifact limits remain 850,000/4,000,000 bytes. Image asset references are checked before publication; missing registered assets block it. A complete media-manager UI is not part of this phase.

Admin Course Preview displays navigation, blocks, quiz feedback, and compiler configuration but does not run compiler exercises. Admin Practice Preview executes real Python in a Worker with same-origin pinned Pyodide assets; Java/C++ Preview runtime browser acceptance remains unverified. Projects retain their existing Guide/task/validator preview. No preview writes learner progression.

The Dashboard separates Project, Course, and Practice draft counts. Its present labels count draft lifecycle state versus published drafts, not authoritative ACTIVE versus ARCHIVED pointers; do not interpret those numbers as a complete publication-status breakdown.

Security boundaries remain server-side: centralized roles gate draft mutation, validation, and publication; browser writes to drafts, publication metadata, audit, and immutable artifacts are denied by rules. Published artifacts do not contain Admin service credentials. Test fixtures carry `testOnly` metadata and are supplied only by tests, not production catalogs. Public expected-output Practice validation remains learner-visible by design and is not a hidden-test security boundary.

## Validation and remaining sign-off limits

The Phase 8C shared contract suite, focused content suites, Admin unit suite, Firestore content rules, and Storage content rules pass. Project, Course, and Practice Admin authoring browser smoke, Admin navigation, and real Python Practice Preview pass. All six combined authenticated Project/Course/Practice learner browser assertions pass. A separate authenticated browser catalog test publishes all three fixtures together and confirms they appear only in the appropriate Projects, Library, and Practice catalogs. An initial combined run found that Course's per-file `afterAll` terminated the Firebase Admin client shared by Practice and Projects; the per-file termination was removed, and the combined rerun passed. The older generic structured-editor desktop drag/drop and mobile palette browser tests fail; they are not part of the specialized Project/Course/Practice editors but prevent an unqualified Admin UI sign-off. Root Playwright's Windows process still remained alive after reporting passing assertions and required manual interruption. WMI process inspection was denied in this environment, so the precise remaining shutdown handle is not proven.

The three content types are functionally integrated. Final release sign-off remains conditional on the generic structured-editor browser failures and clean E2E harness teardown (or explicit acceptance of those limitations). No Course Preview compiler feature, Bingo, deployment, or content migration was added.
