# Go and Rust remote compiler architecture

Status: `REMOTE_COMPILER_RUNNER_LOCALLY_VALIDATED` on 2026-09-25. Go and Rust are registered, while all production feature gates remain off by default.

Go and Rust are in the canonical compiler registry after passing local real-container integration, isolation, abuse, authorization, recovery, and latency gates. Production availability remains content- and feature-gate-driven.

## Decision

Go and Rust use official native toolchains in a separate runner service. Vercel remains the authenticated control plane and never executes learner binaries. Browser-hosted alternatives were rejected: Go's browser target executes precompiled WebAssembly rather than compiling arbitrary source; Rust Playground is a server service; WASM-hosted rustc/LLVM distributions are too large and operationally immature for the interactive browser budget.

The request path is:

`CompilerManager -> RemoteCompilerRuntime -> /api/compiler/execute -> Firebase authentication -> canonical-content authorization -> Firestore distributed quota -> signed internal runner request -> disposable language container`.

The standalone public compiler uses a separate, explicit policy path:

`StandaloneCompilerPage -> RemoteCompilerRuntime(publicStandalone) -> /api/compiler/remote/public -> optional Firebase authentication -> public identity/rate/concurrency quota -> signed internal runner request -> disposable language container`.

This path accepts exactly `languageId`, `source`, and `stdin`, and only `go` or `rust`. It never calls or relaxes the learning endpoint's canonical-content, enrollment, or premium authorization. A supplied invalid bearer token is rejected rather than downgraded to anonymous. `PUBLIC_REMOTE_COMPILER_ENABLED`, the broad remote gate, the language-specific gate, and distributed quota gate must all be the exact string `true`; the public page can remain visible while execution fails closed with an unavailable response.

The runner is not public application surface. It verifies an HMAC over timestamp, execution id, and body digest, rejects stale/replayed requests, and accepts only Go/Rust policy-owned commands.

## Toolchains

- Go image: `golang:1.27.1-bookworm@sha256:69a7b9788769bec032d238959b61854e9ae87f57be9029ec04e9885fabf99195`, wrapped locally as `ycoders/go-runner:1.27.1@sha256:02b2424b599ad45c8fe07d75b9e6349fa911ecfb8325dfdc32cd3bde9ca4f68d` (1,367,012,870 bytes).
- Rust image: `rust:1.98.1-slim-bookworm@sha256:ff521445a372125ed4f76e1453a1f8098f2d05332d1601d30db1c1f62757e730`, edition 2024, wrapped locally as `ycoders/rust-runner:1.98.1@sha256:e0e230fc851994fb7c7bff790776f7932a6a32803ec9a3dc301d700c79e85c8d` (1,224,993,023 bytes).
- No Cargo dependencies, Go modules, package downloads, or learner-controlled command lines are enabled.

Pin deployed images by immutable registry digest after the controlled build/publish step. Tags in this repository identify the reviewed upstream version; mutable upstream tags are not a production lock.

## Isolation policy

Every execution receives a new container. Docker is invoked without a shell and with: no network, read-only root, all capabilities dropped, no-new-privileges, non-root uid/gid 65534, 512 MiB memory and swap ceiling, one CPU, 64 PIDs, 128 file descriptors, a 64 MiB per-file ceiling, a 192 MiB `/tmp` tmpfs, a 96 MiB aggregate-bounded `/work` tmpfs, a 15-second compile timeout, 10-second execution timeout, 30-second Docker-exec ceiling, 35-second request ceiling, and 1 MiB stdout/stderr limits. The container and both writable tmpfs mounts are forcibly destroyed in `finally`; there is no host bind mount.

The runner bounds active work to four and its queue to eight, with a two-second queue deadline. The Vercel layer additionally enforces a Firestore transactional per-user/global lease and request window.

For public execution, Firestore stores only derived identity hashes in `compilerPublicRemoteRateLimits` and global leases in `compilerPublicRemoteRuntime/global`; client rules deny both collections. Proxy identity resolution is `x-vercel-forwarded-for`, then the socket address, then `x-forwarded-for`, then `unknown`, and is hashed before quota storage. Anonymous limits are 10 executions per 10 minutes and 30 per hour; verified users receive 20 per 10 minutes and 60 per hour. Both classes allow one active execution per identity. Control-plane admission is capped at 12 in-flight jobs, matching the runner's four active plus eight queued capacity, and leases expire after 75 seconds for crash recovery.

Public request limits are 150 KiB for the JSON envelope, 64 KiB each for source and stdin, 15 seconds to compile, 10 seconds to execute, and approximately 1 MiB combined bounded output under the runner policy. There is no automatic retry. Disconnect cancellation propagates to the signed runner request and the public lease is released in `finally`. Public operational logs contain only execution id, derived identity hash, language, outcome, and duration; source, stdin, tokens, raw addresses, and diagnostics are excluded.

This is defense in depth, not a proof that containers are a perfect hostile-code sandbox. Production should run the runner on dedicated, patched compute with no cloud metadata access, no application credentials, an egress-deny firewall, a private ingress path, log redaction, alerts, and image/vulnerability scanning. Stronger multi-tenant hardening may use gVisor, Kata Containers, or disposable microVMs without changing the API contract.

## Content and feature authority

Production requests must reference published course, practice, or Daily Challenge content. Firebase metadata, Storage content, premium entitlement, and the compiler block's language are checked server-side. Development selector entries do not grant production execution authority.

The required server-only gates are `REMOTE_COMPILER_RUNTIME_ENABLED`, `GO_RUNTIME_ENABLED`, `RUST_RUNTIME_ENABLED`, and `REMOTE_COMPILER_DISTRIBUTED_QUOTA_ENABLED`. They require the exact string `true`; otherwise execution fails closed.

Public standalone execution additionally requires `PUBLIC_REMOTE_COMPILER_ENABLED=true`. It is disabled by default in `.env.example`. Enabling it is not authority to expose the runner directly: the runner URL remains an internal control-plane dependency protected by the existing 32+ byte HMAC secret, timestamp window, execution-id replay cache, and timing-safe signature verification.

## Local real-runner evidence

Validation ran on Docker Desktop 4.92.0, Docker Engine 29.8.0, Linux/amd64 under WSL2, with 8 CPUs and about 3.72 GiB RAM. Both images ran as uid/gid 65534. Real tests passed for Go/Rust language semantics, Go channels and generics, Rust threads and borrow diagnostics (E0382/E0502), stdin, separate stdout/stderr, warnings, compile failures, panics, timeout/recovery, network denial, host-environment exclusion, filesystem/process confinement, 512 MiB OOM containment, 64 MiB per-file enforcement, aggregate scratch exhaustion, 1 MiB output truncation, cancellation, and cross-language recovery. The signed local live preflight and fail-closed health probe passed. Cleanup uses a bounded retry after concurrent Docker saturation; final learner-container count was zero after the repeated 1/2/4/5-job suite.

The original Go runner copied 95,561,881 bytes across 1,393 cache files into tmpfs on every execution and used `-trimpath`, which changed cache keys and caused standard-library recompilation. The optimized image contains only reviewed standard-library cache entries in a read-only image layer; learner source, output, `/work`, `/tmp`, and module state remain per-container and disposable. The server-owned build command consumes that immutable cache directly without copying it. Write, replacement, deletion, and cross-execution poisoning attempts were denied or absent.

The final five fresh-container Go Hello World runs measured 1,370–2,772 ms total (median 1,448 ms), 248–1,165 ms compilation, and 5–36 ms learner execution; the coldest run followed image rebuild/cleanup activity. One, two, and four concurrent job batches completed in approximately 1.46 s, 1.84 s, and 2.70 s respectively; a fifth simultaneous job was rejected as `runner_busy` after the bounded queue deadline. Rust representative runs remained approximately 1.2–2.2 seconds. The signed live preflight passed after optimization.

## Production host requirements

Do not deploy these locally named images directly. Publish reviewed images to a private registry and configure immutable digests. A production host must provide Linux/amd64 Docker-compatible isolation, private authenticated ingress, default-deny learner egress, patched host/container runtimes, at least 4 CPU cores for the current four-job ceiling, at least 4 GiB RAM plus host reserve (8 GiB recommended), at least 10 GiB free disk for images/build turnover, bounded ephemeral scratch, image and vulnerability scanning, container/lease/orphan monitoring, redacted logs with bounded retention, and alerts for saturation, OOM, timeout, cleanup, and authentication failures. Re-measure under the chosen host before selecting concurrency.

Production provisioning and published private-registry digests are still required. Registration does not enable remote execution: all production gates remain disabled and must not be enabled until the complete suite is repeated on the dedicated production runner environment.

Required production configuration: private runner URL, 32+ byte runner secret (prefer managed secret rotation or workload identity/mTLS), Firestore quota access for Vercel only, runner ingress limited to the control plane, runner egress denied, centralized metrics without source/stdin/token logging, and autoscaling with a hard capacity ceiling.

The `/healthz` endpoint fails closed unless the Docker server responds, both reviewed images are locally present, the images report the exact pinned Go/Rust versions, and a probe executed as the learner UID is non-root. HTTP liveness alone is never reported as readiness.
