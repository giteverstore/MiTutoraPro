# Deployment to admin.ycoders.com

## Model

Create a third Vercel project for the Admin package with its own root/build/output configuration. Main and compiler deployments remain unchanged. Map `admin.ycoders.com` only after smoke tests. Preview deployments use a non-production Firebase project or strictly separated preview resources.

Do not extend host sniffing in `src/App.jsx`; the Admin bundle has its own entrypoint and cannot accidentally render learner routes.

## Phase 1 configuration

- Vercel project: `Y Coders Admin`
- project root: `apps/admin`; enable Vercel's **Include source files outside of the Root Directory in the Build Step** setting because the Admin app and API import shared repository-root modules
- install command: `npm ci --prefix ../..` from `apps/admin`, using the repository-root lockfile and server dependencies; the Admin Vite config resolves Pyodide from the installed package location
- build command: `npm run build`
- output directory: `dist`
- repository-root equivalent: `npm run admin:build`
- use `apps/admin/vercel.json` and `apps/admin/api/admin-content/[...path].js` for same-origin Admin API requests; no cross-project rewrite or Admin cron is used

Browser `VITE_*` variables are the existing public Firebase client variables listed in `apps/admin/.env.example`. No privileged Admin variable is needed in Phase 1. Future server-only values include Firebase project ID, WIF audience/provider/service identity, Storage bucket, audit configuration, publish gates, and scanning credentials. Never expose claims secrets, service-account JSON, provider keys, or signing material through `VITE_*`.

Production API initialization uses the existing request-scoped Vercel OIDC/Google WIF adapter, with explicit WIF AuthClients for Firestore and Cloud Storage and a request-scoped Firebase Admin session for ID-token verification. Firebase Admin Storage itself rejects custom WIF credentials, so it must not be used for deployed Admin storage. The required WIF provider subject, service-account IAM, Firebase project, and Storage access must be verified for the Admin Vercel project before Production deployment; code support alone does not grant access.

Preview is deliberately **backend-disabled** until a separate staging Firebase project and trusted identity are provisioned. The Admin UI loads, but `/api/admin-content/*` refuses every non-GET request with 403. GET requests without a bearer token return 401; other GET requests return 503. Preview has no proxy to `ycoders.com` and cannot publish, archive, upload assets, or write drafts to production. This is a fail-closed smoke-test mode, not a functional content-preview environment. Do not attach production WIF variables or privileged IAM to Preview.

## Firebase and API

- authorize `admin.ycoders.com` and approved preview callback domains in Firebase Auth
- configure explicit redirect URIs and App Check
- create least-privilege IAM and required Firestore indexes
- update rules only after emulator denial tests
- exact-origin CORS for Admin APIs plus authentication

Phase 1 does not alter Firestore or Storage rules. Both remain deny-by-default for future Admin content paths.

Learner and Admin apps do not call one another. They share contracts and Firebase-published artifacts. Admin calls privileged APIs; learner reads public catalog metadata and ACTIVE artifacts.

## Release order

1. validate shared contracts against both builds
2. Admin preview against emulator/staging
3. negative auth/role and round-trip preview tests
4. production Admin with publishing disabled
5. validate read-only/audit behavior
6. enable publishing for an allowlisted pilot role/type
7. map domain after smoke

Published versions declare minimum learner renderer compatibility. Admin blocks activation if the production learner build is incompatible. An Admin release need not redeploy learner code unless shared renderer/contracts changed.
