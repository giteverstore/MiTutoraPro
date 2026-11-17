# Dedicated V2 learner API boundary

The learner V2 Course pilot uses one V2-only Vercel function at `api/v2-pilot/[...path].js`. It dispatches authenticated Course delivery, exact-version assets, and versioned progress without importing or invoking Admin content routers.

The boundary adds one file-based Vercel function, increasing the actual remote-main count from nine to the guarded limit of ten. Existing public-content, cache, compiler, payment, and SPA routes are unchanged; there is no remaining function-count headroom.

Browser Firebase ID tokens terminate at the learner gateway. The gateway verifies revocation-aware learner identity and server-only learner/Course allowlists. Editor Studio receives only the separate request-bound service assertion. Browser access to `users/{uid}/v2CourseProgress/*` remains denied by Firestore rules; the server-side Admin SDK transaction is authoritative.
