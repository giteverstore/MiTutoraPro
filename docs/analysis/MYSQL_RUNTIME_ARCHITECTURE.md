# MySQL learning runtime

The MySQL compiler entry is an authenticated database execution runtime. It never uses SQLite and never exposes MySQL credentials to the browser.

## Deployment boundary

The browser sends a Firebase ID token and learner SQL to `POST /api/compiler/mysql/run`. A Vercel Function verifies the identity, applies per-process request/concurrency limits, and calls a MySQL 8 sandbox service. Production remains disabled until `MYSQL_RUNTIME_ENABLED=true` and a private MySQL 8 endpoint with the required least-privilege accounts is configured.

Each execution creates a server-generated `yc_sbx_<timestamp>_<56-bit-random>` database and a unique `yc_run_<same-suffix>` account through the administrative pool. The account receives grants on that exact database only; no shared wildcard learner account exists. Setup and learner statements run through the ephemeral identity. Cleanup independently drops both database and account in `finally`, including query-error, timeout, cancellation, and exception paths. The bounded janitor in `mysqlSandboxJanitor.js` defaults to dry-run, recognizes only the exact generated naming pattern, and can recover stale resources after process termination.

## Public standalone contract

Standalone `/mysql` uses the explicit `publicStandalone` client context and `POST /api/compiler/mysql/public`. That endpoint accepts exactly `{ "sql": "..." }`; database names, credentials, hosts, ports, setup SQL, grants, options, paths, environment values, and arbitrary connection details are rejected. It never infers public mode from a missing learning content identifier and never calls or weakens the learning canonical-content path.

Authentication is optional. A verified Firebase token selects a UID-derived quota identity; an invalid supplied token is rejected rather than downgraded. Anonymous identity resolution follows trusted Vercel forwarding metadata, then the socket address, then forwarded fallback, and persists only a truncated SHA-256 derivative. Raw addresses and SQL are not stored in quota documents or operational logs.

Public Firestore state is isolated in `compilerPublicMysqlRateLimits/{identityHash}` and `compilerPublicMysqlRuntime/global`, with client access denied. Anonymous limits are 10 executions per 10 minutes and 30 per hour; authenticated limits are 20 per 10 minutes and 60 per hour. Both allow one active execution per identity, while the initial global public cap is four active executions with no application queue. A 75-second defensive lease covers sandbox creation, the 10-second execution deadline, cleanup, and network overhead. Leases are transactionally pruned, released in `finally`, and expired rate documents are removed by the bounded public compiler janitor.

Public execution reuses `MySqlSandboxService` with an empty `setupSql`. The service generates the random database, ephemeral user, and password; grants only the existing exact-database learner privileges; runs the request through that user; and independently drops the database and user in `finally`. Public limits remain 64 KiB SQL, an 80 KiB request envelope, 50 statements, 10 seconds, and 1,000 transported rows per result. `PUBLIC_MYSQL_RUNTIME_ENABLED`, `MYSQL_RUNTIME_ENABLED`, and `MYSQL_DISTRIBUTED_QUOTA_ENABLED` must each be exactly `true`; the public flag defaults off and does not control learning execution.

The administrative account needs global `CREATE`, `DROP`, and `CREATE USER`, plus `GRANT OPTION` only for the listed learner privileges on escaped `yc_sbx_%`. Each execution account receives those data/DDL privileges on one exact database. It receives no `SUPER`, `FILE`, `PROCESS`, account administration, grant, shutdown, or system privilege. Server configuration disables local infile and filesystem export.

Expected local administrative grants are conceptually:

```sql
GRANT CREATE, DROP, CREATE USER ON *.* TO 'ycoders_admin'@'%';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES,
  CREATE TEMPORARY TABLES, LOCK TABLES, EXECUTE, SHOW VIEW, CREATE VIEW
  ON `yc_sbx_%`.* TO 'ycoders_admin'@'%' WITH GRANT OPTION;
GRANT SELECT (User, Host) ON mysql.user TO 'ycoders_admin'@'%';
```

## Limits and serialization

- 64 KiB learner source and development setup source
- 50 statements per request
- 10-second server-side query deadline
- 1,000 transported rows per result; the UI continues displaying its first 500
- four concurrent executions and twenty requests per learner per minute by default
- `BIGINT` and `DECIMAL` remain precision-safe strings, dates are tagged ISO strings, buffers are tagged base64, and SQL `NULL` remains JavaScript `null`

The process-local limiter protects individual instances only. It is not a production abuse-control boundary. A production rollout requires a shared distributed quota and concurrency lease before enablement.

## Setup SQL trust

Browser-supplied setup SQL is accepted only outside production when `MYSQL_ALLOW_DEV_SETUP_SQL=true`. Production resolves published Firestore metadata and versioned Firebase Storage content through `FirebaseMySqlContentSource`. Practice uses its question ID, Challenge uses its assignment ID (including canonical Practice references), and Course uses `courseId:lessonId`. The resolver verifies published state, MySQL language, exact item binding, content hashes, and premium entitlement when metadata marks content premium. Arbitrary or unpublished references fail closed.

## Distributed execution controls

Production requires `MYSQL_DISTRIBUTED_QUOTA_ENABLED=true`. Firestore transactions atomically maintain one aggregate user document and one bounded global lease map. Each execution costs two document reads/two writes to acquire and two reads/two writes to release. Leases include owner, creation, and expiry timestamps; stale leases are pruned transactionally. The process-local guard remains defense in depth, not authority.

## Production gate and topology

`MYSQL_RUNTIME_ENABLED` must equal the lowercase string `true`; missing, empty, `false`, `TRUE`, or `1` remain disabled. Production also fails closed unless verified TLS is enabled. The endpoint uses the existing Firebase bearer-token verifier and approved Vercel OIDC-to-Google credential boundary; no database secret is sent to the browser.

A public MySQL endpoint is not recommended. The database should accept only the execution service's stable private egress or private-network path. Ordinary dynamically addressed serverless egress cannot be safely allowlisted by IP. Before rollout, choose and cost a concrete region-aligned topology, provision HA/backups/monitoring, configure secret rotation, and prove connection capacity under scale-to-zero/cold-start and burst behavior. This repository does not provision or mutate that infrastructure.

Operational logs must contain timings, result counts, public error codes, and cleanup outcomes only. Never log SQL source, setup SQL, tokens, passwords, connection strings, or learner identifiers. Alert on authentication spikes, rate limits, pool exhaustion, timeouts, cleanup failure, stale-resource count, database connections, CPU, memory, storage, and replication/backup health.

## Cost model

The fixed floor is the managed MySQL instance (and any HA replica), provisioned CPU/RAM, storage, backups, and monitoring. Variable cost follows learner query CPU/I/O, concurrent connections, stored bytes during a run, network transfer, Vercel function duration, logs/metrics, and janitor invocations. A private-connectivity or fixed-egress product may add a separate base charge. Registered compiler-language count does not drive MySQL cost: only requests routed to the MySQL execution endpoint consume this infrastructure. Capacity and cost must be measured with production-like concurrency before enablement; no paid resource is provisioned by this repository change.

## Release checklist

1. Provision a private MySQL 8.4 service in the same region as execution.
2. Apply the documented least-privilege grants and capture `SHOW GRANTS` evidence.
3. Configure verified TLS and server-only secrets; prove rotation and rollback.
4. Implement the canonical content-source adapter and a distributed quota/concurrency lease.
5. Schedule the janitor with dry-run review first, then a bounded destructive run.
6. Run the complete integration suite against the real target engine, including isolation, privilege-denial, timeout recovery, stale cleanup, types, and four-way concurrency.
7. Load-test pool/connection limits and measure p50/p95/p99 latency and cost.
8. Keep the feature flag off through deployment; enable gradually with alerts and a rollback owner.

Repository implementations for item 4 now exist and have unit/emulator coverage. Production must still grant the WIF runtime identity access to the canonical metadata, objects, and quota documents.

## Janitor, rotation, and rollback

Vercel is configured to call `/api/compiler/mysql/janitor` hourly. The endpoint accepts only a timing-safe bearer match against `MYSQL_JANITOR_SECRET` (or the platform `CRON_SECRET`), processes at most 20 stale databases and 20 stale generated users, and never returns their names. Begin with the janitor function's dry-run mode during provisioning review before enabling the scheduled endpoint.

Rotate the sandbox-admin password by creating a second least-privilege admin identity with the documented grants, updating the server secret, validating with `npm run validate:mysql-production -- --live`, and then removing the old identity. Rotate the janitor secret by deploying a new value before revoking the old scheduling credential. Networking credentials should use the same overlap-and-live-preflight procedure. Never rotate by placing secrets in `VITE_*` variables.

`MYSQL_RUNTIME_ENABLED=false` is the immediate kill switch for new executions and janitor database access. Browser-side SQLite and all other compiler runtimes are independent and continue operating. Existing database queries are bounded by connection destruction and the 10-second execution deadline.

## Provider-neutral production requirements

The provider must supply genuine MySQL 8.4 LTS, verified TLS/custom-CA support, automatic backups, monitoring, credential rotation, sufficient connection capacity, and a region compatible with the selected Vercel Functions region. Both supported application patterns are environment-only: dedicated/static Vercel egress allowlisted by a TLS endpoint, or private connectivity/proxy to MySQL. No provider-specific networking code is embedded in the runtime.

At four active executions per function instance, each instance can hold four disposable learner connections plus up to two admin-pool connections. Capacity planning must multiply that six-connection upper bound by the maximum simultaneously warm instances, then include provider/admin headroom. The distributed global lease currently caps active learner runs at four across instances, making the initial expected application maximum approximately six active connections plus platform/provider overhead. Validate the provider's connection accounting and p95 latency before rollout.

## Local verification

Install Docker, then run `docker compose -f docker-compose.mysql.yml up -d`. Configure the server-only variables from `.env.example`, set `MYSQL_INTEGRATION_TEST=true`, and run `npm run test:mysql:integration`. The fixture binds MySQL only to loopback port 3307 and uses local-only credentials.

The Worker/WASM isolation used by browser runtimes does not apply here. The security boundary is the authenticated API, unguessable generated identity, per-run account, exact-database grants, MySQL limits, connection destruction, and cleanup. Database/user cleanup is best-effort rather than literally guaranteed if a process is terminated; the janitor is the recovery control.
