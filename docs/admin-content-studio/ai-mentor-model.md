# Project AI mentor model

## Current path

Projects capture an explicit selection, build bounded context in `projectAIContext.js`, and send authenticated requests through `ProjectAIClient` to `/api/ai/explain`. Selected content is capped at 8,000 characters; guide context at 2,000; current file at 12,000; terminal context at 6,000; conversation at six turns. Existing authentication, Premium access, quota, provider abstraction, and server safety remain authoritative.

## Structured source

Do not author a second giant prompt. Assemble context from published structures:

- project terminology, architecture facts, invariants, objectives
- checkpoint objective, prerequisites, expected state
- task objective, contracts, behavior, common mistakes
- ordered hint policy and escalation level
- introduced concepts and `doNotRevealUntilTaskIds`
- resolved language types/snippets/commands/starter information
- public validator summaries, never protected tests or solutions
- optional bounded `additionalMentorContext` for facts that cannot be modeled

## Assembly boundary

Assemble server-side after resolving the authoritative published version and authorizing the learner/project. The browser supplies selection evidence plus project/version/task IDs. The server verifies IDs, resolves facts, applies reveal boundaries, and constructs the provider request. A modified browser must not unlock future solutions or hidden tests.

## Hint escalation

Tasks may define: conceptual nudge, focused diagnostic hint, small non-solving language example, and fuller solution only after explicit permitted escalation. Store structured `level`, concept IDs, language audience, and reveal policy. A reveal boundary is enforced server policy, not prose the model may ignore.

## Budget and privacy

Preserve explicit selection and data minimization. Never send the entire workspace, unrelated files/history, profile data, other projects, hidden validators, or permanent conversations. Budget policy/facts first, task contracts next, selection evidence next, and recent turns last. Truncate at structural boundaries.

Every request identifies content version, task, schema, mentor-policy, and provider configuration in non-content telemetry. Published mentor facts are immutable with content; prompt templates version separately.

## Authoring UX

Show a read-only assembled-context preview derived from contracts/tasks. Authors edit additional facts, hints, terminology, and reveal rules. Validation flags duplication, excessive context, dangling concept IDs, and premature solution exposure.
