# Security and infrastructure

## Threat model

Learner source is hostile: it may loop, fork, exhaust memory/disk/output, probe credentials/metadata, exploit runtimes/kernels, exfiltrate hidden tests, attack neighbors, or forge results. Browser execution is safe for feedback only because the learner controls it. Ordinary serverless functions do not constitute a sufficient sandbox for hostile native code.

## Recommended topology

```text
Browser -> authenticated submission API -> bounded queue -> judge controller
        <- sanitized status/result        <- isolated worker
                                                -> disposable microVM
```

Vercel or Firebase functions may implement the control-plane API if payload/duration constraints fit. The data plane should be a separately isolated Linux/KVM service. The repository's existing `isolated-code-judge.md` selects Firecracker per submission and provides a Python-first contract, but explicitly describes it as not deployed.

## Mandatory controls

- Immutable, signed, digest-pinned runtime/kernel/rootfs/harness images.
- One fresh microVM per submission; no learner-influenced snapshot reuse.
- Jailer/seccomp/namespaces/cgroup v2; non-root VMM and guest.
- No network device, cloud credentials, metadata access, host mounts, package downloads, or writable root.
- Quota-limited scratch and strict CPU, wall, memory, PID/thread, file, syscall, input/output limits.
- Kill the entire cgroup and verify process, mount, socket, jail, scratch, and directory teardown before accepting a result.
- Protected expected results remain controller-side where feasible.
- Authenticated internal calls, least-privilege IAM, separated projects/networks, encryption, redacted logs, immutable audit IDs.
- Per-user/IP quotas, queue limits, concurrency caps, idempotency, abuse detection, and global circuit breakers.

## Failure semantics

Separate compile error, runtime error, timeout, memory/output/resource limit, wrong answer, validator failure, judge unavailable, and cleanup failure. Fail closed: infrastructure or cleanup uncertainty cannot produce a trusted pass. Public errors must be bounded and sanitized; never return raw commands, protected inputs/expectations, guest frames, or controller stderr.

## Language rollout

Start with Python only after the existing Firecracker design passes real containment, cleanup, conformance, load, and fault-injection gates. Java needs a separately pinned JDK/Javac profile and larger measured memory/startup limits. JavaScript/TypeScript, C/C++, C#, PHP, and R each require their own minimal images, harness conformance corpus, dependency allowlist, CVE/patch process, and resource measurements. Browser support is not evidence that a secure server image exists.

## Capacity and cost

Cost has a fixed KVM-worker floor plus submission compute, storage, queue/API traffic, observability, image builds/scans, patching, and on-call operations. Queue arrival rate, cold boot, compile/run latency, memory high-water, teardown time, and burst concurrency must be measured before sizing. Use bounded worker pools first; autoscale on queue depth/age only after cleanup and concurrency proof. Retain headroom and isolate failure domains.

`isolated-code-judge.md` gives planning-only Python/Java compute estimates and explicitly says measurements are pending; they are not a budget guarantee.

## Hosting fit

- **Vercel:** appropriate for web UI and possibly short control-plane endpoints; unsuitable as the isolation boundary and for KVM workers.
- **Firebase/Auth/Firestore:** appropriate for identity, public content metadata, submission/status records, and idempotent progress; rules do not protect data already sent to clients.
- **Dedicated KVM pool:** required by the selected Firecracker design.
- **Remote compiler service:** existing Go/Rust infrastructure offers patterns for API health, quotas, and isolation, but is not a ready nine-language hidden-test judge.

## Security acceptance gates

Require independent threat review, hostile corpus, network/credential proof, resource-limit proof, cross-run contamination tests, teardown fault injection, protected-data leak scanning, replay/idempotency tests, load/queue tests, provenance verification, vulnerability policy, incident runbooks, cost alarms, and an emergency disable switch before rewards or completions trust the judge.
