# Subscription foundation

MiTutora has two effective access tiers: `FREE` and `PREMIUM`. A current, unexpired Premium entitlement grants `PREMIUM`; otherwise the user is `FREE`. M3.1 does not gate courses or other content.

The immutable server registry defines Monthly at ₹499 (`49900` paise) for one calendar month, Half-Yearly at ₹999 (`99900` paise) for six calendar months, and Annual at ₹1,499 (`149900` paise) for twelve calendar months. All plans use INR. Browser labels are presentation only; clients cannot submit price, duration, status, source, or UID.

Historical records live at `users/{uid}/subscriptions/{subscriptionId}` with finite `ACTIVE`, `EXPIRED`, and `CANCELLED` statuses. Current authority lives at `users/{uid}/entitlements/premium`. Entitlement reads always compare `expiresAt` with server/current time, so a stale `active: true` cannot grant access after expiry. Active grants extend from the current expiry; expired grants start from server time. Calendar-month addition clamps end-of-month dates to the target month's final day.

Both server and client entitlement reads validate that the referenced historical subscription is still `ACTIVE` and matches the entitlement owner and plan. A missing, cancelled, expired, or mismatched backing record resolves fail-closed to `FREE`.

Before payments exist, `npm run dev:full` exposes an emulator-only authenticated development grant. It derives UID from the Firebase Auth emulator token, uses canonical server plans, and atomically creates the subscription and entitlement. It is pinned to the demo project and loopback Firestore emulator and is unavailable elsewhere. `DEVELOPMENT_GRANT` is not a payment. No checkout, recurring billing, invoice, refund, wallet, or coin conversion exists. M4 introduces Premium access gates; M8 introduces real payment activation.

Premium gates link directly to the Subscription settings section. In the explicitly pinned local emulator stack, each canonical plan has a single-flight `Get Premium` action that submits only the canonical plan ID and an idempotency key to the authenticated development-grant endpoint. The UI stays Free until it reloads an authoritative entitlement. Outside that emulator boundary, the same plan actions are disabled and labelled `Payments coming soon`; they never invoke `DEVELOPMENT_GRANT` or imply that payment occurred.

## Premium access policy

The centralized M4 policy keeps the course catalog, the first three canonically ordered lessons in every course, Practice, Daily Challenges, coins, streaks, bookmarks, account, Home, and Settings available to Free learners. Lessons four and later, Projects, AI Tutor, and Certificates require a valid Premium entitlement. Loading and entitlement errors resolve fail-closed to Free. The AI Tutor API independently reads the authenticated user's entitlement and its backing subscription before quota reservation or provider execution; client-supplied tier fields have no authority.

Course lesson gating is currently an application/content-delivery boundary. Course content delivered in browser bundles or downloaded to the browser cannot be made confidential through React routing alone. Stronger confidentiality would require authenticated server-side content delivery in a later phase. No checkout or payment activation is implemented here.
