# Blind 150 integration

## Verification boundary

Repository search found no Blind 150 source archive or manifest matching the reported 150 questions, 1,502 fixtures, 1,350 templates, reference implementations, runners, or reports. Consequently this audit cannot verify IDs, fixture schemas, language coverage per question, validator correctness, archive provenance, or whether every runner matches current runtime versions. Those assets must be supplied and independently inventoried before implementation estimates become commitments.

## Target content model

Use immutable versioned records:

- **Public question:** stable ID/version, category, prompt, constraints, examples, function contract, comparison policy summary, supported languages, starter-template references, and public fixtures.
- **Language template:** question version, language/runtime profile, callable binding, source, editable regions if any, and template hash.
- **Protected suite:** server-only suite ID/version, fixtures, reference result or oracle, structural/semantic validators, resource overrides within policy, and provenance/review metadata.
- **Daily assignment:** date/version pointing to a public question version and protected suite binding; do not duplicate tests.
- **Submission:** learner/question/language/source hash, immutable suite/runtime versions, timestamps, aggregate result, safe failures, idempotency key, and audit correlation ID.

Public and protected artifacts must be produced by one validation pipeline but published to different trust domains. Never put protected artifacts into Vite imports, public Firebase documents, downloadable Storage objects, or client-visible API payloads.

## Ingestion gates

1. Inventory supplied archives without assuming paths.
2. Validate stable IDs, uniqueness, all nine templates, fixture counts, and hashes.
3. Run each reference implementation against every canonical fixture in a pinned toolchain.
4. Cross-check public/protected partition and scan generated browser artifacts for protected values.
5. Validate tagged-value round trips and mutation/state projections for each language.
6. Require editorial and security review; sign/version the release manifest.
7. Publish public artifacts and protected registry atomically by release ID.

## Product loading

Extend the Practice repository/model rather than create a parallel Blind 150 page. The question loader resolves public metadata and the selected language template. `useSelectableCompilerLanguage` can remain the selector, but availability must come from the question manifest. Daily Challenges resolve an immutable question version from the assignment.

Public Run uses the existing browser runtime through a new language harness adapter and renders per-case results in the existing output region. Submit posts only identity/source metadata to the judge API. The result service, not the browser, invokes activity completion and reward reconciliation after a trusted pass.

## Progress and compatibility

Keep existing Practice/Challenge completion records readable. Add a verification authority/version field to distinguish legacy client-validated records from authoritative Mode B submissions. Decide explicitly whether legacy completions are grandfathered, revalidated, or shown separately; never silently revoke them.

Saved editor state must be keyed by question ID, language, and template/schema version. Template upgrades need a non-destructive migration/compare flow so learner source is not overwritten. Daily Challenge attempts should reference both assignment date and canonical question version.

## Harness contract

Each language adapter should implement the same conceptual operations: compile/load learner source; bind callable; decode tagged arguments; execute a case or stateful sequence; capture return and declared mutations; encode result; classify compiler/runtime/timeout/resource failures. The protected controller retains expected values and can give the guest one input at a time.

Special cases requiring explicit policy include integer widths, float tolerance, Unicode normalization, map ordering, cycles, shared node identity, in-place mutation, exceptions, constructor state, and R vector/list/data-frame distinctions.

## Required decisions before implementation

- Actual archive location, format, license, owners, and checksums.
- Whether every question truly supports all nine languages.
- Which validators are safe to run in the guest and which remain controller-side.
- Runtime/toolchain versions and dependency policy per language.
- Submission retention, source privacy, deletion, plagiarism, and rejudge policy.
- Legacy completion treatment and reward authority cutover.
