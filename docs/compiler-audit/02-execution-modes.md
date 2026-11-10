# Execution modes

## Required separation

### Mode A: standard program execution

Keep the existing Course path: editor source plus stdin enters `CompilerManager`, a browser runtime returns stdout/stderr/diagnostics, and lesson verification compares the expected program output. Do not add Blind 150 contracts to lesson definitions or alter lesson persistence.

### Mode B: function-based evaluation

Practice and Daily Challenge definitions need an explicit, versioned evaluation contract. It should identify the callable kind (`function`, static/instance method, or stateful sequence), typed arguments, result/mutation projections, comparison policy, starter templates by language, public suite version, and protected suite ID. The browser must receive public fixtures only.

## Recommended shared design

Retain `SharedCompilerDock`, `CompilerPanel`, Monaco/session state, language selection, output drawer, cancellation, and normalized errors. Add an execution-mode strategy below the UI:

```text
CompilerPanel
  -> execution coordinator
       -> Mode A program adapter -> existing CompilerManager
       -> Mode B public adapter  -> browser language harness
       -> Mode B submit client   -> authenticated judge API
```

Mode selection belongs to the normalized compiler/question definition, not route-name conditionals. Course content defaults to `program`; new Practice/Challenge content explicitly selects `function`. A schema version must prevent an old client from misinterpreting a new contract.

## Mode B public Run

1. Validate source size and contract locally.
2. Load the selected public, language-specific harness.
3. Compile once where practical.
4. Invoke each public fixture with canonical serialized arguments.
5. Capture return value plus declared mutation/state projections.
6. Normalize using a cross-language value protocol.
7. Render input, expected, actual, duration, and safe error per case.

This can extend the existing browser adapters, but must not reuse stdout comparison as the function result protocol. Public harnesses and fixtures are intentionally inspectable.

## Mode B Submit

1. Client sends question ID, immutable question/version ID, language, source, idempotency key, and authentication/session binding—never expected results.
2. API authenticates, authorizes, rate-limits, validates content bindings, and enqueues.
3. An isolated worker resolves the protected suite server-side, builds the pinned language harness, and executes under hard limits.
4. The controller compares protected results outside the learner process where possible.
5. A signed/internal result service records a bounded result and updates progress/rewards idempotently.
6. Client receives totals and sanitized failure categories only; hidden inputs, expected values, stack frames, harness internals, and validator details remain private.

Compilation/runtime failures, semantic failures, and infrastructure failures need distinct statuses. Infrastructure failure must never be counted as a wrong answer or grant completion.

## Cross-language value protocol

Define tagged values rather than relying on JSON alone: null, boolean, bounded integer, floating point (including NaN/infinity policy), string/Unicode, array, tuple/list distinction if required, map/object with ordering policy, linked list, tree, graph, and opaque node IDs for identity. Mutation checks need named projections (`argument[0]`, object fields, traversals). Stateful problems require constructor arguments followed by ordered calls and expected outputs.

Specify integer range and overflow per question, float tolerance, negative zero, Unicode normalization, duplicate graph edges, cycles, and deterministic map ordering. R needs explicit scalar/vector/list/data-frame encoding and one-based/indexing-aware harness behavior.

## Preservation rules

- Saved code keys must include question, language, and schema/template version.
- Existing Mode A definitions continue through the old path.
- Existing completion records remain readable; authoritative Mode B records add judge/suite/runtime versions.
- Public Run may be optimistic and local; only a successful authoritative Submit may grant protected completion/rewards.
