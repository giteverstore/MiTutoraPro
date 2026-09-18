# Isolated Code Judge Architecture

**Status: DEFERRED / CANONICAL PYTHON RUNTIME PINNED / REWARD AND PRODUCTION PATHS DISABLED**

**Decision date: 2026-09-07**

This document selects the target execution architecture for authoritative Practice and Daily Challenge verification. It does not describe a deployed judge. No endpoint, worker, sandbox, reward path, or production resource exists as a result of this decision.

## M2.3B.1 local implementation

The repository now contains a server-only Python judge contract under `functions/src/python-judge/`. It pins CPython 3.14.0 and Firecracker 1.16.1, defines the initial one-vCPU/256-MiB/16-MiB envelope, validates closed server-derived request bindings, resolves versioned protected suites, emits a bounded trusted result, and adapts that result to the existing `PracticeVerifier` executor contract.

`FirecrackerExecutionController` requires a worker adapter that can prepare and boot a jailed microVM, execute one protected input at a time in a fresh learner process, and prove complete teardown. Fatal paths and normal shutdown both check the VMM and invoke `cgroup.kill` while it is alive. A result is never clean until the VMM PID, guest process tree, cgroup, mounts, sockets, jail directory, and scratch image are all independently reported absent. Failure of any check yields `CLEANUP_FAILURE`.

The immutable guest harness receives source, one entry point, and one protected input. Expected results remain in the controller-side registry and are not included in the guest frame. Its output frame is limited to 64 KiB and contains only a closed status/value protocol. Source, captured output, expected results, protected definitions, and host paths are excluded from trusted results and persistent evidence.

Initial protected Practice integration is intentionally limited to `fund-variables-001` and `fund-variables-002`, both bound to their canonical v2 hashes and private suite v1. The six known legacy questions remain untouched.

Local tests use a dependency-injected fake worker and never execute submitted Python on the developer host. R.4 produced and audited the canonical CPython 3.14.0 runtime described below. The production boundary and all reward paths remain disabled.

### M2.3B.1R.4 canonical runtime

The approved validation artifact is private and generation-pinned at `gs://mi-tutora-ai-val-260904-k7m3-judge-artifacts/python/firecracker-v1/sha256-2e831d37fdb716eb1d09e75878b7209f6eb051510c491041af10acb7ca5d0410/mitutora-python-firecracker-runtime.tar.zst#1788850718748121`. Bucket versioning is enabled and public access prevention is enforced; no locked or irreversible retention policy is configured. Its size is 162,352,997 bytes and its bundle SHA-256 is `2e831d37fdb716eb1d09e75878b7209f6eb051510c491041af10acb7ca5d0410`. A generation-specific download reproduced both values exactly.

Execution failures retain a finite, sanitized internal stage classification covering preparation, runtime validation, scratch/request setup, jailer invocation, socket readiness, Firecracker API configuration, PID/cgroup attachment, VM start, guest execution wait, response retrieval, parsing, and result validation. Diagnostics may contain only fixed stage/reason identifiers, bounded exit/signal/errno data, timeout state, and boolean milestones. Raw commands, stderr, source, protected expectations, and guest frames are never released. The current scratch-file transport has no independent guest-readiness or harness-start handshake, so those events remain unobservable rather than being inferred. Public judge status remains fail-closed, and cleanup status is independently authoritative.

The Linux worker records each finite stage before starting its potentially blocking operation and exposes only an immutable, execution-ID-bound snapshot of that stage and its boolean milestones. If the controller's bounded deadline wins, it captures that snapshot, preserves the live stage, marks the internal error as `guest/timeout`, and still returns only the public `TIMEOUT` / `judge/timeout` classification. A snapshot from another execution is rejected, late worker completion cannot change the finalized result, and absence of a worker stage falls back narrowly to runtime validation or scratch preparation rather than result validation.

The R.6G live-stage probe identified a host-side `JAILER_INVOKE` failure before Firecracker launch. Firecracker 1.16.1 canonicalizes and requires the configured chroot base to exist, but the worker previously created only the run and scratch-mount directories before passing a nonexistent per-run jailer base. The worker now creates that base as a root-owned, non-writable trusted directory before invocation and validates the jailer binary, Firecracker binary, execution identifier, UID/GID, chroot base, PID namespace, daemonization, and cgroup-version contract. Jailer stderr is held only in a 4-KiB transient classification buffer, mapped to a finite reason, and discarded; arbitrary stderr never enters diagnostics or public results. The runtime UID/GID, jailer, chroot, PID namespace, default Firecracker seccomp, cgroup-v2 containment, and networkless guest policy remain unchanged.

The canonical component identity is Firecracker 1.16.1, CPython 3.14.0, guest kernel 6.18.44 (`d0fa6b694b32c9d12c5b1575180c888d9c83ff8955d21fe74debb4fe4832db22`), rootfs `290ebfaa470293ea9f156b83b0257fbf04e533d9d9d49a51c9785b4302aa33ec`, runtime `333b0f4ea024fff35bad974b89990e46f79a8eb19e8fe780963a6942b44d391a`, and harness `a5296f6fefa57123a456e37b131b37b333b05f9623be8b7f23722b1fd6e5e734`. `CanonicalPythonRuntime.js` is the machine-readable authority. The controller accepts only those exact component digests, the Linux worker verifies kernel and rootfs bytes before boot, and the validation runners reject a mismatched embedded manifest.

Future validation must run `npm run retrieve:python-judge-runtime -- <destination>` to retrieve that exact object generation and verify the bundle plus extracted kernel/rootfs hashes. Rebuilding is a separate supply-chain operation and must never silently replace canonical retrieval.

The superseded R.2 validation image remains historical evidence only. Its recorded digest prefixes were kernel `74b59ebce7`, rootfs `bb0c0ae5b1`, and runtime `ee19c4ab18`; the complete R.2 ledger remains the authority for those superseded values. They are not accepted by the canonical controller and are retained here solely to preserve the audit trail.

### M2.3B.1R.6 teardown repair

The R.5 success-path proof found one loop-backed ext4 scratch mount at the run's `scratch` mountpoint, its `scratch.ext4` backing artifact, the containing execution directory, and the execution cgroup after Firecracker and jailer had exited. The direct cause was split teardown ownership: `executeTest()` attempted run cleanup in a `finally` block, suppressed every cleanup error, and the controller subsequently tried to remove the cgroup before it had an explicit operation for retrying the failed run cleanup. An ordinary unmount failure therefore skipped run removal, while final invariant verification could only reject the result rather than actively recover the residue.

Cleanup now has one explicit coordinator and the following dependency order: invoke `cgroup.kill`; wait boundedly for `cgroup.events` to report `populated 0` and for the known VMM PID to disappear; enumerate execution-owned mounts and unmount deepest-first with bounded ordinary-unmount retries; remove and independently inspect sockets, scratch backing files, jail state, and the run directory; remove the empty cgroup with bounded retries; verify every invariant; remove the empty execution directory; and verify again. Lazy and forced unmount are not used. Cleanup is idempotent, and permanent process, mount, cgroup, socket, scratch, jail, or directory failures produce bounded structured classifications without raw paths or learner data.

### M2.3B.1R validation attempt

The validation-only implementation now also contains a concrete Linux worker adapter, a reproducible CPython 3.14.0 image builder, and a bounded real-execution runner. The worker launches Firecracker through the jailer, moves the VMM into an execution-specific cgroup, uses one fresh microVM per protected test, passes only source plus the current protected input through a 16-MiB scratch image, retains expected values in the controller, and requires cgroup-wide termination and cleanup verification.

The first authorized validation host passed the host preflight (`x86_64`, nested VMX, `/dev/kvm`, cgroup v2, Ubuntu 24.04, no service-account credentials). The exact Firecracker v1.16.1 release archive matched the approved SHA-256. The first image-build command stopped before image creation because the version parser included Firecracker's additional shutdown log line; the parser was corrected without changing the pinned artifact or checksum. The corrected build was still running when the host's mandatory three-hour automatic deletion deadline elapsed. Its boot disk and partial build state were destroyed, so no image digest or real judge result survived.

No microVM was started and no synthetic source was executed in that attempt. The temporary NAT and router were removed and the final judge-specific validation inventory was empty. A replacement validation host requires separate authorization because M2.3B.1R authorized exactly one host. Real CPython execution, resource containment, network/credential isolation, cross-run isolation, fault-injection cleanup, and Practice execution therefore remain unproven.

### M2.3B.1R.2 cleanup diagnosis

The first real worker attempt reported `CLEANUP_FAILURE` because cleanup verification used `findmnt --target` against the execution root. That command reports the filesystem containing a path, not only a mount at or below the path, so `mountsGone` was deterministically false even after all execution mounts were removed. Cleanup now enumerates mount targets and rejects only an exact execution-root mount or a descendant mount. The controller also invokes `cgroup.kill` unconditionally for an acquired execution handle, waits for process-tree termination and cgroup removal, and returns `cleanupStatus=VERIFIED` only after every process, cgroup, mount, socket, jail, scratch, and execution-directory invariant passes.

The bounded R.2 cloud retest stopped before Firecracker launch because the new host did not yet contain `/srv/mitutora-judge/executions`; `prepare()` failed before returning a handle. No guest source executed. The adapter now creates that dedicated controller-owned execution root through its privileged bootstrap path and records a bounded `CLEANUP_UNKNOWN` prepare-stage diagnostic when no handle exists. This bootstrap repair has deterministic local coverage but no second cloud attempt was permitted in R.2, so real cleanup proof remains pending and M2.3B.2 remains blocked.

Initial failure statuses are `PASS`, `FAIL`, `TIMEOUT`, `MEMORY_LIMIT`, `PID_LIMIT`, `OUTPUT_LIMIT`, `DISK_LIMIT`, `SYNTAX_ERROR`, `RUNTIME_ERROR`, `JUDGE_ERROR`, and `CLEANUP_FAILURE`. Logs may contain only execution/activity identifiers, version bindings, status, duration class, and cleanup classification. They must never contain source, stdin, stdout, stderr, protected tests, expected output, credentials, or raw infrastructure errors.

## Decision summary

Use a hybrid execution model:

```text
browser Pyodide/TeaVM -> fast local feedback (never authoritative)

authenticated verification API
  -> authoritative activity/content resolver
  -> bounded queue
  -> trusted judge controller on a dedicated Linux/KVM worker
  -> one disposable Firecracker microVM per submission
  -> trusted result comparison and schema validation
  -> durable server-verified completion
  -> separate idempotent coin claim
```

The selected isolation boundary is one disposable Firecracker microVM per submission, launched by a small trusted controller on dedicated KVM-capable worker hosts. The guest has no credentials, no network device, no metadata service, a read-only immutable root filesystem, a quota-limited ephemeral scratch filesystem, a non-root runtime user, and hard CPU, wall-clock, memory, process, filesystem, and output limits. The microVM is destroyed after one submission.

The controller, API, queue, and reward service remain outside the guest. Hidden expected results should remain outside the guest whenever the activity contract permits: the controller gives the guest one bounded test input at a time and compares its bounded result to the protected expected result. A narrow authenticated internal channel carries a versioned `JudgeResult`; Firecracker alone is not result attestation.

This is a recommendation, not implementation approval. M2.3A must begin in a non-production environment and must pass the gates in this document before any learner endpoint or reward path is enabled.

## Evidence labels

- **SOURCE-VERIFIED FACT** means the statement is directly supported by a linked primary source.
- **ENGINEERING INFERENCE** means it follows from the documented platform behavior and this repository's trust model but has not yet been benchmarked here.
- **RECOMMENDATION** means a design choice for ycoders that still needs implementation and review.

## Alternatives evaluated

| Option | Isolation and security | Operations and scale | Cost shape | Decision |
|---|---|---|---|---|
| Firecracker microVM per submission | Hardware-virtualized guest boundary; jailer, seccomp, namespaces and cgroups provide layers around the VMM | Requires KVM hosts, image lifecycle, controller, queue, patching and capacity management | Fixed worker floor plus compute; efficient only with pooling/snapshots after proof | **Selected execution boundary** |
| gVisor sandboxed container | Userspace application kernel intercepts guest syscalls and reduces direct host-kernel exposure; still relies on host controls for resource exhaustion and networking | Easier container integration; available through GKE Sandbox | Cluster or worker floor; simpler density than microVMs | Strong fallback/prototype, not selected for initial authority |
| Hardened ordinary container | Namespaces, seccomp, capabilities and cgroups, but shares the host kernel | Operationally familiar | Low | Rejected as the sole hostile-code boundary |
| Dedicated VM worker | Strong tenant-to-infrastructure boundary, but submissions share a kernel/process space unless further isolated | Simple initial host substrate | Fixed VM floor and coarse scaling | Selected only as the host for per-submission Firecracker |
| Kubernetes sandboxed workloads | Can use gVisor `RuntimeClass`, network policy, resource limits and scheduling controls | Mature scaling but materially larger control plane and policy surface | Cluster/control-plane and node floor | Viable later if load justifies it |
| Cloud Run container | Platform isolates service instances, but learner code inside the same application container can attack the trusted runner and requests can share an instance | Excellent autoscaling and revision management | Request/instance based | Suitable for controller/API, not sufficient as the inner judge |
| Cloud Functions | Serverless request runtime with CPU/memory/timeout controls, but no dedicated inner hostile-code boundary | Simple triggers and scaling | Invocation based | Rejected for executing learner code |
| Managed judge service | Fastest path to broad language support if vendor isolation and privacy are acceptable | Outsources sandbox operations; adds vendor/SLA/data-processing dependency | Per request or hosted service | Not selected; requires security, privacy and legal review |
| Browser-only execution | No server compute and excellent feedback latency | No server operations | Lowest | Rejected for rewards because all evidence is learner-controlled |
| Hybrid local + server judge | Keeps current local UX while reserving authority for an isolated service | Two execution paths must remain semantically aligned | Local feedback is free; authoritative checks incur server cost | **Selected overall product architecture** |

### Primary-source basis

- **SOURCE-VERIFIED FACT:** Firecracker's jailer applies cgroups, chroot, mount/PID namespaces and an unprivileged uid/gid; Firecracker recommends the jailer for production. Its default per-thread seccomp filters allow only required syscalls, and disabling seccomp is not intended for production. See the official [jailer documentation](https://github.com/firecracker-microvm/firecracker/blob/main/docs/jailer.md), [seccomp documentation](https://github.com/firecracker-microvm/firecracker/blob/main/docs/seccomp.md), and [production host setup](https://github.com/firecracker-microvm/firecracker/blob/main/docs/prod-host-setup.md).
- **SOURCE-VERIFIED FACT:** Firecracker requires KVM hardware virtualization and does not remove the need to patch the host kernel, guest kernel, VMM and CPU microcode. The published performance specification reports, on its tested reference hardware, guest userspace start under 125 ms and VMM overhead at or below 5 MiB for a one-vCPU/128 MiB guest. These are vendor test results, not ycoders capacity guarantees. See the official [Firecracker specification](https://github.com/firecracker-microvm/firecracker/blob/main/SPECIFICATION.md).
- **SOURCE-VERIFIED FACT:** gVisor interposes a userspace application kernel and supports syscall interception platforms including systrap and KVM. Its security model still relies on host cgroups for resource exhaustion and container-layer network policy. See the official [architecture introduction](https://gvisor.dev/docs/architecture_guide/intro/), [security model](https://gvisor.dev/docs/architecture_guide/security/), and [networking guide](https://gvisor.dev/docs/user_guide/networking/).
- **SOURCE-VERIFIED FACT:** Cloud Run isolates instances with a VMM; first generation uses gVisor and second generation uses a Linux microVM with additional sandboxing. Multiple requests may still execute concurrently inside one service instance, so that platform boundary does not separate learner code from trusted code in the same container. See the official [Cloud Run security design](https://docs.cloud.google.com/run/docs/securing/security) and [container runtime contract](https://docs.cloud.google.com/run/docs/container-contract).
- **SOURCE-VERIFIED FACT:** GKE Sandbox runs pods with the gVisor runtime via `RuntimeClass`, providing an operational alternative if Kubernetes is adopted. See the official [GKE Sandbox guide](https://docs.cloud.google.com/kubernetes-engine/docs/how-to/sandbox-pods).
- **SOURCE-VERIFIED FACT:** Judge0 offers self-hosted/managed multi-language execution with resource limits and an isolation backend. A prior critical advisory affected versions through 1.13.0 and was patched in 1.13.1, illustrating why pinned versions and configuration review are mandatory for a managed judge dependency. See the official [Judge0 repository](https://github.com/judge0/judge0) and [security advisory](https://github.com/judge0/judge0/security/advisories/GHSA-q7vg-26pg-v5hr).

**ENGINEERING INFERENCE:** Firecracker gives the strongest practical boundary among the evaluated options for intentionally hostile learner code while retaining enough startup density for this workload. It also carries the highest in-house operational burden. This selection must be revisited if ycoders cannot own host patching and sandbox incident response.

## Threat model and required proof

The judge must treat source, stdin, filenames, compiler behavior, output and timing as adversarial. A limit is not accepted merely because it is configured; M2.3A/M2.3B must demonstrate the corresponding observation.

| ID | Threat/attack | Required control | Proposed mitigation | Residual risk and objective proof |
|---|---|---|---|---|
| J1 | Arbitrary learner code deliberately exercises every available runtime capability | Treat the submission as hostile; no in-process execution; narrow input/result protocol | One submission in one disposable microVM with no authority | Guest can still exploit its own runtime; demonstrate bounded execution across an adversarial corpus |
| J2 | Sandbox escape into host/controller | Hardware-virtualized guest; jailer; seccomp; non-root VMM/guest; pinned patched components | Firecracker is the primary isolation boundary, with host controls as defense in depth | Kernel/VMM escape risk remains; independent review and escape suite must find no host access |
| J3 | DNS, Internet, localhost or metadata-service exfiltration | No guest network device; isolated host netns/firewall default deny; no MMDS | No network is presented to the guest | Side channels remain; DNS, IPv4/IPv6, link-local, loopback-to-host and external probes must fail |
| J4 | Read/write host or image filesystem | Immutable read-only rootfs; no host mounts; quota-limited ephemeral scratch | Only disposable scratch is writable | Runtime/image files remain visible; writes outside scratch must fail and scratch must be destroyed |
| J5 | Exhaust host CPU, memory, PIDs, disk or I/O | Guest caps plus host cgroups, quotas, watchdog and admission control | A guest is bounded independently of controller and siblings | Host overcommit/misconfiguration risk remains; fork/memory/CPU/disk stress must leave host and next job healthy |
| J6 | Persist state between requests | Fresh VM and scratch per submission; never reuse post-execution snapshots | Submission state is destroyed after exit | Cleanup bugs remain possible; a sentinel from one run must be absent from every later run |
| J7 | Read another learner's code/result | No shared guest; owner/request binding; no source in logs or durable evidence | Per-submission VM plus authenticated result ownership | Controller/storage bugs remain; simultaneous cross-user isolation and authorization tests must pass |
| J8 | Discover service credentials or environment | No credentials, service-account identity, metadata or inherited host environment in guest | Guest receives only fixed non-secret runtime variables | Image contamination risk remains; environment/filesystem/network probes must find no secrets or cloud access |
| J9 | Abuse imports or dependencies to gain authority | Minimal immutable runtime, no package manager/downloads, fixed allowlist/image digest | Python stdlib and Java classpath are fixed by server policy | Standard runtime CVEs remain; provenance, scanning, patch SLA and malicious-import tests are mandatory |
| J10 | Spawn subprocesses, fork bombs, signals, ptrace or orphan process trees | Guest-only process tree, minimal init, PID limit, capability removal, outside watchdog | Process activity remains inside the disposable guest and is killed as a tree | Runtime may legitimately spawn threads/processes; boundary tests must prove caps and complete teardown |
| J11 | Produce unlimited stdout/stderr or result data | Byte-capped streams and result frame; terminate on overflow; sanitized logging | Controller stops reading and kills an overflowing guest | Encoding/compression amplification risk remains; infinite-output tests must keep all logs and memory bounded |
| J12 | Infinite loop, sleep or signal abuse | vCPU quota; per-test CPU budget; hard outside wall-clock deadline | Controller kills the entire microVM on deadline | Host scheduling jitter remains; busy/sleep loops must terminate within a measured tolerance with no claim |
| J13 | Memory exhaustion or allocation bombs | Fixed guest memory, host cgroup cap, scratch quota and outside watchdog | OOM is contained to the guest | VMM/host accounting bugs remain; pressure must never OOM the controller/host or affect the next run |
| J14 | Concurrent abuse and queue flooding | Authenticated rate limit, bounded queue, admission control, per-VM resources and host headroom | Excess work is rejected/queued before sandbox allocation | Distributed denial of service remains; target burst/load test must preserve isolation and ownership |
| J15 | Stale worker/snapshot leaks prior state | Clean pre-input snapshot only; immutable digest; destroy post-run state; patch invalidation | No learner-influenced snapshot or warm guest is reused | Snapshot lifecycle error remains; contamination and snapshot-version tests must pass |
| J16 | Malicious or compromised compiler/runtime | Pinned CPython/OpenJDK image, minimal packages, signed provenance, scanning and conformance corpus | Runtime has no host authority and is replaceable by digest | Guest kernel/runtime zero-days remain; release must block on the approved vulnerability policy |
| J17 | Judge/controller infrastructure compromise, forged result or stale activity binding | Least-privilege service identity; authenticated channel; nonce; strict schema/size; activity/version/hash/suite/image binding; fail-closed reward boundary | API accepts only a fully bound result from the trusted controller | Controller compromise remains high impact; wrong/oversized/replayed results and injected crashes must yield zero completion/coins |

Residual risk remains: a malicious program sees the individual hidden input it receives, hardware side channels cannot be claimed eliminated, and no sandbox is safe without continuous patching. The design minimizes protected material per run and avoids colocating different learner submissions in one guest, but it does not claim formal non-interference.

## Proposed execution profile

All values below are starting hypotheses for non-production measurement, not approved production defaults.

| Control | Python initial profile | Java later profile |
|---|---|---|
| Runtime | Pinned CPython image; standard library allowlist; no `pip` | Pinned OpenJDK/Javac image; fixed classpath; no Maven/Gradle/downloads |
| vCPU | 1 | 1, benchmark 2 only if compilation requires it |
| Guest memory | 128-256 MiB | 384-768 MiB |
| Per-test CPU | 0.5-2 seconds | Compile budget 2-5 seconds; run budget 0.5-2 seconds |
| Submission wall clock | Independently enforced outside guest; measured ceiling required | Separate compile and execution deadlines plus total deadline |
| Processes/threads | Minimal runtime-specific maximum; measured against legitimate workloads | Higher bounded allowance for JVM/compiler threads |
| Output | Fixed byte ceiling per stream and structured result; no unbounded logs | Same |
| Filesystem | Read-only image plus small ephemeral tmp quota | Same; compilation output only in tmp |
| Network | No device and host-level default deny | Same |
| Lifecycle | One submission, then destroy VM and scratch | Same |

**RECOMMENDATION:** Launch authoritative verification for Python first. The repository already has 194 protected Python Practice definitions. Java introduces compiler memory, class loading, JVM startup, thread behavior and a larger runtime image; it should pass a separate profile and threat suite before becoming reward-authoritative.

The runner must not implement security by source-text denylisting. Imports and packages should be constrained by the minimal immutable image, filesystem/network isolation, runtime policy and syscall boundary. Static checks may improve diagnostics but are never the primary isolation control.

Snapshots may be evaluated only after correctness and patch-lifecycle proof. A snapshot must be generated from a sealed clean runtime before any learner input, identified by an immutable digest, and invalidated on kernel/runtime/security updates. Post-submission VM or memory state must never be snapshotted or reused. Firecracker documents snapshot limitations and copy-on-write behavior in its [snapshot support guide](https://github.com/firecracker-microvm/firecracker/blob/main/docs/snapshotting/snapshot-support.md).

## Content-authority prerequisites

### Practice

- 200 canonical learner-facing Practice records/artifacts exist.
- 194 IDs have matching server-only protected definitions.
- The six legacy IDs at positions 21-26 are `practice-even-or-odd`, `practice-sum-range`, `practice-reverse-text`, `practice-largest-number`, `practice-word-frequency`, and `practice-palindrome`.
- Repository search finds those six only in learner/catalog sources and validator allowlists; it does not find protected tests or reference implementations. They cannot be reconstructed safely from public examples and must receive reviewed server-only definitions or remain ineligible.
- The resolver must bind question ID, position, language, active publication version, canonical artifact hash, protected-suite version and runner image digest.

### Daily Challenge

- Current metadata lacks the equivalent canonical content hash needed by the authoritative resolver.
- Current learner content exposes a visible compiler example, not a protected authoritative suite.
- Publication must add immutable content integrity and a reviewed server-only suite without putting protected values in Storage or browser artifacts.
- Reward recurrence and uniqueness (per challenge/date/version) must be decided before durable claims.

No reward policy should be populated until these content contracts and judge proof are complete.

## Proposed API and result boundary

The existing `ActivityVerificationService` request allowlist remains the outer contract:

```text
activityType, activityId, contentVersion, language, sourceCode
```

UID comes only from verified Firebase authentication. The client may not provide expected output, tests, pass/fail, reward, policy version, compiler status, timestamps, balance, or claim identity.

The public API should:

1. authenticate and rate-limit;
2. validate bounded request shape;
3. resolve the exact active canonical activity and private suite;
4. assign a server request nonce and immutable bindings;
5. enqueue only a bounded internal job reference;
6. accept a result only from the authenticated judge controller;
7. validate result schema, nonce, bindings, limits and status;
8. record durable server-verified completion only on a clean pass;
9. invoke the separate M2.1 idempotent claim transaction only after an approved policy exists;
10. return a sanitized result without tests, expected values, raw infrastructure errors or runtime internals.

Proposed internal `JudgeResult` fields are `schemaVersion`, `requestNonce`, `activityType`, `activityId`, `contentVersion`, `contentHash`, `privateSuiteVersion`, `runtimeImageDigest`, `language`, `status`, `testsRun`, `testsPassed`, bounded timing/resource summaries, and a sanitized failure category. No raw protected input, expected output, source code, stdout or stderr belongs in the durable evidence record.

Cancellation is not proof of termination until the controller observes microVM process exit and scratch cleanup. Queue delivery must be at-least-once safe; request nonces and the downstream coin ledger provide idempotency, while duplicate jobs must never create duplicate completion authority.

## Recommended implementation profile

1. **Infrastructure:** dedicated, non-production-first Linux/KVM worker pool in an isolated project/network, plus a separately deployed authenticated API/controller and bounded queue.
2. **Runtime:** immutable, digest-pinned minimal guest images; CPython first, then a separately approved OpenJDK/Javac image.
3. **Isolation:** Firecracker microVM per submission, jailer, seccomp, namespaces, cgroups, non-root VMM/guest, no host mounts.
4. **Network:** omit virtio-net and MMDS; add host namespace/firewall default deny as a second layer.
5. **Resource limits:** enforce CPU, wall time, memory, PIDs, scratch bytes, input bytes and stdout/stderr/result bytes both in guest and controller.
6. **Worker lifecycle:** restore only a sealed pre-input image or cold boot, execute once, observe exit, destroy VM/scratch, verify cleanup before accepting another job.
7. **Request protocol:** length-bounded authenticated queue record containing server-resolved identifiers, immutable hashes, nonce and source; never client-selected privileges or tests.
8. **Judge protocol:** narrow framed messages over a private vsock-style channel; one protected input at a time where possible; expected results retained by controller.
9. **Test execution:** deterministic ordered suite with per-test and total budgets; stop on infrastructure ambiguity and report no pass.
10. **Result sanitization:** validate a closed versioned schema and return only pass counts/status/timing classifications; never tests, expected values, source or raw internal errors.
11. **Logging:** structured IDs, image/suite versions, bounded resource counters and sanitized failure categories only; no source, stdin, stdout, protected content or credentials.
12. **Monitoring:** queue age/depth, admission rejection, boot/teardown latency, timeout/OOM/output-limit rates, host pressure, image age and cleanup failures; page on isolation/cleanup failure.
13. **Failure behavior:** any auth, resolution, hash, queue, boot, protocol, timeout, cleanup, schema or persistence uncertainty fails closed and cannot create reward evidence.
14. **Scaling:** initially a small bounded worker pool; autoscale from queue depth/age only after concurrency and teardown proof; retain headroom and isolate failure domains.
15. **Complexity:** high. The design requires virtualization operations, secure image supply chain, controller/queue engineering, adversarial testing, patching, observability and incident response.

## Capacity and cost model

No price claim is production-ready without benchmarks in the chosen region. The useful first model is resource demand and fixed capacity, not false per-request precision.

Assumptions for planning only:

- 30 days/month and one authoritative submission per counted request;
- Python consumes roughly 1-2 vCPU-seconds in the initial envelope; Java roughly 3-5 vCPU-seconds including compilation;
- worker fleets retain 50-75% headroom for bursts, host services and fault isolation;
- at least one KVM worker creates a fixed monthly floor even at zero traffic;
- storage, control-plane, logging, network, security operations and engineering labor are additional.

| Daily submissions | Monthly submissions | Approx. Python active compute | Approx. Java active compute | Operational shape |
|---:|---:|---:|---:|---|
| 100 | 3,000 | 3,000-6,000 vCPU-s | 9,000-15,000 vCPU-s | One small non-production/low-availability worker; fixed floor dominates |
| 1,000 | 30,000 | 30,000-60,000 vCPU-s | 90,000-150,000 vCPU-s | One to several workers depending on bursts and availability target |
| 10,000 | 300,000 | 300,000-600,000 vCPU-s | 900,000-1,500,000 vCPU-s | Autoscaled queue-backed pool, multiple failure domains and explicit capacity SLOs |

**ENGINEERING INFERENCE:** At current scale, host uptime and operational ownership will cost more than raw execution seconds. Per-submission Cloud Run Jobs are unattractive for this design because the official [Cloud Run pricing model](https://cloud.google.com/run/pricing) applies instance-based job billing with a one-minute minimum; a Cloud Run service may still be appropriate for the trusted API/controller but not as the learner-code sandbox.

M2.3A must measure cold boot, snapshot restore, Python/Javac/JVM latency, memory high-water marks, teardown reliability, safe concurrency, queue wait and host utilization. Those measurements should determine instance type, pool size, autoscaling and a real monthly budget.

## Delivery roadmap

### M2.3A - Infrastructure prototype

- Provision one isolated KVM-capable validation worker and controller.
- Establish jailer, seccomp, cgroups, network denial, immutable image pipeline, controller skeleton and teardown proof.
- Record cold-boot/restore and capacity baselines without API/reward integration.
- No learner traffic and no coins.

### M2.3B - Python judge

- Build the pinned CPython runner, deterministic protocol, limits and correctness corpus.
- Support only the reviewed standard-library/import policy; no learner package installation.
- Keep it non-production and disconnected from rewards.

### M2.3C - Java judge

- Build a separate pinned OpenJDK/Javac image and compile/run budgets.
- Fix the classpath and prohibit dependency downloads/build tools.
- Pass Java-specific correctness, class-loading, subprocess, memory and concurrency gates independently.

### M2.3D - Authoritative content completion

- Author/review protected definitions for the six legacy Practice IDs or explicitly mark them ineligible.
- Add Daily Challenge content hash, private suite and recurrence contract.
- Version suites independently and verify protected-data exclusion.

### M2.3E - ActivityVerification integration

- Implement authenticated internal job/result schemas, nonce/binding validation, admission control and observability.
- Connect `ActivityVerificationService` to the judge adapter in non-production.
- Keep the public verification endpoint and rewards disabled.

### M2.3F - Security and concurrency testing

- Independently review the host, jailer, seccomp, namespaces, cgroups, firewall, image pipeline and controller.
- Run the complete J1-J17 suite, golden semantic corpus, malformed-result tests, fault injection and target concurrency/load tests.
- Establish SLOs, quotas, capacity and cost ceiling from measurements.
- Confirm logs/metrics contain no source or protected tests.

### M2.3G - Reward authorization

- Approve versioned reward policies and eligible activities.
- Connect durable `SERVER_VALIDATED_EXECUTION` evidence to the M2.1 atomic claim ledger.
- Expose the authenticated abuse-limited verification path behind a disabled feature flag, validate one bounded non-production lifecycle, then use a separately authorized production rollout.
- Java remains ineligible until the M2.3C implementation and M2.3F security/concurrency gates pass independently.

## Go/no-go gates

The architecture may advance to M2.3A after the decisions below, but it is not safe for production or rewards until every mandatory gate is evidenced.

| Gate | Go criterion | Current state |
|---|---|---|
| Host isolation | J1-J12 adversarial suite passes with independent review | NOT TESTED |
| Result integrity | J13/J17 binding and malformed-result suite passes | NOT IMPLEMENTED |
| Failure safety | J14 fault injection yields zero claims/coins | Boundary fail-closed locally; deployed judge NOT TESTED |
| Content authority | All eligible IDs have immutable hashes and reviewed private suites | BLOCKED: six Practice IDs and Daily Challenge |
| Runtime fidelity | Pinned Python conformance corpus passes | NOT TESTED |
| Privacy | No learner source/protected content in logs; retention approved | REQUIRED REVIEW |
| Operations | Patch SLA, on-call, capacity, alerts and rollback proven | NOT IMPLEMENTED |
| Cost | Benchmarked 100/1k/10k scenarios fit approved ceiling | REQUIRED REVIEW |
| Rewards | Versioned product policy plus M2.1 idempotent integration | DISABLED |

Any sandbox escape, unexpected outbound network path, credential visibility, cross-submission state, unbounded host degradation, ambiguous pass, protected-suite disclosure, wrong activity/version/hash acceptance, or reward after failure is an automatic no-go.

## Decisions required before M2.3A

1. Approve a dedicated Linux/KVM non-production environment and region; ordinary developer Windows and serverless runtimes cannot host the selected boundary.
2. Assign ownership for kernel/VMM/runtime image patching, vulnerability response and incident handling.
3. Approve Python as the first and only initial authoritative language.
4. Approve exact CPython version, standard-library/package policy and initial measured limit envelope.
5. Approve a non-production capacity/cost ceiling and target burst/concurrency profile.
6. Approve source/result retention, sanitized telemetry and access policy.
7. Decide whether to author protected suites for the six legacy Practice questions or make them ineligible.
8. Approve Daily Challenge hash, protected-suite and recurrence schemas.
9. Approve controller/worker IAM, network, queue and result-authentication design before provisioning.
10. Define availability, latency, cleanup and patch SLOs.
11. Reaffirm that reward amounts and production activation require a separate M2.3G approval.

## Current classification

The architectural choice is sufficiently specific to start a bounded non-production spike. Security has not been proven and production execution remains prohibited.

**M2.3 JUDGE ARCHITECTURE SELECTED**
