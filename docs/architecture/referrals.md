# Referrals

Referrals is an AppShell module under `src/referrals/`. It presents a user’s referral code and link, mock rewards, invitation history, and common program questions.

## Model and service

`referralModel.js` normalizes referral profiles and history entries. History status is `invited`, `joined`, or `qualified`; reward status is `pending` or `earned`.

`ReferralService` exposes profile retrieval, saving, reset, and export through a replaceable repository. The local repository stores user-scoped mock data at `mi-tutora:referrals:v1:<userId>` and initializes the mock profile on first access. A future API repository can replace storage without changing page components.

## Page composition

- `ReferralOverview` renders referral code, invite counts, successful referrals, and earned coins.
- `InviteFriends` provides code/link copy actions and native sharing.
- `ReferralRewards` explains qualification and rewards for both participants.
- `ReferralHistory` uses a responsive table/list representation.
- `ReferralFaq` uses native `details` elements for accessible expandable answers.

Clipboard failures return the copyable value in user feedback. When the Web Share API is unavailable or fails, sharing falls back to copying the referral link.

## Boundaries

Referral data and MI Coins are mock local records. The module does not change course progress, challenge rewards, certificates, or account state. Future attribution and reward issuance should be implemented by a referral API behind `ReferralService`.
