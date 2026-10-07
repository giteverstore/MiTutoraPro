# Canonical content schema

## Strategy

Evolve the existing Course block union into a shared vocabulary, but do not force every domain into one giant document. Use a versioned envelope plus domain payload schemas.

```json
{
  "schemaVersion": "1.0.0",
  "contentId": "project-bingo",
  "contentType": "project",
  "locale": "en",
  "version": 1,
  "status": "draft",
  "metadata": {},
  "content": {}
}
```

`schemaVersion` is data compatibility and `version` is the content revision that future learner state pins. Immutable artifact IDs and ACTIVE pointers remain publishing-layer concerns. Publication status is not authorization and must never be trusted without server-side canonical resolution.

## Common blocks

The executable Phase 2 vocabulary is:

- display: `heading`, `paragraph`, `list`, `code`, `image`, `table`, `divider`
- emphasis: `callout`, `concept`, `requirements`, `common-mistakes`
- runtime evidence: `terminal-command`, `expected-output`

Inline code remains plain text in Phase 2; a constrained rich-text AST may be added later. Store no arbitrary HTML. Every block has a stable `blockId`, a type discriminator, a type-specific payload, optional language audience, and bounded language variants. IDs survive reordering.

## Project document

```text
ProjectDefinition
  catalog metadata
  supportedLanguageIds[]
  projectFacts[]
  starterWorkspace variants
  checkpoints[]
  finalValidators[]
  export metadata
```

Each checkpoint has ID, title, objective, shared blocks, tasks, cumulative validators, completion blocks, and mentor policy. Each task has ID, objective, instruction blocks, implementation-contract references, validators, hints, common mistakes, and variants.

## Implementation contracts

Store engineering facts once and project them into the guide, validators, and AI context:

```json
{
  "id": "contract-free-index",
  "symbol": "FREE_INDEX",
  "kind": "variable",
  "purpose": "Center card index",
  "languageVariants": {
    "python": { "typeDisplay": "int", "requiredValue": 12 },
    "java": { "typeDisplay": "int", "requiredValue": 12, "modifiers": ["static", "final"] },
    "cpp": { "typeDisplay": "int", "requiredValue": 12, "modifiers": ["constexpr"] }
  },
  "constraints": [{ "kind": "equals", "value": 12 }]
}
```

Function/method contracts add parameters (stable ID, name, semantic type, optionality), return semantics, behavior cases, side effects, visibility, and static requirements. Collections add shape and element type. Validators consume semantic types (`integer`, `list<integer>`), not prose display names.

## Language variants

Use shared defaults plus exact language overrides. Large blocks may use `variants`; whole starter workspaces use language-specific file sets. Resolution order is exact language -> default -> publication error if required. A language-only explanation is a normal block with `audience.languages`; shared blocks can reference language-specific snippet IDs.

Publishing must prove that every supported language resolves required blocks, commands, entrypoints, contracts, and validators. Do not duplicate whole guide documents merely to change snippets or type terminology.

## Bingo stress test

The contract must support roughly 17 tasks across fewer checkpoints, long explanations, Python/Java/C++ starter workspaces, contracts such as `FREE_INDEX` and `WIN_LINES`, task and cumulative validation, staged hints, and examples. Split storage by checkpoint while presenting one logical project; virtualize the long Admin canvas and provide outline navigation.

## Compatibility

- A Projects v1 adapter maps each legacy checkpoint to a generated single task when tasks are absent.
- Existing Course/Practice/Challenge `1.0.0` remains readable.
- Schema migrations are explicit pure transforms with fixtures; published bytes are never rewritten.
- Unknown required blocks fail publication; optional forward-compatible blocks render a controlled fallback.
