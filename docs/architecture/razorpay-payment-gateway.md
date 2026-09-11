# Razorpay Payment Gateway

M8.3 integrates Razorpay Payment Gateway for fixed-duration, one-time Premium purchases. Razorpay Subscriptions, recurring billing, auto-renewal, RazorpayX, and payout execution are not part of this phase.

## Authority chain

`SubscriptionPlans` is the monetary and duration authority. An authenticated browser submits only `planId` and `requestId`. The server persists `paymentOrders/{internalOrderId}` before attempting `POST /v1/orders`, derives amount/currency/receipt itself, and links the returned provider order through `paymentOrderLookup`. A provider call with an ambiguous outcome leaves the order `UNKNOWN`; an automatic retry cannot create another charge opportunity.

Checkout receives only the public key ID, provider order ID, canonical amount/currency, and display plan. Browser success is never Premium authority. `/api/payments/verify` authenticates the learner, binds ownership to the internal order, verifies `HMAC-SHA256(serverOrderId|paymentId)`, fetches the payment and order, and fulfills only when payment is `captured`, order is `paid`, and both match the canonical plan.

`/api/payments/razorpay-webhook` has no learner authentication. It requires `X-Razorpay-Signature` over the exact bounded raw request bytes using the separate webhook secret. Only `payment.captured`, `payment.failed`, and `order.paid` are accepted. `x-razorpay-event-id` provides immutable replay identity. Provider events may arrive out of order; the canonical payment state machine rejects unsafe regressions.

The resulting chain is: canonical plan → internal order → Razorpay order → verified provider evidence → canonical `CAPTURED` payment → idempotent Premium activation → first-purchase referral qualification → financial reward `PENDING`. The adapter never writes subscriptions, entitlements, referrals, or wallet projections directly.

## Configuration and privacy

Server-only variables are `PAYMENT_PROVIDER=razorpay`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_PAYMENT_WEBHOOK_SECRET`. `RAZORPAY_KEY_ID` is server configured but may be returned as a Checkout-safe public field. Secrets, signatures, raw payloads, customer contact details, and payment-method details are not persisted or logged by this implementation.

Automated tests use synthetic credentials and deterministic provider doubles. M8.5 authorizes a bounded Razorpay Test Mode exercise, but it remains gated on all four local TEST variables (`PAYMENT_PROVIDER`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_PAYMENT_WEBHOOK_SECRET`). Missing credentials fail closed; live credentials and production configuration are never accepted as substitutes.

## MVP recovery and webhook release gate

The synchronous purchase path remains authoritative only after Checkout HMAC verification and server-side Fetch Payment plus Fetch Order checks confirm the canonical order binding, exact amount/currency, a captured payment, and a paid order. A browser callback alone is never payment authority.

Missed callbacks are recoverable through the bounded server-only `PaymentReconciliationService`. `FirestorePaymentReconciliationRepository` loads unresolved canonical orders, while the Razorpay adapter fetches the provider order and its payments, validates their identities and monetary fields, and emits normalized `PROVIDER_RECONCILIATION` evidence. Existing immutable payment-event and activation records make repeated reconciliation idempotent and prevent duplicate Premium extension, referral qualification, or wallet effects. No browser polling or browser-supplied financial state participates in reconciliation.

Production invokes this recovery through `GET /api/payments/reconcile`, scheduled once daily by Vercel. The route requires Vercel's `Authorization: Bearer <CRON_SECRET>` header, compares it in constant time, processes at most 25 candidates, and returns only a processed count. `CRON_SECRET` is mandatory and server-only. A missing or malformed secret fails closed before Firebase, provider, or reconciliation work begins.

`RAZORPAY_GENUINE_WEBHOOK_E2E = DEFERRED`. Razorpay TEST deliveries reached the local public endpoint but failed signature verification despite exact raw-byte preservation and local webhook-secret loading checks. Exact raw-body HMAC, constant-time comparison, event allowlisting, and `x-razorpay-event-id` replay protection remain mandatory and unchanged. Genuine webhook verification must pass before real-money launch unless a separately approved operational reconciliation design covers every asynchronous refund, dispute, and reversal lifecycle event.

## Razorpay financial lifecycle mapping

The adapter keeps Razorpay terminology at the provider boundary and emits only canonical financial evidence:

- A captured payment with a paid, fully settled order maps to `CAPTURED`.
- A captured payment with `refund_status=partial` maps to `PARTIALLY_REFUNDED` only when `amount_refunded` equals the sum of processed refunds fetched for that payment.
- A payment with `status=refunded`, `refund_status=full`, and `amount_refunded` equal to the original amount maps to `REFUNDED`, again only after processed-refund totals agree.
- Pending refunds are not financial completion evidence. Failed refunds have zero canonical financial effect. Unknown refund states and inconsistent cumulative totals fail closed.
- Signed dispute-created, action-required, and under-review events map to `DISPUTED`. A signed won event restores the provider-backed captured or partially-refunded state. A signed lost event maps to `REVERSED`; under the frozen policy, a lost dispute invalidates that purchase as financial authority even when the disputed amount is smaller than the original payment.

Fetch Payment exposes `amount_refunded` and `refund_status`; the Refund API supplies individual `pending`, `processed`, or `failed` refund records. Reconciliation counts only processed refunds. Razorpay documents `refund.processed` as final and recommends webhooks for definitive asynchronous status, so API reconciliation is a bounded recovery mechanism rather than a claim that genuine webhook delivery is working. See the official [Payment entity](https://razorpay.com/docs/api/payments/entity/), [Refund entity](https://razorpay.com/docs/api/refunds/entity/), and [Refund webhook events](https://razorpay.com/docs/webhooks/refunds/).

Dispute state is not inferred from Fetch Payment. Razorpay's dispute-created, won, and lost states are supplied by signed dispute webhooks, making dispute and chargeback-equivalent automation `PRODUCTION_WEBHOOK_DEPENDENT`. See the official [Dispute webhook events](https://razorpay.com/docs/webhooks/disputes/). The currently deferred genuine webhook signature gate therefore remains a real-money launch blocker.

All accepted lifecycle evidence first passes canonical payment transition, identity, amount, currency, and cumulative-refund checks. Partial refunds retain Premium duration and proportionally reduce pending referral value using the frozen qualification-time basis points. Full refunds, active disputes, and reversals remove only that purchase's Premium authority before entitlement recomputation; another valid purchase can preserve access. Pending referral value is cancelled or adjusted immutably. Released value never drives AVAILABLE negative: it becomes durable clawback-required debt, and later referral releases offset that debt before increasing AVAILABLE.
