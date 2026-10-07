# Admin security and authorization

## Boundary

`admin.ycoders.com` is a separate security-sensitive application, not an obscured learner route. UI hiding or an editable profile flag is insufficient. Every privileged read/mutation is server-authorized from a verified Firebase ID token and server-managed claims.

## Roles and permissions

Phase 1 uses the exact, singular server-managed claim `adminRole` and the centralized contract in `shared/admin/adminAuthorization.js`:

| Permission | Super Admin | Content Admin | Editor | Reviewer |
|---|---:|---:|---:|---:|
| View drafts/preview | yes | yes | yes | yes |
| Create/edit draft | yes | yes | yes | no |
| Validate | yes | yes | yes | yes |
| Review | yes | yes | no | yes |
| Publish/unpublish/rollback | yes | yes | no | no |
| Manage media | yes | yes | no | no |
| Manage roles | yes | no | no | no |
| View audit | yes | yes | no | no |

Represent internal permissions independently even if roles bundle them. Role assignment is privileged/offline initially and must be audited once that backend exists. Token refresh/revocation closes role changes. The legacy certification `admin: true` claim does not grant Content Admin access.

## Enforcement layers

1. Admin route guard reads verified claims for UX.
2. API middleware verifies token with revocation, issuer/audience, exact permission, App Check/origin/CSRF posture, and rate limits.
3. Services recheck permission for the specific state transition and separation-of-duties policy.
4. Firestore/Storage deny direct browser publication writes; API mediation is safest for drafts too.
5. IAM grants the Admin server only required Firestore/Storage access and no learner execution/provider secrets.

## Audit

Append immutable server events for role changes, draft/fork, validation, review, publish, rollback, archive, and asset lifecycle. Include actor UID, permission snapshot, content/version/revision, server time, correlation ID, reason, and before/after hashes—not full secret-bearing payloads.

## Content safety

- no arbitrary HTML, scripts, CSS, external iframe, or event attributes
- constrained rich-text AST and URL scheme allowlist
- prohibit or sanitize/transcode SVG server-side
- validate media signature, MIME, size, dimensions, and optionally malware
- code renders as text; execution stays inside existing isolated runtimes
- bound regex/input/validation workloads
- preview holds no publish credentials and cannot mutate progress/rewards

Reuse Firebase Auth, server token verification, WIF, error sanitization, quota patterns, secret hygiene, dependency boundaries, and certification custom-claim precedent. Do not use learner `UserContext` as authorization or store roles in editable `users/{uid}` fields.
