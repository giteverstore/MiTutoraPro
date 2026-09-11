# Provider-independent payment and payout foundation (M8.2)

M8.2 introduces financial models and state machines without connecting a payment or payout provider. MiTutora Premium remains a manually purchased, fixed-duration product. `SubscriptionPlans.js` is the sole authority for INR price and calendar-month duration. There is no recurring billing and no Razorpay Subscriptions integration.

## Payment authority

The browser may request an order using only a canonical `planId` and request identity. `paymentOrders/{internalOrderId}` stores the server-resolved owner, plan version, integer-paise amount, currency, provider name, and state. Client price, currency, duration, UID, expiry, payment status, and entitlement fields are rejected.

Payment states are `ORDER_CREATED`, `AUTHORIZED`, `CAPTURED`, `FAILED`, `PARTIALLY_REFUNDED`, `REFUNDED`, `DISPUTED`, and `REVERSED`. Explicit transition rules reject stale regressions. Same-state evidence is harmless, while immutable `paymentEvents/{eventId}` records and deterministic fingerprints make identical replay idempotent and conflicting reuse fail closed.

`PaymentProvider` defines order creation, Checkout and webhook verification, provider Payment/Order/Refund fetches, and normalized canonical-evidence retrieval. The default provider always fails closed. Webhook processing requires raw bytes and delegates signature verification to the provider adapter before normalized evidence reaches `PaymentService`. No raw provider body, signature, or secret is persisted.

Only a canonical `CAPTURED` payment can reach `PaymentActivationCoordinator`. It reloads the payment rather than accepting monetary or entitlement claims. `SubscriptionService.activateFromVerifiedPayment()` reuses the M3 calendar extension behavior and creates exactly one `PAYMENT` subscription per payment through `paymentActivations/{paymentId}`. `DEVELOPMENT_GRANT` remains a separate emulator-only path.

## Referral financial state

A captured payment supplies the existing M5 `VERIFIED_PREMIUM_PURCHASE` evidence. Qualification still happens at most once per referred learner and freezes the referrer's 10% Free or 15% Premium rate. Qualification does not make money withdrawable.

M8 adds an explicit immutable `REFERRAL_REWARD_PENDING` wallet entry and increments `pendingBalanceMinor`. M8.4 adds provider-independent `paymentSettlementEvidence` and an atomic release coordinator. Production release fails closed until `releaseDelayDays` is explicitly configured; no cooling duration is inferred. A trusted settled event moves PENDING to AVAILABLE without changing total credited value. Existing M6 synthetic settlement behavior remains emulator-only and unchanged.

`purchaseOrchestrations/{paymentId}` records completed downstream consequences, while the canonical payment stores its subscription ID, activation time, and resulting expiry. These links complement the existing `paymentActivations/{paymentId}` replay boundary: callbacks, webhooks, reconciliation, and crash retries converge on one subscription, one referral qualification, and one pending reward.

M8.5 freezes financial policy `m8-v1`. A trusted provider settlement becomes releasable exactly seven calendar days after its authoritative event time, provided the payment remains captured or partially refunded and is not disputed or reversed. The browser clock is never used.

Partial refunds retain the original Premium duration but reduce referral eligibility to `floor((originalAmountMinor - cumulativeRefundedAmountMinor) * frozenRateBps / 10000)`. Pending value is reduced through immutable `REFERRAL_REWARD_ADJUSTED` entries. A full refund or reversal while pending appends `REFERRAL_REWARD_REVERSED`, removes the remaining eligible amount from PENDING and lifetime credited, and preserves the original pending entry.

Full refunds invalidate only the Premium authority backed by that payment. Active disputes temporarily suspend that purchase's authority; dispute resolution can restore it. `recomputePremiumEntitlement(uid)` derives the projection from every active, unexpired authoritative subscription and its payment, so another captured or partially refunded purchase can preserve Premium.

An active dispute blocks pending release and marks an already-released reward for review. A later refund, reversal, or dispute-loss event creates immutable `REFERRAL_CLAWBACK_REQUIRED` value without reducing AVAILABLE or producing a negative balance. Future referral releases create `REFERRAL_CLAWBACK_OFFSET` entries first; only the remainder becomes AVAILABLE. Non-referral funds are never offset.

`PaymentReconciliationService` is a bounded provider-neutral seam. A repository supplies unresolved records and a provider adapter supplies trusted canonical evidence; the service records that evidence idempotently and resumes captured-purchase orchestration. It has no scheduler and makes no provider call unless an adapter is explicitly supplied by a caller.

## Payout and withdrawal lifecycle

`PayoutProvider` defines destination validation, Contact/Fund Account creation, payout creation, payout fetch, and webhook verification; its default implementation fails closed. M8.7 supplies the RazorpayX adapter, canonical idempotency, raw-body webhook verification, and Fetch Payout reconciliation. Production remains disabled because Live RazorpayX payout APIs require allowlisted fixed egress; see `razorpayx-payout-provider.md`.

Every new provider-backed withdrawal accepts a transaction-specific UPI ID. It is normalized and masked in memory. Normal history stores `destinationType=UPI` and a masked form such as `a******@upi`; the full VPA is not stored in the withdrawal, replay record, outbox, ledger, or error. Idempotency binds it with a server-keyed HMAC so neither the full VPA nor an unkeyed destination digest is persisted. There is no saved payout method or profile destination. Provider validation and transient encrypted destination handling remain later gates.

Reservation atomically creates the withdrawal, moves AVAILABLE to RESERVED, appends `WITHDRAWAL_RESERVED`, and creates `payoutOutbox/{withdrawalId}`. The outbox holds only internal identifiers and a deterministic future provider idempotency key. It cannot yet execute because no provider or transient destination store exists.

Provider lifecycle states are `INITIATION_PENDING`, `PROCESSING`, `UNKNOWN`, `PAID`, `FAILED`, `CANCELLED`, and `REVERSED`. PROCESSING and UNKNOWN retain RESERVED funds. FAILED and CANCELLED release RESERVED exactly once. PAID consumes RESERVED with an immutable `WITHDRAWAL_PAID` entry. A later PAID-to-REVERSED event creates a separate immutable `WITHDRAWAL_REVERSED` compensation and restores AVAILABLE exactly once; the historical paid entry is never changed or deleted.

## Security and compatibility

Firestore rules explicitly deny all browser access to payment orders, canonical payments/events, activation records, payout webhook events, outbox records, and reconciliation records. Existing user-scoped subscriptions, entitlements, wallets, ledgers, and withdrawals remain owner-readable and client-write-denied. Legacy M3–M7 records remain readable; no destructive migration is performed. MI Coins remain non-cash and never enter payment, wallet, or payout accounting.

Planned production providers are Razorpay Payment Gateway for one-time purchase orders and RazorpayX for UPI payouts. M8.2 contains no SDK, API route, credential, real webhook, provider request, payment, payout, deployment, or production mutation.
