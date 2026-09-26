# PHP browser runtime

## Selected runtime

YCoders uses the WordPress Playground PHP-WASM packages pinned to PHP 8.4:

- `@php-wasm/universal@3.1.55`
- `@php-wasm/web-8-4@3.1.55`

The version-specific package was selected instead of `@php-wasm/web` so the
installation and bundle do not contain every supported PHP minor. It is an
actively maintained browser build, supports Vite asset emission, runs without
a backend PHP service, and provides a CLI SAPI, stdout/stderr streams, an
in-memory filesystem, and stdin hooks.

## Execution architecture

```text
CompilerManager
  -> PhpRuntime
  -> PhpWorkerClient
  -> disposable Web Worker
  -> PHP 8.4 WASM CLI
  -> shared compiler result
```

The worker and its PHP instance are created for one execution only. Success,
error, timeout, cancellation, reset, disposal, or component unmount terminate
the worker. The virtual filesystem, including `/tmp/main.php`, is therefore
ephemeral and cannot access the learner's real filesystem.

The worker is lazy-loaded only after PHP is selected and Run is invoked. Vite
emits the worker, loaders, and WASM as separate cacheable assets; they are not
part of the initial application JavaScript chunk.

## Terminal behavior

- CLI source file: `main.php`
- Monaco language: `php`
- Default timeout: 10 seconds
- stdin: UTF-8 input from the shared compiler input field, including multiline
  input, exposed through PHP's standard `STDIN` stream
- stdout: `echo`, `print`, `printf`, `var_dump`, and normal CLI output
- stderr: parse errors, fatal errors, uncaught exceptions, and PHP diagnostics
- error display is disabled on stdout so diagnostics do not contaminate output
  validation

## Runtime capabilities

The shipped PHP 8.4 build supports standard PHP variables, strings, arrays,
associative arrays, loops, functions, classes, objects, exceptions, namespaces,
SPL, JSON, mbstring, date/time, and standard string/array functions. Browser
smoke checks explicitly verified JSON, mbstring, SPL, and date extension
availability.

This phase intentionally does not provide Composer, arbitrary packages, a web
server, MySQL/PostgreSQL extensions, persistent files, sockets, or an YCoders
API/Firebase/browser-storage bridge. The low-level version-specific loader does
not install WordPress Playground's browser networking integration.

## Browser requirements and limitations

The runtime requires WebAssembly, ES module Web Workers, `ReadableStream`, and
`TextEncoder`. The package supplies JSPI and Asyncify variants and selects the
supported mode at runtime. Asyncify provides the compatibility path for
browsers without JSPI. SharedArrayBuffer and cross-origin isolation are not
required by this non-threaded configuration.

The PHP package contains Emscripten-generated `eval` use, which Vite reports at
build time. PHP code still executes inside a disposable worker, but the worker
is not a hardened hostile-code sandbox. The 10-second termination boundary and
ephemeral runtime limit hangs and state retention; memory exhaustion remains a
general browser-WASM risk.
