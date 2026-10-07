# Incremental migration plan

## 1. Inventory and normalize

Create read-only adapters for bundled Projects, course manifests/modules, Practice artifacts, and Challenge artifacts/references into canonical versioned read models. Produce fixtures from current production content and snapshot semantic rendering.

## 2. Shared contracts

Extract schemas, cross-reference checks, limits, language IDs, and validator descriptors. Existing CLIs consume the same pure functions. Learner loading remains unchanged.

## 3. Drafts and preview

Admin imports existing artifacts, edits, previews, and exports deterministic publisher inputs. Start export-only with publishing disabled and compare hashes/semantics to current repository pipelines.

## 4. Projects pilot

Import CLI Task Manager through the compatibility adapter and author Bingo natively. Add published-project repositories alongside bundled `ProjectCatalog`; select source by controlled gate. Pin all new active projects to versions.

## 5. Progress migration

Deploy Active Project v2 reader/rules and an idempotent v1 -> v2 migration. Existing checkpoints map to synthetic legacy tasks; never infer new Bingo task completion.

## 6. Publish pilot

Enable role-limited staging, then Bingo production publication. Prove Python/Java/C++ variants, workspaces, validators, AI context, ZIP export, persistence, pinning, and rollback.

## 7. Other domains

Courses migrate first because their schema and versioned publisher are mature. Practice follows with problem-specific forms and protected tests. Challenges follow while retaining Practice references and trusted reward resolution. Keep dual readers until evidence is stable.

## Compatibility rules

- existing paths remain readable
- active pointer changes are reversible
- old schema readers remain until end-of-life
- renderer changes retain old-version fixtures
- progress references exact content version
- remove no repository content until published parity and rollback exist

Per-item success evidence: schema, deterministic hash, Admin/learner parity, language matrix, positive/negative validator fixtures, rule tests, failed-publish recovery, rollback, pinned learner continuity, and accessibility.
