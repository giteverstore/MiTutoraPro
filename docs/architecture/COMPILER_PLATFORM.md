# Compiler platform

## Overview

Y Coders exposes 17 learner-facing technologies through one compiler definition, lifecycle, validation, and result UI. The canonical language registry owns product metadata; content owns which registered technology is available for a Course, Practice question, or Challenge. Registration never grants production execution by itself.

## Supported technologies and status

| Technology | File / Monaco | Mode | Provider | Validation | Production infrastructure |
| --- | --- | --- | --- | --- | --- |
| Python | `main.py` / `python` | terminal | browser | ready | none |
| Java | `Main.java` / `java` | terminal | browser | ready | none |
| JavaScript | `main.js` / `javascript` | terminal | browser | ready | none |
| TypeScript | `main.ts` / `typescript` | terminal | browser | ready | none |
| HTML/CSS | `index.html` / `html` | preview | browser | ready | none |
| React | `App.jsx` / `javascript` | preview | browser | ready | none |
| SQL / SQLite | `query.sql` / `sql` | database | browser | ready | none |
| MySQL | `query.sql` / `sql` | database | backend | locally validated | managed MySQL required |
| C | `main.c` / `c` | terminal | browser | ready | none |
| C++ | `main.cpp` / `cpp` | terminal | browser | ready | none |
| PHP | `main.php` / `php` | terminal | browser | ready | none |
| R | `main.R` / `r` | terminal | browser | ready | none |
| C# | `Program.cs` / `csharp` | terminal | browser | ready | none |
| Visual Basic.NET | `Program.vb` / `vb` | terminal | browser | ready | none |
| x86-64 Assembly | `main.asm` / `asm` | emulator | browser | ready | none |
| Go | `main.go` / `go` | terminal | remote | locally validated | isolated runner required |
| Rust | `main.rs` / `rust` | terminal | remote | locally validated | isolated runner required |

HTML/CSS is one product technology. SQL/SQLite and MySQL are distinct technologies with different trust boundaries, not aliases that inflate the count.

## Registry and capability model

`supportedCompilerLanguages` is the canonical ordered registry. Definitions own the ID, label, default filename, Monaco language, starter source, execution mode/provider, and runtime factory. `normalizeCompilerDefinition` converts canonical and legacy content shapes into the shared model. UI selection and the development override derive from the registry; mode-specific result panels derive from `executionMode`.

Language-specific code remains only where semantics require it: toolchain adapters, filenames/starters, worker implementations, Go/Rust server policy, MySQL authority, .NET language selection, and Assembly emulation. These are not alternate registries.

## Execution and result architecture

`CompilerManager` owns runtime initialization, execution, cancellation, reset, and disposal. Results use milliseconds (`executionTimeMs`, and `compileTimeMs` where meaningful), a status, stdout/stderr where applicable, errors, diagnostics, and warnings. Preview results add iframe evidence; database results add result sets/affected rows; emulator results add registers, flags, memory, and instruction evidence; remote results add the toolchain version.

Statuses include `success`, generic browser `error`, and the more specific remote outcomes `compile_error`, `runtime_error`, `timeout`, `cancelled`, `output_limit`, and `infrastructure_error`. Provider-specific fields are not fabricated for unrelated runtimes.

Reset, content changes, and language changes dispose or reset the active adapter before loading canonical starter/input state. Worker clients clear timers and abort listeners and terminate disposable workers. Preview documents are replaced, database instances are ephemeral, Assembly state is worker-owned, and remote execution uses a fresh container.

## Browser runtimes and lazy loading

Python, Java, JavaScript, TypeScript, C/C++, PHP, R, .NET, SQLite, Assembly, HTML/CSS, and React execute in browser workers or isolated preview frames. Heavy runtime assets are loaded by their runtime/worker path rather than the initial application entry. Production builds emit separate chunks/assets for Monaco, TypeScript/Babel, SQLite, Clang, PHP, webR, .NET, NASM/Blink, and preview support.

## Preview security

HTML/CSS and React render into `srcDoc` frames with `sandbox="allow-scripts"` and without `allow-same-origin`. Message handling verifies the iframe source window, expected channel, and message type. Preview code receives no Firebase objects, authentication token, application state, or browser-storage bridge.

## Database boundaries

SQLite is browser-only, per-run, and does not intentionally use OPFS or IndexedDB persistence. MySQL is a separate authenticated backend boundary: canonical content supplies setup SQL, learners receive isolated schemas/users with reviewed grants, execution and cleanup are bounded, distributed quotas are authoritative, the janitor is authenticated, and production requires TLS. Status is `MYSQL_REPOSITORY_READY_FOR_PROVISIONING`; no production MySQL service is provisioned.

## Assembly emulator

Assembly uses the NASM/Blink worker-backed emulator. It exposes the reviewed syscall subset rather than forwarding host syscalls, enforces instruction and wall-time limits, terminates on disposal/timeout, and normalizes BigInt register evidence for transport. Interactive debugging and richer source mapping are deferred enhancements.

## Shared .NET runtime

C# and Visual Basic.NET share `DotNetRuntime`, one worker/client protocol, .NET/Roslyn assets and references, stdin/stdout/stderr capture, timeout handling, and evidence normalization. Only source language, filename, starter, and compilation selection differ.

## Remote Go/Rust runner

The browser calls only the authenticated Y Coders API. Runner URL, Docker details, HMAC secret, container commands, and filesystem policy remain server-side. The control plane authenticates Firebase identity, resolves canonical published content and entitlement, applies transactional per-user/global quotas, and signs the internal request with replay-protected HMAC evidence.

Each execution receives a disposable non-root container with no network, read-only root, all capabilities dropped, no-new-privileges, one CPU, 512 MiB memory/swap ceiling, 64 PIDs, 128 file descriptors, 64 MiB per-file limit, 96 MiB `/work`, 192 MiB `/tmp`, 64 KiB source/stdin inputs, independent 1 MiB stdout/stderr bounds, 15-second compilation, and 10-second learner execution.

Go's reviewed standard-library cache is baked into the immutable image layer. It contains no learner input and is consumed read-only; source, binaries, module state, `/work`, and `/tmp` are execution-local. The runner no longer copies approximately 95 MB/1,393 cache files per run. Cache write, replacement, cross-execution discovery, and poisoning tests pass. Server-owned build flags deliberately preserve the preseeded cache keys.

Local status is `REMOTE_COMPILER_RUNNER_LOCALLY_VALIDATED`; this is not a production deployment claim.

## DEV override and production restrictions

The unrestricted selector is guarded by the development build boundary and derives all 17 entries from the registry. Overrides create execution-only definitions, leave canonical content untouched, and remove completion/expected-output authority. Production Course, Practice, and Challenge availability remains content-driven; query strings, local storage, and registry membership do not authorize execution or completion.

Server gates use exact fail-closed `true` parsing. Defaults are:

| Gate | Default |
| --- | --- |
| `MYSQL_RUNTIME_ENABLED` | `false` |
| `MYSQL_DISTRIBUTED_QUOTA_ENABLED` | `false` |
| `MYSQL_ALLOW_DEV_SETUP_SQL` | `false` |
| `REMOTE_COMPILER_RUNTIME_ENABLED` | `false` |
| `REMOTE_COMPILER_DISTRIBUTED_QUOTA_ENABLED` | `false` |
| `GO_RUNTIME_ENABLED` | `false` |
| `RUST_RUNTIME_ENABLED` | `false` |

## Validation and learner errors

Expected-output validation consumes normalized execution evidence and never treats editor/compiler success alone as canonical learning completion. Course, Practice, and Challenge completion remains server-authoritative. Learner errors retain useful line/column information, Rust diagnostic codes, SQL errors, and panic/exception messages while removing workspace paths, container identifiers, credentials, connection strings, and internal stacks.

## Production dependencies

Browser runtimes need no execution backend. MySQL needs a MySQL 8.4 provider, private/secure network path, TLS, credentials, monitoring, cleanup, and a live production preflight. Go/Rust need a dedicated patched runner host, immutable images in a private registry, private authenticated ingress, deny-by-default egress, Docker-compatible isolation, resource/cleanup monitoring, and a production live preflight. No compiler backend feature should be enabled before its infrastructure gate passes.

## Runtime dependency and license inventory

Major families include SQLite WASM (`@sqlite.org/sqlite-wasm`, package metadata: Apache-2.0), Clang WASM (`@live-codes/clang-wasm`, MIT), PHP-WASM packages (package metadata includes GPL-2.0-or-later), webR/R, .NET/Roslyn WASM, NASM/Blink assets, and official Go and Rust toolchain images. Distribution must retain upstream notices and satisfy each packaged asset's license/source obligations. This inventory records package metadata; it is not legal advice. Before production publication, reconcile copied binary asset receipts and upstream NOTICE/LICENSE files with the release artifact.

## Current scope boundaries

Non-blocking deferred work includes Assembly stepping/source mapping, arbitrary Go modules, arbitrary Cargo crates, arbitrary NuGet or R package installation, arbitrary React npm imports, richer artifact handling, R plots, a public compiler subdomain, and additional languages. These are enhancements, not incomplete current runtime implementations.

## Adding a language later

Add a single registry definition and a conforming runtime adapter, choose an existing execution mode/provider where possible, define starter/filename/Monaco metadata, preserve content authority, implement lifecycle and normalized evidence, validate security and lazy loading, and add registry-derived tests. A new language must not introduce a page-specific selector list or bypass production content policy.

Related detailed documents live under `docs/analysis/` for MySQL, Assembly, .NET-family runtimes, PHP, R, and the remote Go/Rust runner.
