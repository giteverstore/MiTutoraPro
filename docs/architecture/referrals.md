# Referrals (M5.1)

M5.1 replaces the local mock with a server-authoritative attribution and qualification domain. Browser clients only read owner-scoped projections and call authenticated Firebase functions; they cannot author ownership, attribution, status, purchase evidence, or financial fields.

## Frozen MVP policy

`functions/src/referrals/ReferralPolicy.js` is the single policy source. Version `m5-v1` is enabled, uses INR minor units, and assigns 1,000 basis points (10%) to a FREE referrer and 1,500 basis points (15%) to a PREMIUM referrer. Integer arithmetic floors any fractional paise.

The referrer's authoritative tier is evaluated at qualification—not when a code is created or shared and not at signup. Signup earns nothing. `DEVELOPMENT_GRANT`, coin activity, and Premium entitlement alone are not qualifying evidence.

## Model and privacy

- `referralCodes/{normalizedCode}` maps a stable collision-checked `MIT` plus six-character code to its owner.
- `users/{uid}/referralIdentity/current` is the owner's readable identity projection.
- `users/{referredUid}/referralAttribution/current` is immutable attribution and freezes no rate.
- `referrals/{referralId}` is the private authoritative relationship with only `ATTRIBUTED` and `QUALIFIED` states.
- `users/{referrerUid}/referralReadModel/{referralId}` excludes referred UID, email, phone, profile, subscription, and payment details.
- `referralPurchaseQualifications/{purchaseId}` is server-only replay protection.

Rules permit owner reads of identity, attribution, and read model, deny cross-user reads, and deny all client writes. Global records are unavailable to browsers.

## Qualification and financial boundaries

`ReferralService.qualifyReferralFromVerifiedPurchase()` is internal and is not a browser callable. It requires trusted `VERIFIED_PREMIUM_PURCHASE` evidence, resolves the canonical plan price, reads the referrer's backed entitlement transactionally, and commits qualification/read-model/replay state atomically. Duplicate evidence is idempotent and conflicts fail closed. M8 will supply real verified payment events.

A qualified record is only a **calculated referral reward**. M5 creates no wallet, withdrawable balance, payout, withdrawal, payment, settlement, coin reward, or conversion. M6 owns the wallet/ledger, M7 withdrawals, and M8 verified payment authority. Coins remain separate.
