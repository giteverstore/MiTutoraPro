# Risks and recommendations

| Risk | Impact | Recommendation |
|---|---|---|
| Shared Submit currently trusts browser validation | Forged completion/rewards | Move Mode B authority to judge result service; keep browser Run advisory |
| Hidden assets accidentally bundled/fetched | Permanent disclosure | Split public/protected build and storage domains; scan artifacts/network payloads |
| Global `CompilerPanel` change | Course regressions | Add explicit versioned execution strategy; default old definitions to Mode A |
| stdout validators used for functions | Incorrect grading | Introduce tagged return/mutation/state protocol and per-language harnesses |
| Toolchain drift | Cross-language disagreement/rejudge churn | Pin immutable profiles and record profile/suite versions on submissions |
| Saved-code/template migration | Learner work loss | Version keys, never auto-overwrite, provide diff/rebase flow |
| Legacy completion semantics | Confusing or revoked progress | Define grandfather/revalidation policy before cutover |
| Retry/replay races | Duplicate rewards/submissions | Idempotency keys and transactional result application |
| Infrastructure failure counted wrong | Unfair failures | Separate judge errors from wrong answers; safe retry |
| Native-code execution in serverless | Host/tenant compromise | Use dedicated isolated workers; serverless only as control plane |
| Nine-language big-bang | Security and correctness delays | Python-first phased admission with per-language gates |
| Blind 150 assets absent from repo | Invalid assumptions | Inventory supplied archive before schema mapping or estimates |

## Component recommendations

Reuse the editor, shared dock, language selector, browser runtimes for public Run, normalized status/error presentation, cancellation, and content/progress repositories. Extend the question/compiler schema, output drawer, value normalization, and activity result model. Replace stdout-only grading for Mode B and client-authoritative Submit. Add the protected registry, harness packages, authenticated API, queue, isolated workers, result attestation, quotas, and operations.

## Migration guardrails

1. Feature-flag Mode B by immutable question version and language.
2. Keep Mode A code paths and tests unchanged.
3. Dual-read existing content/completion schemas; do not rewrite records in place.
4. Shadow-submit without granting rewards before authority cutover.
5. Compare browser public results with judge public-subset results to detect harness drift.
6. Roll out by language and cohort; preserve a kill switch and queue drain procedure.
7. Monitor compile/runtime failure rates, mismatches, latency, cleanup failures, and costs.

## Outstanding decisions

- Blind 150 archive provenance, license, schema, checksums, and owners.
- Runtime versions and permitted standard libraries/packages for each language.
- Exact value/identity/mutation semantics and float/integer policies.
- Whether all 150 questions support all nine languages and which are stateful.
- Result detail allowed for hidden failures.
- Attempt/source retention, privacy, deletion, plagiarism, and appeals/rejudge policy.
- Reward authority and treatment of historical client-validated completions.
- Availability/SLO, regional/data-residency requirements, queue limits, and budget.
- Whether Firecracker remains the selected boundary after operational ownership review.
