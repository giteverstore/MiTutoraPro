# Visual Basic browser runtime architecture

Visual Basic means modern VB.NET, not VB6, VBA, or VBScript.

## Runtime family

Both C# and Visual Basic use the same disposable browser worker and .NET 10.0.12
WebAssembly runtime. The worker passes the canonical language id to the shared
Roslyn host. The host selects either `CSharpCompilation` or
`VisualBasicCompilation`, then shares reference loading, managed assembly
emission, entry-point invocation, stream capture, diagnostics, exception
normalization, exit-code handling, and timing.

The Visual Basic compiler is `Microsoft.CodeAnalysis.VisualBasic` 5.9.0. Parse
options use Roslyn's `Latest` stable VB language version, which maps to Visual
Basic 16.9 in this compiler family. Compilation enables `Option Strict`,
`Option Explicit`, and `Option Infer`, while retaining binary string comparison.

## Input and isolation

`Console.ReadLine()` is redirected to the same ephemeral, base64-backed input
reader used by C#. Every run receives a new worker, runtime, compiler state, and
generated assembly. Timeout, cancellation, reset, language changes, and unmount
terminate the worker.

## Assets and loading

Visual Basic adds the Roslyn VB compiler assembly to the existing .NET app
bundle. Runtime WASM, framework assemblies, embedded compilation references,
worker code, and terminal plumbing remain shared. These assets are fetched only
when a .NET language creates its worker; they are not part of the initial Vite
application JavaScript.

The project resolves embedded reference assemblies from the installed .NET 10
targeting pack instead of pinning its patch directory. This avoids silently
publishing a compiler host without references when SDK and runtime servicing
versions differ.

## Browser and security boundary

Requirements remain WebAssembly, module workers, and dynamic module import.
SharedArrayBuffer, WASM threads, COOP/COEP, and cross-origin isolation are not
required. Learner code receives no intentional DOM, React, Firebase, credential,
browser-storage, or host-filesystem access. Worker isolation is a resource and
lifecycle boundary, not a hardened hostile-code sandbox.

## Limitations

- Only a single source file and framework libraries are supported.
- NuGet packages and project files are not exposed to learners.
- `Console.ReadLine()` is supported; arbitrary `Console.In` replacement is not.
- Reflection and platform-specific APIs remain constrained by browser-WASM.
- `Environment.Exit` follows the same browser-runtime limitations as C#.
