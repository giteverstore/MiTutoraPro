# MI Coin Accounting

**Status: MVP non-cash coin rewards and durable streaks are code/policy activated; production deployment remains pending**

MI Coins are a virtual learning-reward asset. They are not INR, cash, stored monetary value, or a balance in the future referral wallet. No coin-to-money conversion exists.

## Authority boundary

Only trusted server code may mutate coin state. Browser state, local storage, compiler output, `completed` flags, and client-writable learning progress are not reward evidence. The repository intentionally exposes no endpoint that accepts a client-selected coin amount.

The server flow is:

```text
verified server principal
→ trusted activity completion evidence
→ versioned reward-policy lookup
→ global idempotency binding
→ Firestore transaction
→ immutable ledger entry + account projection + claim reward transition
```

Practice and Daily Challenge remain locally solvable. The MVP server boundary accepts only canonical activity identity and version after authentication. It never accepts UID, amount, balance, policy version, completion assurance, or a financial transaction type from the browser.

## Trust classes

| Class | Authority and permitted use |
|---|---|
| `LOCAL_VERIFIED_ACTIVITY` | Browser compiler/output validation. Low-trust MVP evidence eligible only for bounded non-cash game coins under a server-owned canonical activity and policy. |
| `SERVER_VERIFIED_ACTIVITY` | Future isolated Firecracker verification. High-trust learning evidence; currently `DEFERRED` and inactive. |
| `FINANCIAL_EVENT` | Future payment, referral, wallet, or withdrawal evidence. It requires a separate financial authority and must never derive solely from local verification. |

MI Coins are not financial ledger entries and cannot become money, withdrawal balances, referral cash, or payment credit.

## Account projection

`users/{uid}/coinAccount/summary` is server-written and owner-readable:

| Field | Contract |
|---|---|
| `availableBalance` | Non-negative safe integer |
| `lifetimeEarned` | Non-negative safe integer |
| `lifetimeSpent` | Non-negative safe integer |
| `revision` | Starts at zero and increases once per posted mutation |
| `createdAt`, `updatedAt` | Trusted server timestamps |
| `schemaVersion` | Account schema version |

An absent account means zero coins. The foundation does not import mock UI totals, fabricate history, or award retroactive coins.

## Immutable ledger

`users/{uid}/coinTransactions/{transactionId}` records `amount`, `direction`, `type`, `sourceType`, `sourceId`, `idempotencyKey`, `balanceAfter`, `accountRevision`, `policyVersion`, `status`, `createdAt`, `ownerUid`, and `schemaVersion`.

Amounts are positive safe integers. Direction and type are closed enums. Ledger entries are created in the same transaction as their account projection and are never updated or deleted by the service. Firestore rules deny all browser writes.

The internal debit primitive exists to prove non-negative balance and concurrency behavior. No spending or redemption product calls it yet.

## Completion and reward claims

`users/{uid}/rewardClaims/{claimId}` separates completion from payment:

- `completionStatus: COMPLETED` records trusted completion evidence.
- `rewardStatus: NOT_GRANTED | GRANTED` records whether a ledger credit exists.
- `evidenceReference` points at a bounded server-owned evidence record.
- `evidenceAssurance` is a closed trusted-verification classification.
- `rewardTransactionId` is null until an atomic reward transition succeeds.

MVP claim IDs bind the authenticated owner, activity type, canonical ID, activity version, reward-policy version, and—for recurring Daily Challenges—the canonical occurrence date. Repeated and concurrent identical claims collapse to one economic mutation. Practice and Daily Challenge call the authenticated completion boundary and display only its authoritative reward result.

## Idempotency and consistency

`coinIdempotency/{hashedKey}` is a server-private global replay binding. It stores a fingerprint of the exact mutation and its immutable ledger reference. The key is global so conflicting reuse across users also fails closed.

The account, ledger, replay binding, and optional claim transition are one Firestore transaction. Identical retries return the original transaction result without increasing balance or revision. Conflicting retries, insufficient balance, missing claims, missing policy, and inconsistent persisted state fail without partial writes.

## Reward policy

`CoinRewardPolicy` is the sole reward-amount authority. The approved `mvp-v1` type-wide policy grants 5 coins for the first successful completion of each canonical Practice `v2` activity, 20 coins for the first successful completion of each canonical Daily Challenge `v1` occurrence, and 1 coin for the first authenticated application visit on each `Asia/Kolkata` calendar day. Daily-login UID, date, amount, version, and claim identity are derived by the server; the client sends an empty claim request. Entries are enabled, versioned, typed, and positive safe integers; unknown versions and missing or disabled policy fail before ledger mutation. The browser cannot select the policy or amount, and there is no per-question reward variation.

Activity rewards, including Daily Login, have a concurrency-safe maximum of 100 credited coins per user per `Asia/Kolkata` platform day. `activityUsage.rewardCoinsCredited` is updated in the same Firestore transaction as account, immutable ledger, replay binding, and reward claim. A reward must fit in full: 95 + Practice credits 5, while 95 + Daily Challenge credits nothing. Cap refusal returns `daily_reward_cap_reached` without invalidating durable completion or streak reconciliation. This usage projection is an abuse-control counter; the immutable coin ledger remains the economic source record.

## Security rules

Authenticated users may read only their own account, ledger, and claims. They cannot create, update, or delete them. Replay bindings cannot be read or written by any browser client. Root user validation continues to reject injected balance or reward fields, and unmatched collections remain denied.

## Accepted MVP limitation

`LOCAL_VERIFIED_ACTIVITY` does not cryptographically prove that a learner genuinely solved code. An authenticated learner can bypass the UI and call the completion endpoint with a real canonical activity ID and version. The exposure is deliberately bounded to non-cash points by canonical publication checks, one reward per activity/version or challenge occurrence, daily submission/completion/reward-attempt limits, and the 100-coin daily credit cap. These events cannot authorize money, referrals, withdrawals, payments, or any other financial state.

The future Firecracker `SERVER_VERIFIED_ACTIVITY` path remains `DEFERRED`, has no public authoritative-judge endpoint, and is never invoked by the MVP reward flow. Its canonical runtime artifacts remain preserved for later high-assurance use.

## Durable MVP completion and streak integration

`users/{uid}/activityCompletions/{completionId}` is server-owned activity history. Identity binds owner, canonical type and ID, version, and Daily Challenge occurrence. Records contain no learner source or compiler output. Completion persists independently when rewards are disabled or unavailable, with finite `rewardStatus` and `streakStatus` fields providing a small idempotent reconciliation path.

`users/{uid}/streak/summary` is a server-owned projection derived from durable completion events, never coin transactions. `users/{uid}/streakEvents/{completionId}` prevents replay. MVP day boundaries use the documented platform timezone `Asia/Kolkata`; the browser cannot supply a date. First day produces one, another qualifying activity on the same day does not add a day, the next consecutive date increments, a gap resets current streak, and longest streak is retained. Older events never move the qualified date backward.

`users/{uid}/activityUsage/{yyyy-mm-dd}` contains only bounded counters, `rewardCoinsCredited`, and trusted timestamps. The server allows at most 120 completion submissions, 100 new completions, 50 reward-claim attempts, and 100 credited activity coins per platform day. Limits reject safely without creating an additional economic mutation. These are non-punitive MVP abuse bounds, not bans.

The orchestration order is durable completion/usage, idempotent streak reconciliation, then optional reward claim. A failed completion cannot credit coins. A later streak or reward failure leaves a durable pending status that the same logical request can safely reconcile without duplicating a completion, streak day, or ledger credit.

The shared fail-closed verification contract, current execution forensics, threat model, and remaining sandbox/content gates are documented in [Authoritative Activity Verification](./activity-verification.md).

## UI and reconciliation

The application shell reads `users/{uid}/coinAccount/summary` through the owner-readable repository and represents loading, zero, unavailable, and authoritative balances. Successful endpoint responses refresh the displayed balance; clients never sum completions or invent speculative coins. Practice and Challenge report finite states for credited rewards, already-rewarded activities, cap refusal, unavailable rewards, and pending reconciliation. Challenge streak cards read the durable current and longest streak projection. Same-day activity can reconcile an event without visually adding another streak day.

The orchestration is intentionally retryable: completion first, streak second, reward last. A transient post-completion failure leaves server-owned pending state. Repeating the same logical completion reconciles that state using stable completion, streak-event, claim, transaction, and idempotency identities. Stale retries cannot create a second economic mutation.

The browser completion client preserves the required native `Window`/global fetch receiver while retaining injectable plain-function fetch implementations for deterministic tests. Its relative `/api/activity/complete` URL resolves against the current origin, obtains the Firebase ID token through `AuthService`, and serializes only activity type, canonical ID, and activity version. Standalone `npm run dev` remains frontend-only. Run `npm run dev:full` for the supported coin smoke: it starts Auth, Firestore, and Storage emulators under the pinned `demo-mitutora-coins` project, seeds canonical current Daily Challenge metadata and Storage content, and starts Vite at `http://127.0.0.1:5173` with the same `createActivityCompletionHandler()` mounted locally. No reward logic is duplicated.

The full-stack middleware is disabled outside that command and fails closed unless the browser and server select the same pinned demo project and loopback emulators. Create a fresh learner through the normal email sign-up form; no coin account, completion, claim, or transaction is seeded. The missing account therefore renders as zero, while the real completion path creates the durable completion, streak, claim, ledger entry, and 20-coin balance. The deterministic seed generates the occurrence date using `Asia/Kolkata` and disables the local challenge fallback, preventing non-canonical content from receiving a reward. Stopping the command removes its isolated emulator working directory and development state.

An absent `coinAccount/summary` document is displayed as zero. The unavailable dash is reserved for an actual Firestore read failure, such as rules/configuration/connectivity failure; it is independent of the completion fetch call. The local repository rules permit an authenticated owner read, but those local rules are not activated in any remote environment until separately deployed.

## Financial separation

**COIN BALANCE IS NOT FINANCIAL BALANCE.** Coins are non-cash in-app reward points. No code path converts `coinAccount.availableBalance` to INR, wallet cash, withdrawal eligibility, referral commission, Razorpay credit, payment settlement, or guaranteed monetary discount. Referral and other future/mock product surfaces are separate and have no authority over the coin ledger. Redemption into explicitly reviewed in-app benefits is outside M2.
