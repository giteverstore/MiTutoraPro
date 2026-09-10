# Premium access gating

M4.1 uses the M3 entitlement and backing subscription as its only tier authority. The centralized policy exposes three canonically ordered lessons per course to Free learners. Practice, Daily Challenges, coins, streaks, bookmarks, account, Home, catalog browsing, Settings, and pricing remain Free. Later course lessons, Projects, AI Tutor, and Certificates require Premium.

## Boundary inventory

| Surface | Delivery | M4.1 boundary |
| --- | --- | --- |
| Course catalog and lessons | Local/Firebase Storage content rendered by the client | Canonical lesson-order application gate |
| Lesson compiler | Client compiler inside the gated lesson workspace | Inherits lesson gate |
| Practice and Daily Challenges | Firestore metadata, Storage content, client compiler | Explicitly Free |
| Projects | Existing client-side project surface | Client feature gate |
| Certificates | Firestore/Functions-backed existing surface | Client entry gate plus authoritative Premium checks on learner certification callables |
| AI Tutor | Vercel API, Firebase Auth, Firestore quota, external provider | Client upgrade state plus server entitlement check before quota/provider |
| Bookmarks, Home, Settings | Client/Firestore application surfaces | Explicitly Free; bookmarked lessons still converge on the lesson gate |

Every lesson entry path—direct URL, sidebar, next/previous navigation, bookmark, Continue Learning, refresh, and browser history—converges on the current lesson selected by `CourseLoader`. The gate derives the lesson index from the canonical course structure, not the URL or a client-supplied index. Locked lessons do not mount the learning workspace and therefore cannot be visited or completed through that route.

The browser entitlement context resolves loading and errors as Free and never persists Premium in local storage. Refreshing the entitlement observes a new grant or expiry. The API authenticates first, resolves Premium from `users/{uid}/entitlements/premium` and its referenced ACTIVE subscription in the default Firestore database, and only then constructs quota/provider execution.

## Learner-facing server inventory

- `POST /api/ai/explain` authenticates, checks the authoritative Premium entitlement and matching subscription, and only then constructs quota/provider execution.
- Every learner certification callable (`getCertificationStatus`, `getExamAttempt`, `getCandidateExam`, `createExamAttempt`, verification, lease, heartbeat, response/integrity save, submit, and abandon) uses the shared `premiumGuarded` wrapper before its abuse guard and operation.
- Trusted lesson-evidence callables remain authenticated but Free because the first three lessons are part of the Free learning loop. Reviewer-only and scheduled certification operations retain their existing role/system boundaries.
- Projects currently have no learner-facing server endpoint; the existing browser workspace is protected by the centralized application gate.
- The emulator-only subscription grant is pinned to the demo project, both explicit local-stack flags, and the loopback Firestore emulator. Production receives a fail-closed 404 without evaluating grant input.

## Production entitlement-read prerequisite

The production Vercel workload impersonates `ai-tutor-runtime@mi-tutora-pro.iam.gserviceaccount.com` through an exact-subject Workload Identity binding. `PremiumAccessGuard` explicitly opens `mi-tutora-pro/(default)` and `SubscriptionService` reads the entitlement plus its referenced subscription there. A read-only IAM inventory on 2026-09-10 found only `aiTutorAuthVerifier` (`firebaseauth.users.get`) and the conditionally scoped `aiTutorQuotaWriter` role for `ai-tutor-quota`; it did not establish entity-read permission on `(default)`. Therefore the entitlement read is **UNVERIFIED — DEPLOYMENT PREREQUISITE**. Before a future deployment, prove or narrowly grant read access to the two required paths without broadening quota, Auth, Storage, or application permissions. No IAM mutation was made for M4.

## Static-content limitation

Client gating is not content confidentiality. Content already bundled into JavaScript or downloaded into the browser can be inspected by a motivated user. Strong confidentiality would require authenticated server-side content delivery and is intentionally outside M4.1. No payment, checkout, referral, or content migration is introduced.

Application Premium gating is **ENFORCED**. Client-bundled course-content confidentiality is **NOT GUARANTEED** and is an accepted MVP limitation. Existing Storage rules publish active course JSON to clients and do not claim to make Premium lesson bytes confidential.
