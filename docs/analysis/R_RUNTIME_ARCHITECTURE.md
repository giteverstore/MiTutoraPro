# R browser runtime

## Selected runtime

YCoders uses `webr@0.6.0`, the stable upstream webR npm release. It ships R
4.6.0, built with Emscripten 4.0.8. webR was selected because it is the
maintained browser/WASM distribution of real R, retains native R printing and
condition behavior, includes the base/recommended teaching packages and
datasets, and already owns a Web Worker communication boundary.

## Execution architecture

```text
CompilerManager
  -> RRuntime
  -> WebRClient
  -> webR PostMessage channel
  -> webR-managed Worker
  -> R 4.6.0 WASM
  -> shared compiler result
```

YCoders does not add an outer worker. A nested YCoders worker would add another
message boundary without improving termination: webR's PostMessage channel
already exposes `close()`, which directly terminates its worker.

Each Run creates a fresh webR instance. Success, error, timeout, cancellation,
reset, disposal, language changes, and unmount all close it. This costs a new R
startup per Run, but cached static assets make subsequent starts cheaper and it
guarantees that learner variables, open connections, loaded state, and files do
not leak between Course, Practice, or Challenge executions.

## Communication and timeout

The runtime explicitly selects `ChannelType.PostMessage`. It therefore does not
require SharedArrayBuffer, COOP, COEP, cross-origin isolation, or a Service
Worker. PostMessage cannot interrupt R in place. YCoders instead enforces its
10-second execution timeout by terminating the entire webR worker and creating
a clean instance on the next Run. A real Chromium test verified timeout of
`while (TRUE) {}` followed by a successful execution.

## Self-hosted assets

Runtime files are copied from the pinned npm package into `public/webr/`:

- `R.js`
- `R.wasm`
- `libRblas.so`
- `libRlapack.so`
- `webr-worker.js`
- the lazy `vfs/` filesystem and package metadata

`baseUrl` points to the YCoders origin. The webR API is dynamically imported
only when R is executed. No third-party runtime CDN is required for normal R
execution. Hashed application chunks and static runtime assets can be cached by
the browser/CDN.

## Terminal and evidence behavior

- Registry filename: `main.R`
- Monaco language identifier: `r`
- Normal output from `print()` and `cat()` maps to stdout.
- `message()` maps to stderr.
- Warnings remain non-fatal and are retained in `warnings` plus structured R
  condition evidence.
- R errors map to failed execution, stderr, and a structured error condition.
  `exitCode` remains `null` because webR evaluation does not expose a real
  process exit code; `r.evaluationStatus` records the honest evaluation state.
- Native R output such as `[1]` is not stripped or rewritten.
- Plot capture is disabled for this terminal-only phase, but webR's `captureR`
  already returns `ImageBitmap[]`; a future compiler-artifact extension can
  expose those images without introducing an R-specific execution mode.

## Input compatibility

PostMessage does not support synchronous interactive nested REPL input. YCoders
writes the shared terminal input to an ephemeral `/tmp/ycoders-stdin` file and
provides execution-local `readLines("stdin", ...)` and `readline()` adapters.
One-line, multiline, and EOF behavior are deterministic and do not use browser
dialogs. Other `readLines()` connections retain base R behavior.

## Filesystem, packages, and data

The Emscripten filesystem is private to the webR worker and is destroyed after
each Run. No host filesystem, browser file picker, persistent IDBFS mount, or
automatic download integration is enabled.

The shipped base/recommended environment includes base, compiler, datasets,
graphics, grDevices, grid, methods, parallel, splines, stats, stats4, tcltk,
tools, utils, and the webR support package. `mtcars`, `iris`, and `airquality`
are available through `datasets`. Browser tests verified `mtcars`, `lm()`, and
the stats, utils, graphics, datasets, and methods namespaces.

webR can install precompiled packages from compatible repositories, but YCoders
does not expose package installation in this phase. dplyr, ggplot2, and tidyr
are not bundled. Arbitrary native compilation and a package marketplace are
unsupported.

## Security and limitations

R executes away from the React main thread and has no direct access to the DOM,
React state, Firebase SDK instances, authentication tokens, browser storage, or
the user's filesystem. webR/WASM is not a hardened hostile-code sandbox.
Worker termination limits runaway CPU time, but browser memory exhaustion is
still possible. The upstream runtime contains networking/package-download
capabilities; YCoders exposes no package-install or network UI, but this phase
does not claim a cryptographic network sandbox.
