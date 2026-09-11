# Withdrawal reservation foundation (M7.1)

The server-owned `m7-v1` policy permits INR withdrawal requests of at least 50,000 paise (₹500). Only integer-paise `availableBalanceMinor` in the M6 wallet is eligible. M5 calculated rewards, qualified referrals that have not been financially settled, Premium entitlements, development grants, and MI Coins are not withdrawal value.

A request atomically moves value from AVAILABLE to `reservedBalanceMinor`, creates a `PENDING` document at `users/{uid}/withdrawals/{withdrawalId}`, appends an immutable `WITHDRAWAL_RESERVED` ledger movement, and creates internal replay state. The authenticated UID is server-derived. The request accepts only `amountMinor` and `requestId`; the client cannot select currency, owner, status, policy, balances, or ledger fields.

Terminal states are `PAID`, `FAILED`, and `CANCELLED`. FAILED/CANCELLED append `WITHDRAWAL_RELEASED` and return RESERVED to AVAILABLE. PAID appends `WITHDRAWAL_PAID` and consumes RESERVED. Historical ledger entries are never edited. Exact transition replays are idempotent and all other terminal transitions fail closed.

No real payout authority exists in M7. Production withdrawal requests therefore remain disabled and the UI honestly says “Withdrawals are coming soon.” Synthetic PAID/FAILED/CANCELLED transitions require explicit opt-in plus test/development mode, a loopback Firestore Emulator, and a `demo-*` project. They are not payment, bank, UPI, or Razorpay evidence and have no browser callable.

Coins and M5 calculated or qualified referral rewards are never withdrawal authority. Only an M6 trusted settlement can credit AVAILABLE wallet INR, and only AVAILABLE can move to RESERVED. PENDING means funds are reserved, not paid. A future M8 payment/payout integration must supply trusted external payout authority and reconciliation before production withdrawal creation can be enabled.

The wallet continues to use INR integer paise with PENDING, AVAILABLE, and RESERVED projections. PENDING is reserved for real provider semantics if M8 requires it. Reconciliation explains AVAILABLE and RESERVED using immutable referral-credit, reservation, release, and paid movements and can detect projection or pending-withdrawal mismatches. M7.2 will perform final withdrawal security and end-to-end acceptance; future payout integration must provide real trusted authority.

M8.2 adds a separate provider-backed path without changing legacy M7 records. Each new request supplies a transaction-specific UPI ID; only a masked destination is retained in normal history. Reservation and a server-only payout outbox are atomic. INITIATION_PENDING, PROCESSING, and UNKNOWN keep funds RESERVED. PAID consumes RESERVED, while a verified later REVERSED event appends compensation and restores AVAILABLE exactly once. No provider or transient full-VPA persistence exists yet.

## M8.8 MVP freeze

`M8.8_IMPLEMENTATION = COMPLETE`, while `M8.8_PROVIDER_E2E = DEFERRED_BUSINESS_REGISTRATION`. MiTutora is not currently eligible for RazorpayX onboarding. Subscriptions and referrals remain enabled, referral earnings remain visible as INR wallet value, and coins remain separate. Withdrawals are `COMING_SOON` and production withdrawal creation is server-side disabled. Both legacy and provider-backed withdrawal services require an explicit test/development opt-in, a loopback Firestore Emulator, and a `demo-*` project; production calls fail before creating a withdrawal, reservation, ledger entry, outbox, or provider request.

Future activation requires business eligibility, completed RazorpayX onboarding, TEST credentials and source account, a controlled TEST payout E2E, provider-verified reconciliation, genuine webhook verification or an approved recovery strategy, fixed outbound egress allowlisted for Live APIs, and a separately approved production enablement release.
