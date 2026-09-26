# C# browser runtime architecture

## Decision

YCoders uses the official single-threaded .NET 10 browser-WASM runtime with
Roslyn hosted inside a disposable module worker. The current pinned build is
.NET 10.0.12, Microsoft.CodeAnalysis.CSharp 5.9.0, and C# 14.

```text
CompilerManager
  -> DotNetRuntime (language adapter)
  -> DotNetWorkerClient (lifecycle and deadline)
  -> disposable module Worker
  -> official .NET browser-WASM host
  -> Roslyn CSharpCompilation
  -> dynamic managed assembly
```

The host is built from `tools/dotnet-runtime` and published into
`public/dotnet`. It embeds the .NET reference assemblies used by Roslyn, but
loads runtime implementation assemblies from the self-hosted framework bundle.
No remote compiler API or third-party runtime CDN participates in execution.

## Lifecycle and cancellation

Every Run creates a new Worker and .NET runtime. The worker is terminated after
success, compile failure, runtime failure, cancellation, timeout, reset, or
disposal. Static fields, dynamically loaded assemblies, GC heaps, and the
virtual filesystem therefore cannot leak into another canonical execution.

Initialization has a separate 30-second bound. The execution deadline starts
after the worker reports that .NET and Roslyn are initialized and defaults to
10 seconds. Browser-WASM cannot reliably interrupt arbitrary synchronous
learner IL in place, so timeout terminates the entire worker. A real Chromium
probe verified that `while (true) {}` times out and a subsequent clean worker
successfully executes C#.

## Compiler and execution

Roslyn parses with `LanguageVersion.CSharp14`, compiles with nullable analysis
and warning level 4, and emits a temporary in-memory assembly. Both conventional
`Program.Main` and top-level statements are supported. Compiler diagnostics
retain code, severity, line, column, and message. Warnings are nonfatal.
Unhandled learner exceptions are reduced to the .NET exception type and message
without exposing WASM host stacks.

The runtime redirects `Console.Out` and `Console.Error` independently. Since
`Console.SetIn` is unsupported by single-threaded browser-WASM, source references
to `Console.ReadLine()` are redirected to a generated, in-memory input reader.
It consumes YCoders terminal text one line at a time; after all input is read it
returns `null` (EOF). Browser dialogs are never used.

Managed entry points returning `int`, `Task`, or `Task<int>` are understood.
Normal `Main`/top-level completion reports exit code 0. Compile failures and
unhandled exceptions report `null`. `Environment.Exit` is not treated as a safe
process boundary in this browser host and is unsupported for learner programs.

## Assets, compatibility, and security

The worker lazy-loads `/dotnet/_framework/dotnet.js`; users who never run C# do
not download .NET or Roslyn. The single-threaded configuration requires
WebAssembly and module workers, but not SharedArrayBuffer, WebAssembly threads,
COOP, COEP, or cross-origin isolation. Chromium was exercised directly. Current
Firefox and Safari releases support the required primitives, but were not run in
the local validation environment.

The worker receives only source and terminal input. It does not receive React
state, DOM handles, Firebase clients, credentials, or browser storage. Runtime
files are ephemeral. The host does not expose a package installer or YCoders
network bridge. Browser .NET can contain fetch-capable framework APIs, however,
so WASM/Worker isolation must not be described as a hardened hostile-code
sandbox. Worker termination bounds CPU hangs and releases the runtime heap;
browser-enforced memory limits remain the ultimate memory boundary.

## Standard library and future VB.NET reuse

The embedded .NET 10 reference surface supports `System`, collections, LINQ,
text, math, dates, and `System.Text.Json`. Arbitrary NuGet installation and
native packages are intentionally unsupported.

`DotNetWorkerClient`, worker lifecycle, .NET host, reference loading, output
capture, timeout, and evidence normalization are reusable for VB.NET. A future
adapter would add Microsoft.CodeAnalysis.VisualBasic and a Visual Basic compiler
strategy while keeping the lowest runtime/lifecycle layer unchanged.
