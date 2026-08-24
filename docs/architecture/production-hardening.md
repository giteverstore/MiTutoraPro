# Production Hardening and Observability

**Status: CURRENT — local readiness; production rollout pending approval.**

Storage rules admit only versioned JSON with `publicationState=ACTIVE`; clients cannot write. Before deployment, production objects need a read-only inventory and approved dry-run-first metadata/hash migration. Existing active pointers must remain unchanged unless every byte, hash, path, and version check succeeds.

The browser initializes App Check with reCAPTCHA Enterprise when `VITE_FIREBASE_APP_CHECK_RECAPTCHA_ENTERPRISE_KEY` exists. Refresh is enabled and debug tokens are development-only. `ENFORCE_CERTIFICATION_APP_CHECK` must remain disabled until the web app is registered and production token metrics are healthy.

Functions now target Node.js 22 locally. Export names, trigger types, authentication, regions, and business logic are unchanged. Production stays on its deployed runtime until an approved deployment.

Functions share a fail-open structured logger. It records stable event, severity, component, environment, operation/error identifiers, safe IDs, results, and durations where available. Passwords, tokens, credentials, secrets, answers, source code, and media fields are removed. No alert policies are currently claimed as deployed.

Recommended order: production inventory; App Check registration with enforcement off; observe tokens; approved legacy content migration; Storage rules deployment; Node 22 Functions deployment and read-back; callable App Check enforcement; then alert-policy configuration and notification tests. Rollback keeps the previous active content version, restores prior rules/runtime from source, and disables callable enforcement through its existing configuration switch.
