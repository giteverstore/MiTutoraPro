# Implementation roadmap

## Phase 0: contracts and decisions

Approve architecture, role matrix, compatibility policy, lifecycle, and package boundaries. Extract only pure validation APIs while preserving CLI behavior. Threat-model claims, IAM, and preview isolation.

Acceptance: current content validates through shared functions; no learner behavior changes; product decisions in `README.md` resolved.

## Phase 1: isolated Admin shell and auth

Status: foundation implemented locally. The separate Vite package, responsive Admin navigation, Firebase sign-in, trusted claim bootstrap, central permissions, server authorization utility, safe placeholders, and deployment configuration are present. No Admin content API or audit backend exists yet.

Likely areas: new `apps/admin`, shared token utility, Admin API middleware, emulator tests. Acceptance: authorized roles enter; anonymous/wrong-role identities are denied by both API and UI; build/deployment is independent.

## Phase 2: structured editor

Contract foundation status: implemented in `shared/content`. The envelope, Project/checkpoint/task schemas, common blocks, language variants, implementation contracts, trusted validator descriptors, mentor configuration, normalization, and legacy Project adapter are ready.

The visual structured editor remains future work: build accessible palette/canvas/properties/outline, revisioned autosave, constrained common blocks, and import/export.

Security: sanitized rich text/media and conflict handling. Acceptance: long document keyboard editing, compare/fork conflict flow, deterministic serialization, field-linked errors.

## Phase 3: Projects and task model

Add project/checkpoint/task hierarchy, contracts, variants, starter workspaces, and adapters. Later affected areas include Projects models/catalog/repositories/guide renderer/runtime contracts and Active Project rules.

Acceptance: CLI Task Manager import parity; a Python/Java/C++ fixture fully resolves; v1 progress remains readable.

## Phase 4: validation, AI, real preview

Add form-driven descriptors, positive/negative fixtures, actual learner renderer preview, and derived mentor context.

Security: no arbitrary authored execution; protected evidence server-only; preview cannot mutate learner state/rewards. Acceptance: task/cumulative validators work across languages; context/reveal tests and renderer parity pass.

## Phase 5: publish and history

Add review, validate, immutable publish, audit, rollback/archive, and assets. Dependencies: WIF/IAM, Storage/rules, compatibility gate.

Acceptance: failures never change active pointer; retries idempotent; rollback audited; publishing disabled until explicit approval.

## Phase 6: Bingo dogfood

Author the full roughly 48-page/17-task curriculum into fewer checkpoints without losing detail.

Acceptance: Python/Java/C++ completeness; contracts drive guide/validation/AI; durable tasks plus cumulative checks; accessible performant long editor; version rollback and pinned learner smoke.

## Phase 7: Courses, Practice, Challenges

Move mature domains in that order. Courses reuse blocks/split modules; Practice adds problem/protected-test forms; Challenges preserve Practice references and trusted rewards.

Acceptance: round-trip current artifacts without semantic drift; existing CLIs remain; publication needs no learner frontend deployment.

## Phase 8: operational hardening

Add monitoring, retention/janitors, audit review, backup/export, budgets, and incident/rollback runbooks.

Acceptance: alerts, recovery exercise, role review, orphan cleanup proof, measured cost/load, release checklist.

## Sequencing constraints

Do not publish before contracts, authorization, audit, and immutable artifacts. Do not migrate progress before version pinning. Do not expose custom validators before isolation/review. Do not remove bundled content before production parity and rollback evidence.
