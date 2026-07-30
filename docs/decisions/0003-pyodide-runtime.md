# ADR 0003: Pyodide for Browser Python Execution

- Status: Accepted
- Scope: Python runtime

## Context

The Python course requires real execution while the product has no compiler backend. The runtime must capture stdout, stderr, stdin, errors, and execution time without blocking the main UI. The compiler architecture must remain replaceable so future languages may use different local or remote runtimes.

## Alternatives

1. Simulated/mock output. Fast and deterministic, but cannot validate learner code and undermines exercises.
2. Remote execution service. Supports native environments and more languages, but requires backend security, quotas, isolation, and availability.
3. Transpile a Python subset to JavaScript. Smaller in some cases, but incomplete and behaviorally different from Python.
4. Pyodide (CPython/WebAssembly) in a Web Worker.

## Decision

Use Pyodide as the `python` `RuntimeAdapter`, isolated in a dedicated module worker. Load it lazily on first initialization, execute current source through `runPythonAsync`, redirect Python streams to in-memory buffers, and return the standard compiler result. The UI communicates only with `CompilerManager`.

## Consequences

### Positive

- Real Python runs entirely in the browser.
- No compiler backend is required.
- Worker isolation keeps initialization and execution off the UI thread.
- Python packages detectable from imports can be loaded by Pyodide.
- The concrete runtime remains replaceable.

### Negative

- Initial download and startup cost are substantial.
- Current assets load from jsDelivr and require network access.
- Pyodide package/native-extension compatibility is limited.
- Vite reports browser-externalized Node imports from the package.
- Resource limits and automatic timeouts need further hardening.

### Follow-up

Evaluate self-hosted assets, execution timeouts, and runtime capability reporting. Do not leak Pyodide APIs into React or the Learning Engine.
