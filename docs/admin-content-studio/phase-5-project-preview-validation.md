# Phase 5: Project preview and trusted validation

Status: implemented locally; not published or deployed.

## Preview

`Preview & Test` operates on the current in-memory/local Project draft. It reuses `ProjectGuideRenderer`, now extended to canonical common blocks and exact language-variant resolution. Checkpoint/task navigation, completion blocks, implementation contracts, and per-language starter workspaces render without creating learner state or cloud records. Preview state is ephemeral.

The derived mentor-context disclosure uses `deriveMentorContext`; it makes no provider call and consumes no quota.

## Trusted execution boundary

`TrustedDescriptorExecutor` validates each descriptor schema, performs a version-aware trusted-registry lookup, checks language applicability, and dispatches only platform-owned implementations. `file_exists` and bounded `source_pattern` run without compilation. `execution_succeeds`, `output_contains`, and `runtime_scenario` use the existing `ProjectExecutionService` and compiler manager with a ten-second request bound and 64 KiB stdout/stderr presentation cap. `function_behavior` is reported unsupported rather than injecting an authored harness.

The Admin compiler manager registers only the launch preview matrix—Python, Java, and C++—and lazy-loads after an explicit Run action. Test files are cloned from starters and Reset restores the clone; edits never change authored starter files.

Reviewers may edit this temporary validation-workspace clone and inspect results because it cannot mutate authored content or learner state; their Project authoring controls remain read-only.

| Validator v1 | Python | Java | C++ |
|---|---:|---:|---:|
| execution_succeeds | yes | yes, runtime limitations surfaced | yes |
| output_contains | yes | yes | yes |
| file_exists | yes | yes | yes |
| source_pattern | yes | yes | yes |
| function_behavior | unsupported | unsupported | unsupported |
| runtime_scenario | yes | yes, runtime limitations surfaced | yes |

Randomized Projects should use declarative repeated runtime scenarios, output invariants, safe source structure, and file invariants. Exact random output is intentionally not assumed. Arbitrary harness source, authored shell commands, dynamic modules, raw HTML, learner persistence, publishing, and AI execution are not available.
