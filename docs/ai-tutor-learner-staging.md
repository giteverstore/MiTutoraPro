# Learner staging AI Tutor boundary

The dedicated `ycoders-learner-staging` Preview deployment uses the
`learner-staging-disabled` runtime profile for V2 Course integration staging.
AI Tutor is intentionally out of scope for that environment.

The profile is pinned to the `ycoders-learner-staging` Vercel project and its
immutable project ID, the Preview environment, and the `ycoders-v2-staging`
Firebase/GCP project. It requires `AI_TUTOR_ENABLED=false` and
`AI_TUTOR_ROLLOUT_PERCENTAGE=0`.

No provider, model invocation, quota backend, Tutor service identity, Tutor
WIF, Tutor persistence backend, or external AI request is available. Conflicting
credentials or backend configuration fail closed rather than being ignored.
Production and AI Tutor validation infrastructure are not shared.

**This profile is an approved zero-capability AI Tutor runtime boundary, not a
mechanism to bypass Tutor runtime validation.**
