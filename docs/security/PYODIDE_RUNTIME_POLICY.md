# Pyodide runtime capability and state policy

## Scope and lifecycle

YCoders executes learner Python with Pyodide 314.0.3 in a module Web Worker. Each Run initializes a new worker and Pyodide virtual machine, executes one program, returns its normalized result, and terminates the worker. Timeout, cancellation, reset, language change, output-limit termination, and disposal also terminate the worker. A later Run creates a new worker.

This intentionally trades warm-start latency for deterministic isolation. Browser HTTP caching may retain immutable Pyodide runtime assets, but no learner-visible Python VM is reused.

## Capability policy

Allowed:

- Python's Pyodide-compatible standard library, except the network-capable modules listed below.
- Modules already included in the Pyodide base runtime that do not require a package download and do not cross the browser capability boundary.
- Ephemeral in-memory filesystem operations.
- Buffered and interactive stdin, stdout, and stderr through the compiler protocol.

Controlled:

- Optional Pyodide packages are not currently allowlisted. Adding one requires a reviewed, pinned package mapping and cancellation/resource validation.

Denied:

- Automatic package discovery or download (`loadPackagesFromImports`).
- `micropip`, direct URL installs, and arbitrary package installation.
- Learner imports of `js`, `pyodide`, `_pyodide`, `socket`, `http.client`, `http.server`, and `urllib.request`.
- Browser network/storage/worker bridges including `fetch`, XMLHttpRequest, WebSocket, EventSource, IndexedDB, Cache Storage, BroadcastChannel, and nested Worker creation.
- Access to the compiler manager, execution controllers, application state, Firebase/auth data, or browser UI globals.

The worker captures its private host-response channel before removing learner-visible host capabilities. `window`, `document`, and `localStorage` are not present in the worker environment. The Python import guard is defense in depth; the disposable worker with stripped host capabilities is the primary boundary. Pyodide is still an in-browser execution isolation mechanism, not a hardened hostile-code sandbox.

## State reset model

The worker is destroyed after every completed or interrupted execution. Consequently learner globals, `sys.modules` changes, monkey patches, environment variables, current directory, files, loaded package state, stdin cursors/queues, output buffers, and JS proxy references do not cross Run boundaries. Only the browser's immutable HTTP cache may persist downloaded runtime assets.

Execution messages are keyed to the pending request. Unknown or stale request IDs are ignored. Interactive stdin submissions additionally require the active execution ID. Cancelling an input wait terminates the worker, invalidates its SharedArrayBuffer channel, and rejects late submissions.

## Package and network behavior

Imports never trigger network package resolution. A module absent from the base runtime fails with Python's normal `ModuleNotFoundError`; a policy-blocked module fails with an explicit `ImportError`. There is no package-load cancellation state because package loading is not exposed. Cancellation during base-runtime initialization terminates the worker and the next Run starts cleanly.

## Resource and cancellation behavior

Shared compiler policy remains authoritative: 512 KiB source, 256 KiB buffered stdin, 32 KiB per interactive submission, 512 KiB cumulative interactive input, 2 MiB stdout, 1 MiB stderr, and 4 MiB terminal transcript. Python computation defaults to 10 seconds, input wait to 90 seconds, and initialization to 60 seconds. Limit, timeout, and cancellation paths terminate the worker before recovery.

## Known limitations

- Every Run pays Pyodide VM initialization cost; browser caching reduces transfer cost but not VM startup.
- Some standard-library modules are unavailable or constrained by WebAssembly/Pyodide itself.
- Third-party packages, even packages distributed by Pyodide, are unavailable until explicitly reviewed and allowlisted.
- Memory exhaustion is constrained by browser/Worker behavior rather than a hard per-worker memory quota. Termination and the shared source/output limits reduce, but do not eliminate, browser resource-exhaustion risk.
