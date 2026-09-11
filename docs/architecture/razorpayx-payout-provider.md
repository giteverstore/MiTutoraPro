# RazorpayX payout provider (M8.7)

M8.7 places RazorpayX behind the provider-independent `PayoutProvider` boundary. Withdrawal reservation remains authoritative in Firestore: AVAILABLE becomes RESERVED atomically with the withdrawal and payout outbox. Only normalized provider evidence may change the wallet.

## UPI initiation and privacy

The learner supplies a UPI ID for each withdrawal. The server normalizes it as a lower-case ASCII VPA and sends it transiently while creating a RazorpayX Contact and VPA Fund Account. The canonical withdrawal persists only the masked destination, keyed fingerprint, and provider Contact/Fund Account/Payout identifiers. The full VPA is not stored in a profile, withdrawal, outbox, event, ledger, log, or error.

Contact references use the immutable withdrawal identity. Razorpay documents that identical Contact attributes and identical `contact_id` plus VPA Fund Account attributes return existing provider objects. This bounds retries without creating a reusable MiTutora payout profile. An ambiguous transport outcome becomes `UNKNOWN`; RESERVED remains intact and no autonomous retry requiring a persisted VPA occurs.

## Payout request and idempotency

The request uses the configured RazorpayX source account, VPA Fund Account, integer paise, `INR`, mode `UPI`, purpose `payout`, and the canonical withdrawal reference. `X-Payout-Idempotency` is a 32-character value derived only from the immutable withdrawal ID. Razorpay requires the same key and body for retries and made the header mandatory in March 2025.

Provider authentication is server-side HTTP Basic authentication. Credentials and the source account never enter browser code or canonical public records.

## State mapping

| RazorpayX | Canonical |
| --- | --- |
| `created` | `INITIATION_PENDING` |
| `pending`, `queued`, `initiated`, `processing` | `PROCESSING` |
| ambiguous transport outcome | `UNKNOWN` |
| `processed` | `PAID` |
| `failed`, `rejected` | `FAILED` |
| `cancelled` | `CANCELLED` |
| `reversed` | `REVERSED` |

Unknown states fail closed. Provider payout ID, Fund Account ID, withdrawal reference, amount, and currency must match canonical state. Same-state evidence cannot repeat wallet movement. Out-of-order terminal evidence may resolve an intermediate state; stale terminal regressions are rejected. A reversal after PAID creates immutable external compensation, while a reversal before PAID releases RESERVED.

## Reconciliation and webhooks

`PayoutReconciliationService` fetches bounded candidates with provider IDs, calls Fetch Payout, validates binding, records immutable evidence, and applies wallet movement exactly once. `PROCESSING` and `UNKNOWN` remain reconcilable after restart.

The webhook adapter requires exact raw bytes, HMAC signature, provider event identity, an explicit event allowlist, and a unique canonical payout lookup. Replay converges through `payoutWebhookEvents`. Genuine RazorpayX webhook delivery/signature behavior remains `PRODUCTION_WEBHOOK_DEPENDENT`; fixtures do not establish provider E2E.

## Production networking gate

Razorpay requires IP allowlisting for Live Payout APIs, including Contacts and Fund Accounts. Ordinary Vercel serverless egress is not a stable dedicated outbound IP. Therefore `RAZORPAYX_VERCEL_EGRESS = REQUIRES_FIXED_EGRESS`. Production payout initiation must remain disabled until an approved fixed-egress architecture is provisioned and allowlisted.

## MVP product decision

`M8.8_IMPLEMENTATION = COMPLETE`; `M8.8_PROVIDER_E2E = DEFERRED_BUSINESS_REGISTRATION`; `SUBSCRIPTIONS = ENABLED`; `REFERRALS = ENABLED`; `REFERRAL_EARNINGS_DISPLAY = ENABLED`; `WITHDRAWALS = COMING_SOON`; `PRODUCTION_WITHDRAWALS = DISABLED`. The adapter remains dormant for future activation and does not affect Premium purchases or referral accounting.

Official references:

- https://razorpay.com/docs/api/x/contacts/
- https://razorpay.com/docs/api/x/fund-accounts/create/vpa/
- https://razorpay.com/docs/api/x/payouts/create/vpa/
- https://razorpay.com/docs/api/x/payout-idempotency/make-request/
- https://razorpay.com/docs/x/payouts/states-life-cycle/
- https://razorpay.com/docs/webhooks/payouts/
- https://razorpay.com/docs/x/dashboard/allowlist-ip/
