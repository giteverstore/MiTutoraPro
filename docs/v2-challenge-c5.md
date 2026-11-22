# V2 Daily Challenge C5

The learner staging backend owns assignment orchestration. `GET /api/v2-pilot/challenges/daily/today` authenticates the learner, calculates the current `Asia/Kolkata` date on the server, and performs an idempotent get-or-create operation. The browser supplies no policy, candidate, reward, restriction, or date authority.

Assignments live at `dailyChallengeAssignments/{YYYY-MM-DD}`. Their `assignmentId` is `{challengePolicyId}:{YYYY-MM-DD}`. A separate `dailyChallengeAssignmentAudits/{YYYY-MM-DD}` record stores selection evidence; the assignment DTO contains only the immutable C2 contract.

The service reads the exact configured public Policy version directly and retrieves the canonical safe Practice candidate projection from the service-authenticated Editor gateway. That projection is produced by the same C4 `adaptPractice` readiness path. C5 therefore neither queries/lists Firestore nor maintains a hand-configured candidate universe. Before an absent assignment is created, one Firestore transaction rechecks the Policy pointer/version and every projected candidate pointer/version guard. A changed lifecycle, pointer revision, or immutable version hash fails with `v2/challenge-assignment-stale-context`; a caller may resolve again. Once an assignment exists, historical retrieval returns it without re-evaluating later Policy or Practice lifecycle state.

Preview configuration:

- `V2_CHALLENGE_PILOT_ENABLED=true`
- `V2_CHALLENGE_PILOT_UIDS=<staging learner UID allowlist>`
- `V2_CHALLENGE_POLICY_CONTENT_ID=7df3971d-fefe-4205-8554-5e177fec5412`
- `V2_CHALLENGE_POLICY_VERSION=1`
- `V2_CHALLENGE_SERVICE_AUTH_MODE=staging-wif`
- `V2_CHALLENGE_SERVICE_ACCOUNT_EMAIL=ycoders-challenge-staging@ycoders-v2-staging.iam.gserviceaccount.com`

The Challenge identity needs direct entity `get` and `create` only for C5. It has no list, query, update, delete, Storage, Firebase Auth, Token Creator, key, or broad project role. The existing WIF audience remains unchanged.

C5 creates no completion, reward, streak, learner Practice DTO, or server-side execution state.
