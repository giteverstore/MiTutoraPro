# Validation authoring model

## Current capabilities

Projects support execution and source regex checks plus a legacy Python harness. Course/Practice compiler blocks support normalized output, numeric tolerance, integer range, and test cases. Trusted rewards/completion already resolve canonical content server-side.

## Declarative descriptors

Admin forms create descriptors, never executable JavaScript:

| Type | Use | Boundary |
|---|---|---|
| `execution_succeeds` | compile/run | shared compiler runtime |
| `output_contains` | observable text | result normalizer |
| `output_matches` | normalized/exact/bounded regex | result normalizer |
| `file_exists` | workspace structure | virtual filesystem |
| `source_pattern` | simple syntax presence; heuristic | safe matcher |
| `symbol_contract` | signatures/modifiers | language analyzer/AST adapter |
| `collection_shape` | constants/data shapes | analyzer or isolated test |
| `function_behavior` | input/output cases | generated trusted harness |
| `runtime_scenario` | stdin/files/multi-step | isolated runtime |
| `custom_template` | rare reviewed validator ID + parameters | allowlisted registry |

Raw regex is advanced, length/complexity bounded, and safe-regex checked. Source matching is explicitly weaker than behavior.

## Trusted mapping

Descriptors reference `validatorType` and `validatorVersion`. A platform registry maps them to code; content supplies only schema-validated parameters. Custom validators are engineered, reviewed, tested, deployed, then exposed as templates. No `eval`, dynamic module URL, arbitrary shell command, or authored JS runs.

Commands resolve from the canonical runtime registry, not author strings. Task validators give focused feedback; checkpoint validators are cumulative; final validators reuse earlier descriptor IDs plus integration scenarios. Contract-derived validators reference `contractId` to prevent guide/validation drift.

## Author UX and publication gate

Forms expose typed parameters, fixtures, visibility, timeout profile, languages, and learner failure copy. Preview offers schema checks, language resolution, safe fixture dry-runs, and public/protected evidence separation. Publication fails for missing variants, dangling references, unavailable validator versions, policy-limit violations, or incorrect positive/negative fixtures.

Browser validation is feedback. Coins, certificates, or trusted completion require server verification against canonical published content. The artifact classifies validator sets as `feedback` or `trusted`; the browser cannot promote them.
