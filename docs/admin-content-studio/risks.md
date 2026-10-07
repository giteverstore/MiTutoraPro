# Risks and edge cases

| Severity | Risk | Mitigation |
|---|---|---|
| Critical | UI-only authorization permits unauthorized publish | Server claim/permission checks, deny direct writes, negative rule/API tests. |
| Critical | Authored validator code executes unsafely | Declarative descriptors and allowlisted versioned registry; isolated runtimes only. |
| Critical | Partial publish activates corrupt/missing artifacts | Immutable upload/hash/READY/activate; pointer references READY only. |
| Critical | Stored XSS via rich text/media | No raw HTML/CSS; constrained AST; sanitization; CSP; SVG policy. |
| High | Progress changes meaning after content update | Pin version; compatibility class and explicit ID migration map. |
| High | Schema/renderer drift breaks old content | Shared contracts, minimum renderer version, migration fixtures, multi-version readers. |
| High | Hidden validator/solution leaks through AI/public artifact | Protected artifact separation and server-side context assembly. |
| High | Incomplete language variant publishes | Full resolution matrix for each language/task. |
| High | Deleted media breaks published versions | Immutable referenced media, reference graph, retention. |
| High | Concurrent autosaves overwrite edits | Part-level optimistic revisions, conflict/fork UI, no last-write-wins. |
| High | Firestore 1 MiB exceeded by deep projects | Split by checkpoint/module; budgets well below hard cap. |
| High | Rewards become client-authoritative | Server resolves canonical published activity and applies policy caps. |
| Medium | Preview differs from learner | Same normalizer/primitives and parity fixtures; preview has no trusted effects. |
| Medium | Stale catalog cache after publish/rollback | Immutable URLs, versioned pointers, short metadata TTL, invalidation. |
| Medium | AI context grows with 17 tasks | Task-local deterministic budgets and structural truncation. |
| Medium | Regex validator ReDoS/false confidence | Safe bounded patterns; prefer AST/behavior; label heuristic checks. |
| Medium | Orphan drafts/media/storage grow | lifecycle state, reference graph, grace-period janitor, quotas. |
| Medium | Admin dependency leaks into learner build | separate builds and enforced import boundaries. |
| Medium | Rollback conflicts with active learners | preserve pinned artifacts and validate rollback compatibility. |
| Low | Reorder changes progress identity | stable IDs independent of array order. |
| Low | Drag/drop excludes keyboard users | move controls, outline navigation, announcements, focus restoration. |

## Operational cases

- Publish retry after timeout: idempotency key and immutable hash return the same result.
- Role removed mid-session: every mutation reauthorizes; token refresh/revocation closes access.
- Validator implementation retired: retain its registry version until a compatible replacement is proven.
- Content archived with active learners: hide new starts, preserve pinned reads.
- Asset upload succeeds but draft save fails: unreferenced asset becomes eligible after grace period.
- Referenced content changes: pin dependency version or revalidate the exact active dependency at publish.

## Pre-launch proofs

Authorization bypass tests, publish failure injection, XSS corpus, language completeness, task-progress migration, protected evidence/AI leakage, rollback with pinned learners, and Bingo size/performance tests are release blockers.
