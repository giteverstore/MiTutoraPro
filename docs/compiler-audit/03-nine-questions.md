# Answers to the nine investigation questions

## 1. Language execution architecture

All nine requested languages currently have browser execution adapters registered by `src/compiler/createCompilerManager.js` from `src/compiler/languages/supportedLanguages.js`. Python uses Pyodide; Java uses the bundled javac/TeaVM engine; JavaScript uses a constrained worker evaluator; TypeScript transpiles then uses JavaScript; C/C++ use the bundled Clang/WASM native worker; C# uses browser .NET/Roslyn; PHP uses PHP-WASM; R uses webR. The detailed comparison and limitations are in [01-current-architecture.md](./01-current-architecture.md).

## 2. Browser versus server execution

For the nine-language learner compiler, execution is browser/worker based. Runtime initialization loads bundled or configured WASM/runtime assets and may issue asset fetches, but this is not submission to an external judge. Worker cancellation, timeout, capability filtering, and WASM boundaries improve resilience but are not authoritative isolation from a learner who controls the browser.

The repository has remote Go/Rust services and a deferred Python Firecracker judge; neither changes the current nine-language Practice/Challenge path. Client results can be modified, replayed, or bypassed, so they cannot safely authorize hidden-test completion or rewards.

## 3. Input and output handling

Program-mode stdin is text (arrays become newline-delimited text). Workers capture stdout/stderr and normalize exit code, status, diagnostics, warnings, and duration. Source/input/output limits are centralized in `compilerResourcePolicy.js`; runtime clients enforce timeouts by stopping/resetting workers.

The general manager validates printed output. Java has repository-specific method-runner support, and Practice metadata already models function contracts/public arguments, but there is no complete nine-language return/mutation/state ABI. Therefore printed program output is **supported**, generic return capture is **partially supported**, and generic structural/state validation is **not supported** today.

## 4. Shared compiler architecture

Course, Practice, and Challenges share `SharedCompilerDock`, `CompilerPanel`, `useCompilerExecution`, `CompilerManager`, runtime/language registries, editor sessions, output components, and validators. Course composes the dock in `Layout.jsx`; Practice and Challenges configure it in their respective pages.

Differences are page orchestration, content definitions, language availability, completion callbacks, and public-test/contract presentation. Practice passes public fixtures; Challenges currently passes none. Because Submit remains in the shared panel and validates browser output before calling completion, changing it globally would risk Course and all activity flows. Use an explicit execution strategy rather than route branching or a replacement editor.

## 5. Function-based evaluation compatibility

| Capability | Classification | Evidence/reason |
|---|---|---|
| Invoke a free function | PARTIALLY SUPPORTED | Java method mode and Python-oriented Practice contracts exist; no uniform nine-language ABI |
| Invoke class/static methods | PARTIALLY SUPPORTED | Java runner supports method metadata; no common implementation across nine languages |
| Structured arguments | PARTIALLY SUPPORTED | Public fixtures contain JSON-compatible arguments; runtime-wide tagged serialization is absent |
| Capture return values | PARTIALLY SUPPORTED | Specialized runners can encode results; general manager compares stdout |
| Linked lists/trees/graphs | NOT SUPPORTED | No canonical constructors/serializers/identity protocol in shared execution path |
| Preserve stateful object state | NOT SUPPORTED | No shared constructor-plus-operation sequence contract |
| Validate in-place mutations | NOT SUPPORTED | No mutation projection/snapshot protocol in shared validator path |
| Language-specific signatures | PARTIALLY SUPPORTED | Per-language definitions/templates exist, but no Blind 150 harness binding is integrated |
| Public per-case display | PARTIALLY SUPPORTED | `CompilerManager.executeTests` and public-test UI exist, but are stdout-centric |
| Hidden authoritative submit | NOT SUPPORTED in production | Server judge documentation explicitly says endpoint/worker/reward path are disabled |

## 6. Hidden test security

Current Practice definitions and public tests live in browser-imported source/content, so anything bundled, fetched to the browser, placed in public Storage, or exposed by source maps/network responses is not hidden. Client-side validation and Firebase rules cannot make data secret after it is delivered.

Protected fixtures, reference implementations, validator rules, and suite mappings must live in a server-only registry accessible only to the judge control plane. The browser should receive an opaque suite/version identifier at most. The API must derive/verify question bindings rather than trust client-supplied expected values. Server logs and diagnostics must also redact protected material.

## 7. Existing judge reusability

| Area | Decision | Rationale |
|---|---|---|
| Monaco/editor/session/language UI | REUSE | Independent of grading authority |
| Shared dock/output/error UI | EXTEND | Add per-case and queued/submission states |
| Browser runtimes | REUSE for Run | Good feedback loop; never authoritative for hidden Submit |
| Runtime normalization/timeouts | EXTEND | Reuse status vocabulary, add judge/sandbox statuses and tagged values |
| `executeTests`/stdout validators | EXTEND or REPLACE per Mode B | Useful orchestration, insufficient semantics |
| Completion callbacks | EXTEND | Must consume verified server result, not client assertion |
| Protected suite registry | NEW (production) | Existing Python contract is not deployed and only covers Python |
| Isolated execution workers | NEW/operationalize | Separate pinned profiles for every admitted language |
| Queue, quotas, result attestation | NEW | Required for abuse, concurrency, and trusted persistence |
| Existing Python Firecracker contract | EXTEND | Strong starting design; still explicitly validation-only/deferred |

## 8. Blind 150 integration

No Blind 150 archive, stable-ID manifest, canonical fixture corpus, 1,350 templates, reference implementations, or validation reports were found by repository search. The stated counts and actual file formats therefore cannot be verified. Integration should use an ingestion/validation pipeline that emits a public content artifact and a separately deployed protected suite registry; it must not assume an archive layout.

The existing Practice model can host title, prompt, difficulty, topic, public contract/tests, and language compiler definitions after schema extension. Daily Challenge can reference the same immutable question/version. Starter code is selected by language. Submission history needs source hash, question/suite/runtime versions, status/totals, timing, and audit IDs without hidden values.

## 9. Secure server-side judge requirements

Ordinary Vercel/Firebase serverless execution is suitable for authentication, validation, enqueueing, status reads, and persistence—not for directly executing hostile native/runtime code. A separate Linux/KVM worker service is required. The repository's selected design is a disposable Firecracker microVM per submission with a pinned minimal runtime, no network/credentials, read-only root, quota-limited scratch, non-root identity, cgroups, wall/CPU/memory/process/output limits, and verified teardown.

Add a bounded queue, per-user/IP/device quotas, concurrency caps, idempotency, cancellation, backpressure, encrypted internal authentication, audit/metrics, patch and image provenance, vulnerability gates, and cost alarms. Python should be first; Java and the remaining seven languages require separately measured and approved images/profiles. See [05-security-and-infrastructure.md](./05-security-and-infrastructure.md).
