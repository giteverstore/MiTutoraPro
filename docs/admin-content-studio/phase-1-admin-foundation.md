# Phase 1: Admin application and authorization foundation

Status: implemented locally; not committed or deployed.

## Application boundary

The independently buildable frontend lives at `apps/admin`. It has its own HTML entrypoint, Vite configuration, package manifest, output directory, CSP, Vercel configuration, source tree, and tests. It reuses browser-safe Firebase initialization and shared theme tokens, but does not import learner AppShell state or routes.

Commands from the repository root:

```text
npm run admin:dev
npm run admin:test
npm run admin:build
npm run build
```

## Authentication and authorization

Firebase Authentication supports the existing email/password and Google providers. The route gate waits for `onIdTokenChanged`, reads verified ID-token claims with `getIdTokenResult`, and renders one of four explicit states: loading, login, access denied, or authorized shell. It does not force-refresh continuously; an authenticated denied user may explicitly request one claim refresh after an administrator grants access.

The only accepted role claim is:

```text
adminRole: SUPER_ADMIN | CONTENT_ADMIN | CONTENT_EDITOR | CONTENT_REVIEWER
```

The existing legacy `admin: true` claim is intentionally not accepted. It currently protects certification administration and treating it as Content Admin access would silently broaden privilege. Local storage, query strings, client-editable profiles, email allowlists, and UI visibility are never authorization sources.

The shared contract is `shared/admin/adminAuthorization.js`. Future APIs use `server/admin/AdminAuthorization.js`, which verifies the Firebase bearer token before applying centralized role/permission checks.

| Role | Create/edit | Validate/preview | Publish | Review | Media | Audit | Admin manage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Super Admin | yes | yes | yes | yes | yes | yes | yes |
| Content Admin | yes | yes | yes | yes | yes | yes | no |
| Content Editor | yes | yes | no | no | no | no | no |
| Content Reviewer | no | yes | no | yes | no | no | no |

Client checks provide UX only. Every future privileged server handler must call `requireAdminAuth` or `requireAdminPermission`; no content API was added in this phase.

## Routes

- `/` dashboard with honest capability status only
- `/content/projects`, `/content/courses`, `/content/practice`, `/content/challenges`
- `/media/assets`
- `/publishing/drafts`, `/publishing/published`, `/publishing/versions`
- `/admin/users`, `/admin/settings`, `/admin/audit`

All non-dashboard destinations are clearly labeled placeholders. An unknown path renders a safe not-found view inside the authorized shell.

## Security and deployment

`config/adminSecurityHeaderPolicy.mjs` supplies local development headers and `apps/admin/vercel.json` supplies production headers: restrictive CSP, `frame-ancestors 'none'`, MIME sniffing protection, no-referrer policy, restricted browser capabilities, frame denial, and production HSTS. CSP permits only the Firebase/Google origins required by authentication. Any future API, App Check, asset, or preview origin must be added deliberately and tested rather than widened generically.

Use a separate Vercel project named `Y Coders Admin`:

```text
Root directory: apps/admin
Build command: npm run build
Output directory: dist
Domain: admin.ycoders.com
```

The public Firebase browser configuration may be shared with the learner app and is enumerated in `apps/admin/.env.example`. Secrets and privileged server configuration must never use a `VITE_` prefix.

Manual production preparation:

1. Add `admin.ycoders.com` and approved preview domains to Firebase Authentication authorized domains.
2. Verify Google OAuth redirect behavior for those domains.
3. Configure App Check before adding privileged Admin APIs.
4. Assign the exact `adminRole` custom claim through trusted server-side administration and require users to refresh/sign in again.
5. Preserve separate preview/production IAM; future production server access should use least-privilege WIF rather than service-account JSON.
6. Smoke-test CSP and authentication before mapping the production domain.

### Provision the first administrator locally

The repository includes a server-side Firebase Admin utility for assigning an Admin Studio role to an existing Firebase Authentication user. It uses Application Default Credentials and cannot be called from browser code. Store the service-account file outside the repository and never commit it.

In PowerShell, point Application Default Credentials at a service account that can read Firebase Authentication users and update their custom claims. Set the project explicitly when the credential is not already scoped to the intended project:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\secure\ycoders-firebase-admin.json"
$env:FIREBASE_PROJECT_ID = "your-firebase-project-id"
```

Grant the initial role by email (or replace `--email` with `--uid`):

```powershell
npm run admin:set-role -- --email "user@example.com" --role SUPER_ADMIN
```

The allowed values come from the shared authorization contract: `SUPER_ADMIN`, `CONTENT_ADMIN`, `CONTENT_EDITOR`, and `CONTENT_REVIEWER`. The command preserves all other custom claims and changes only `adminRole`.

To remove only the Admin Studio role while preserving other claims:

```powershell
npm run admin:remove-role -- --email "user@example.com"
```

After either command, the affected user must sign out and sign back in so Firebase issues an ID token containing the updated claims. These commands do not create users or passwords; the target Firebase Authentication user must already exist.

## Deliberate limitations

There is no Content Studio editor, drag/drop, project authoring, schema/JSON editor, validation authoring, AI mentor authoring, media upload, preview renderer, publishing/versioning workflow, audit backend, or role-management UI. Firestore and Storage rules were not relaxed because Phase 1 needs no content data access. Dashboard cards report capability status and do not fabricate operational metrics.
