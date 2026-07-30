# Pyodide Runtime

Python executes in the browser through Pyodide. The implementation is isolated under `src/compiler/runtimes/python/`.

## Components

- `PythonRuntime`: `RuntimeAdapter` implementation.
- `PythonWorkerClient`: request/response, cancellation, and worker lifecycle.
- `python.worker.js`: Pyodide loading and Python execution.
- `outputCapture.js`: converts worker payloads to the standard compiler result.

## Initialization

The worker imports `loadPyodide` and derives the CDN URL from the installed package version. Pyodide assets are loaded from jsDelivr on first initialization. Consequently, the first Python run requires network access to that CDN unless assets are later self-hosted.

## Execution

The worker:

1. loads packages detected from imports;
2. places source, stdin, and filename into Pyodide globals;
3. replaces Python `sys.stdout`, `sys.stderr`, and `sys.stdin` with in-memory streams;
4. compiles and executes the current source as `__main__`;
5. captures tracebacks in stderr;
6. restores the original streams;
7. returns status, stdout, stderr, and measured execution time.

Execution is asynchronous and isolated from the UI thread. Expected output is never passed to the runtime.

## Cancellation and disposal

Each worker request has an ID. Aborting a request rejects pending work and terminates the worker, guaranteeing that a later execution starts with a clean worker. Disposing the runtime rejects pending requests and releases the worker.

## Constraints

- Browser security and WebAssembly constraints apply.
- Pyodide package compatibility differs from native CPython.
- Initial download size and startup time are material.
- Infinite or resource-heavy programs currently rely on worker termination initiated by cancellation; an automatic execution timeout is roadmap work.
