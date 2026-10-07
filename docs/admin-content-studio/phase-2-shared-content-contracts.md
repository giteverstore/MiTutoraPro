# Phase 2: canonical shared content contracts

Status: implemented locally; not committed or deployed.

## Source of truth and technology

Executable schema objects, AJV runtime validation, cross-document semantic validation, normalization, and compatibility adapters live in `shared/content`. JSON Schema is the machine-validatable structural source; JavaScript exports provide constants and APIs to both Vite applications, server tooling, migration scripts, and tests. Cross-reference rules such as unique IDs and complete language workspaces are intentionally layered over JSON Schema and return the same structured issue shape.

The four canonical type IDs are `PROJECT`, `COURSE`, `PRACTICE`, and `CHALLENGE`. Lowercase legacy identifiers normalize centrally. Course, Practice, and Challenge retain their existing domain schemas in this phase and can be wrapped with `normalizeLegacyDomainContent`; only Projects receive a deep canonical payload schema.

## Envelope and version identity

```json
{
  "contentId": "cli-task-manager",
  "contentType": "PROJECT",
  "schemaVersion": "1.0.0",
  "version": 1,
  "status": "draft",
  "locale": "en",
  "metadata": {},
  "content": {}
}
```

Future active-project state pins `{ projectId, contentVersion }`. A newer published revision does not silently replace the version an existing learner started. ACTIVE pointers, immutable artifact IDs, and publication authorization belong to the future publishing layer.

## Common blocks and language variants

Allowed blocks are `heading`, `paragraph`, `list`, `code`, `callout`, `image`, `table`, `expected-output`, `terminal-command`, `divider`, `concept`, `requirements`, and `common-mistakes`. Content supplies semantics only—no colors, coordinates, margins, columns, arbitrary CSS, or HTML.

Language-sensitive text/code uses one shared value with exact overrides:

```json
{
  "default": "shared fallback",
  "variants": { "python": "# Python", "java": "// Java" },
  "requiredLanguages": ["python", "java"]
}
```

Resolution is exact language, then default, then a structured `language.variant_missing` error when required. IDs are the same canonical compiler registry IDs; the compiler registry now fails startup validation if it drifts from the shared list.

Media blocks reference `{ assetId, alt, caption }`; arbitrary authored URLs are not accepted.

## Project hierarchy

`Project` contains catalog metadata, supported languages, language-specific starter workspaces, shared facts, implementation contracts, ordered checkpoints, final validators, completion blocks, and optional mentor policy. Checkpoints and tasks have stable IDs plus explicit unique positive order values. Array indexes are never identity.

```json
{
  "checkpointId": "card-model",
  "order": 2,
  "title": "Card model",
  "summary": "Represent card state.",
  "blocks": [],
  "tasks": [{
    "taskId": "free-center",
    "order": 1,
    "title": "Free center",
    "objective": "Mark the center safely.",
    "blocks": [],
    "implementationContractIds": ["free-index"],
    "validators": []
  }]
}
```

Completion content uses the same common blocks for summaries, practiced skills, and extension ideas.

## Implementation contracts

Supported kinds are `variable`, `constant`, `function`, `method`, `class`, `file`, and `collection`. A shared semantic contract owns purpose, semantic type, parameters/return, value/shape constraints, and optional language representations:

```json
{
  "contractId": "free-index",
  "name": "FREE_INDEX",
  "kind": "constant",
  "semanticType": "integer",
  "purpose": "Zero-based center card index.",
  "requiredValue": 12,
  "languageVariants": {
    "java": { "typeDisplay": "int", "modifiers": ["static", "final"] }
  }
}
```

Tasks reference contract IDs rather than duplicating their meaning.

## Trusted validation boundary

Allowed version-1 types are `execution_succeeds`, `output_contains`, `file_exists`, `source_pattern`, `function_behavior`, and `runtime_scenario`. `validatorRegistry.js` maps descriptors to named trusted platform implementations. It does not execute content.

Descriptors contain an ID, allowlisted type/version, severity, bounded typed configuration, optional languages/contract reference, and learner-safe failure message. Unknown configuration and fields named `script`, `code`, `handler`, `module`, `eval`, `command`, or `shell` are rejected. Source patterns are length-bounded and reject nested quantified forms. There is no `eval`, authored module URL, arbitrary JavaScript, or authored shell command.

The registry currently establishes the contract-to-implementation boundary; it does not replace or reroute existing learner validators in this phase.

## Mentor derivation

`deriveMentorContext` assembles project facts, checkpoint goal/state, task objective/behavior/common mistakes, resolved implementation contracts, guide facts, hints, reveal policy, and bounded additional context. Objectives, contracts, and mistakes remain canonical task data rather than duplicate mentor fields. Hint levels are `hint`, `deeper_hint`, `focused_example`, and `reference`; references can require explicit reveal and completed-task boundaries.

This phase does not change provider prompts, Premium access, quotas, or learner AI behavior.

## Normalization and errors

Public APIs include `validateContent`, `validateProjectContent`, `validateSchema`, `normalizeContent`, `normalizeProject`, `resolveLanguageVariant`, `normalizeLegacyProject`, `normalizeLegacyDomainContent`, `createContentEnvelope`, and `deriveMentorContext`.

Inputs are never mutated. Valid normalized values are deeply frozen. Invalid content throws `ContentContractError` with deterministic issues:

```json
{
  "path": "checkpoints[1].tasks[0].implementationContractIds[2]",
  "code": "reference.contract_missing",
  "message": "Unknown implementation contract.",
  "severity": "error"
}
```

## Compatibility and security

`normalizeLegacyProject` converts every current bundled Project into the canonical envelope. Legacy checkpoints become one generated task each, current guide blocks and language fragments map into common blocks, and current execution/source/Python-function validation maps into trusted descriptor types. The learner runtime is not switched to this adapter yet, so execution, persistence, exports, naming, validation, and AI behavior remain unchanged.

Plain semantic text is the Phase 2 prose format. Raw HTML is rejected. Code and expected output remain inert strings. Images use stable asset IDs. Renderers must continue using text nodes or explicitly safe code rendering; adding Markdown/HTML later requires a reviewed constrained AST and sanitizer.

The schema-only stress fixture proves the model represents Python/Java/C++ starter workspaces, eight checkpoints, seventeen tasks, semantic blocks, `FREE_INDEX`, `WIN_LINES`, `mark`, task/cumulative validators, staged hints/reveal policy, and completion content. It is test data, not Bingo production content.
