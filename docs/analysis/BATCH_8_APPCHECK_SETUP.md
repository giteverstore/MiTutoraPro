# Batch 8 Firebase App Check Setup

**Status:** manual rollout plan only. The API/provider has not been enabled or registered, no Vercel variable has been changed, and enforcement remains off.

## Local code already ready

The browser imports `src/firebase/appCheck.js` before rendering React. Initialization occurs only when `VITE_FIREBASE_APP_CHECK_RECAPTCHA_ENTERPRISE_KEY` is non-empty. It uses `ReCaptchaEnterpriseProvider`, enables token auto-refresh, and shares the existing Firebase app.

Environment variables:

- production site key: `VITE_FIREBASE_APP_CHECK_RECAPTCHA_ENTERPRISE_KEY`
- development-only debug token: `VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN`
- emulator selector: `VITE_FIREBASE_USE_EMULATORS`
- server enforcement switch: `ENFORCE_CERTIFICATION_APP_CHECK`

The debug token is assigned only when `import.meta.env.DEV` is true and Firebase emulators are not selected. It is never read into production-specific logic. When emulators are used, leave the site-key variable unset so App Check initialization is skipped. Callable enforcement is disabled whenever `ENFORCE_CERTIFICATION_APP_CHECK` is not exactly `true`, and is also bypassed when `FUNCTIONS_EMULATOR=true`. When enabled in production, callable options request both App Check enforcement and replay protection (`consumeAppCheckToken`).

## Manual cloud setup

1. Grant the inventory principal `roles/firebaseappcheck.viewer`; do not grant App Check Admin to the application service account.
2. In Google Cloud Console for `mi-tutora-pro`, enable **Firebase App Check API** (`firebaseappcheck.googleapis.com`). This is a production mutation and requires explicit approval.
3. In reCAPTCHA Enterprise, create a **score-based website key** dedicated to Mi Tutora Pro. Add only production domains, including `mi-tutora-pro.vercel.app` and any approved custom domains. Do not add `localhost` to the production key.
4. In Firebase Console → App Check → Apps, select the existing Mi Tutora Pro web app and register the reCAPTCHA Enterprise provider using that key. Keep enforcement disabled.
5. Record the provider registration and key ownership in the deployment change ticket; never store a secret key in Git. The browser variable is the public site key, not a service-account credential.

Firebase guidance: [App Check with reCAPTCHA Enterprise for web](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider) and [App Check enforcement](https://firebase.google.com/docs/app-check/enable-enforcement).

## Vercel configuration and deployment

1. Vercel project → Settings → Environment Variables.
2. Add `VITE_FIREBASE_APP_CHECK_RECAPTCHA_ENTERPRISE_KEY=<registered public site key>` to **Production** (and Preview only if preview domains are registered separately).
3. Do not create `VITE_FIREBASE_APP_CHECK_DEBUG_TOKEN` in Vercel.
4. Redeploy the already-approved frontend revision. Vite variables are embedded at build time, so a redeploy is required.
5. Keep `ENFORCE_CERTIFICATION_APP_CHECK` unset/false during observation.

## Verification before enforcement

1. Open the production app in a clean browser session and exercise authentication, content loading, trusted completion, and certification callables.
2. Confirm App Check requests receive tokens and there are no provider/domain/CSP errors in the browser console.
3. In Firebase App Check metrics, observe valid, invalid, and unknown request ratios across representative traffic and at least one full token-refresh cycle.
4. Verify emulator and local-development workflows separately. A local debug run may set a Firebase Console-issued debug token in an untracked `.env.local`; never commit it.
5. Use the read-only platform inventory to confirm provider configuration and service enforcement state.

## Enforcement checkpoint

Enforcement is a separate production change. Only after healthy token metrics and a rollback rehearsal:

1. Set `ENFORCE_CERTIFICATION_APP_CHECK=true` for the certification Functions environment.
2. Deploy only the explicitly approved certification functions.
3. Verify authenticated valid-token calls succeed, missing/invalid tokens fail, emulator tests remain unaffected, and replay-protected endpoints behave correctly.
4. Monitor rejection rates and stable error codes. Roll back by restoring the switch to false and redeploying the same code if legitimate traffic is blocked.

Do not enable Firebase product-level enforcement or change unrelated Firebase products as part of this checkpoint.

## Status

MIT-007 remains **PARTIALLY RESOLVED**: client and callable integration is staged locally, while cloud registration, frontend configuration, observation, and enforcement remain pending explicit approval.
