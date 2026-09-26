# x86-64 Assembly browser runtime

## Decision

YCoders uses a browser-only, worker-isolated educational x86-64 pipeline:

```text
CompilerManager
  -> AssemblyRuntime
  -> AssemblyWorkerClient
  -> disposable module Worker
  -> NASM 3.00
  -> deterministic flat binary
  -> in-memory ELF64 wrapper
  -> Blink x86-64 emulator
  -> structured register/flag/stack evidence
```

This runtime is registered as `executionMode: emulator`. Production remains
content-driven; the unrestricted language selector remains development-only.

## Feasibility assessment

- **Blink / x86-64-playground**: selected. It provides real x86-64 emulation,
  register and flag state, virtual memory, Linux-style execution, stepping APIs,
  a small WASM engine, Worker compatibility, and permissive ISC licensing.
- **NASM 3.00 static ELF**: selected. It provides genuine NASM Intel syntax,
  labels, directives, x86-64 diagnostics, and BSD-2-Clause licensing.
- **Unicorn.js**: rejected. It is technically capable and actively packaged,
  but its browser package is approximately 20 MB unpacked, GPL-2.0 licensed,
  and supplies no assembler.
- **ax-x86**: rejected. It is a small x86-64 WASM emulator, but implements only
  a documented subset of x86-64, has incomplete flags/memory/ELF behavior, is
  AGPL-3.0 licensed, and supplies no assembler.
- **v86**: rejected because its documented CPU omits x86-64 extensions and
  cannot run 64-bit kernels.
- **iced-x86**: useful MIT-licensed decoder/encoder, but the JavaScript package
  does not parse arbitrary learner-written NASM text and it is not an emulator.
- **Keystone**: rejected for this browser phase because no maintained official
  browser package was found; commercial production use also requires separate
  licensing.
- **CheerpX / WebVM**: rejected as a comparatively heavyweight full Linux VM
  architecture with separate commercial licensing considerations.

## Source and entry model

The editor accepts NASM-compatible Intel syntax. The worker internally prepends:

```asm
[BITS 64]
[ORG 0x401000]
```

Execution starts at the first emitted byte at virtual address `0x401000`. The
runtime assembles a flat binary and wraps it in an ephemeral ELF64 image. This
keeps the beginner model simple and lets the emulator stop exactly when RIP
reaches the end of learner code without adding a fake exit instruction.

Labels and flat-binary data definitions such as `db`, `dw`, `dd`, and `dq` are
supported. Multi-section ELF authoring, object linking, macros that depend on an
external include filesystem, and arbitrary uploaded binaries are outside this
first phase.

## Machine and memory model

- Architecture: AMD64/x86-64 long mode
- Endianness: little-endian
- Learner code base: `0x0000000000401000`
- Image base: `0x0000000000400000`
- Stack: initialized by Blink using its isolated System V process model
- Machine memory: private to the worker's WebAssembly instance
- Evidence: all 64-bit values cross the Worker boundary as padded hex strings

The result exposes RAX, RBX, RCX, RDX, RSI, RDI, RSP, RBP, R8-R15, and RIP,
plus CF, PF, AF, ZF, SF, and OF. It also returns 128 bytes from the current stack
window and highlights registers changed during execution.

## Execution policy

The runtime executes through single-instruction emulator steps in batches. This
provides a deterministic 1,000,000-instruction ceiling in addition to the shared
10-second Worker deadline. Cancellation, reset, language switching, timeout,
and completion all terminate the disposable Worker and discard its machine
state and virtual filesystem.

Only Linux x86-64 `write` (syscall 1, descriptors 1 and 2) and `exit` (syscall
60) are admitted. Other syscall instructions are stopped before execution. No
syscall is forwarded to browser APIs, Firebase, authentication, storage, or the
network. stdin is intentionally unsupported in this phase.

## UI and validation

`EmulatorResultPanel` is capability-driven and presents registers, flags,
instruction count, stack/memory bytes, stdout, stderr, diagnostics, and runtime
errors. This structured evidence prepares future validators to inspect machine
state rather than relying only on stdout.

Interactive Step/Stop controls and source-line highlighting are deferred. Blink
can step instructions, but trustworthy source highlighting requires a NASM
listing/address map. The first phase does not fabricate such a map.

## Browser and security requirements

The runtime requires WebAssembly, BigInt/DataView 64-bit access, module Workers,
and dynamic imports. It does not require SharedArrayBuffer, WASM threads,
COOP/COEP, or cross-origin isolation.

Worker/WASM isolation provides cancellation and keeps machine memory private,
but is not a hardened hostile-code sandbox. CPU exhaustion is bounded by both
instruction and wall-clock limits. Browser memory exhaustion remains subject to
the browser's own WebAssembly limits.
