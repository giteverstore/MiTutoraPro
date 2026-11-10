# Current compiler architecture

## Scope and evidence

This document describes repository state on 2026-11-06. It does not infer production capability from a language selector. Primary evidence is `src/compiler/`, `src/components/CompilerPanel.jsx`, `src/practice/PracticeDetail.jsx`, `src/challenges/ChallengesPage.jsx`, `api/compiler.js`, and the existing architecture documents.

Useful source anchors (line numbers at audit time): runtime registration is in `src/compiler/createCompilerManager.js:10-19`; the language catalog starts at `src/compiler/languages/supportedLanguages.js:27`; shared Submit is in `src/components/CompilerPanel.jsx:169-188`; manager-side public test iteration starts at `src/compiler/core/CompilerManager.js:135`; and the resource limits start at `src/compiler/core/compilerResourcePolicy.js:1`.

## Execution flow

`CompilerProvider` owns a `CompilerManager` created by `createCompilerManager()`. The latter registers every definition in `supportedCompilerLanguages` with `RuntimeRegistry`. `CompilerPanel` owns editor/session state and delegates execution to `useCompilerExecution`; the hook calls `CompilerManager.execute()`, which initializes and caches a runtime per language/instance. Results are normalized before `CompilerOutputRegion` renders them.

Course, Practice, and Daily Challenge surfaces reuse `SharedCompilerDock` and `CompilerPanel`. Course composition occurs in `src/components/Layout.jsx`; Practice in `src/practice/PracticeDetail.jsx`; Challenges in `src/challenges/ChallengesPage.jsx`. The page supplies content and completion callbacks, but the editor/runtime path is shared.

Concrete composition anchors are `src/components/Layout.jsx:320`, `src/practice/PracticeDetail.jsx:83-92`, and `src/challenges/ChallengesPage.jsx:149`. The latter currently passes `publicTests: []`.

## Language matrix

| Language | Runtime/compiler | Location | I/O mechanism | Important limitations |
|---|---|---|---|---|
| Python | Pyodide in `python.worker.js` through `PythonRuntime`/`PythonWorkerClient` | Browser Web Worker | Buffered/interactive stdin; captured stdout/stderr | Browser sandbox is not authoritative; package/runtime surface is Pyodide-specific; worker termination is the timeout boundary |
| Java | `javac`/TeaVM assets through `TeaVMJavaEngine` in `java.worker.js` | Browser Web Worker | Source rewriting supplies stdin; runner emits normalized result | Supports repository-specific program/method runner, not a general JVM; compatibility differs from OpenJDK; browser-visible harness |
| JavaScript | Worker evaluator with `javascriptCapabilityBoundary.js` | Browser Web Worker | Buffered/interactive stdin; captured stdout/stderr | Capability filtering is defense-in-depth, not a hostile-code security boundary; worker can be terminated |
| TypeScript | TypeScript transpilation followed by `JavaScriptRuntime` | Browser Web Worker after browser transpilation | Same as JavaScript | Type erasure; compiler/transpiler diagnostics and runtime behavior are browser-version dependent |
| C | Clang/WASM native toolchain through `NativeCompilerRuntime` | Browser Web Worker | virtual stdin and captured streams | WASM/virtual filesystem semantics; no authoritative isolation; bounded browser memory |
| C++ | Clang/WASM native toolchain through `NativeCompilerRuntime` | Browser Web Worker | virtual stdin and captured streams | Same as C; library/toolchain coverage is fixed by bundled artifacts |
| C# | Browser .NET/Roslyn worker through `DotNetRuntime` | Browser Web Worker | supplied stdin and captured stdout/stderr | Fixed browser .NET environment; not a trusted judge; package restoration is not a supported contract |
| PHP | PHP-WASM through `PhpRuntime`/`PhpWorkerClient` | Browser Web Worker | buffered/interactive stdin and captured streams | WASM extension surface differs from server PHP; worker termination supplies hard cancellation |
| R | webR through `RRuntime`/`WebRClient` | Browser worker/runtime | virtual `/tmp/ycoders-stdin`, captured output | webR package/native behavior differs from server R; startup can be large; not authoritative |

Language definitions are in `src/compiler/languages/`; runtime implementations are in `src/compiler/runtimes/`. The public compiler API also includes Go and Rust remote paths, but those are outside the nine-language scope and do not make the nine requested languages server-executed.

## Inputs, outputs, limits, errors

The normalized request includes language, source, stdin, filename, execution metadata, timeout, signal, and optional project files. Runtime clients convert array stdin to newline-delimited text. Interactive runtimes use execution events and bounded shared buffers. Normalized results retain status, stdout/output, stderr/errors, exit code, diagnostics, warnings, and duration.

`compilerResourcePolicy.js` defines source (512 KiB), buffered stdin (256 KiB), interactive input (32 KiB per submission/512 KiB per execution), stdout (2 MiB), stderr (1 MiB), and transcript (4 MiB) limits. Runtime clients enforce wall/compute timeouts principally by terminating or resetting workers. These controls protect the browser experience; they do not create a trusted grading boundary.

`CompilerManager.executeTests()` iterates tests and compares normalized stdout with validator strategies. It does not provide a language-neutral ABI for arbitrary return values, mutations, object identity, or stateful operation sequences.

## Current Run and Submit behavior

Run invokes the selected browser runtime and displays its normalized result. In lessons, `validateExecution()` preserves the existing expected-output/exercise verification path.

Practice and Challenge Submit in `CompilerPanel.submit()` performs the same browser execution, calls client-side `validateExecution(record)`, and only then calls the page's `onSubmit` completion callback. Practice passes `question.publicTests` and `question.contract` for presentation, but Submit is not an authoritative hidden-suite judge. Daily Challenge currently supplies an empty public-test list. Completion/reward persistence is separate from compiler execution.

The exact client trust sequence is visible at `src/components/CompilerPanel.jsx:176-181`. `functions/src/activity-verification/ActivityVerifier.js:17-45` defines a bounded server verifier/executor contract, but the repository's isolated-judge status below prevents treating that contract as an active production judge.

## Server-side code present in the repository

`api/compiler.js` exposes the public compiler router, and `server/remote-compiler/` supports separately isolated Go/Rust infrastructure. `functions/src/python-judge/` contains a server-only Python judge contract and Firecracker-oriented controller/worker work. However, `docs/architecture/isolated-code-judge.md` explicitly states that no production learner endpoint, worker, sandbox, or reward path is deployed. It must be treated as deferred infrastructure, not current product capability.

That status is stated at `docs/architecture/isolated-code-judge.md:7` and `:19`; the selected disposable-microVM target is described at `:69-80`.
