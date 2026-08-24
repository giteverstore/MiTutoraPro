# Batch 8 Production Prerequisites

**Status:** prerequisite package only; production remains unchanged.

## Current blockers

The production inventory used the existing service account against `mi-tutora-pro`. It could inspect Firestore and Storage, but the Cloud Functions v2 list request, Cloud Logging query, Cloud Monitoring inventory, and Firebase App Check configuration inventory were not authorized or available. The workstation runs Node.js `v25.9.0`; no `nvm`, `fnm`, or Volta installation was found. Chocolatey is installed, but automatically changing the machine runtime is outside this checkpoint.

Production Storage contains 218 content objects without the custom metadata required by the checked-in rules. Deploying `storage.rules` before the approved metadata migration would deny all of those objects.

## Minimum read-only IAM roles

Grant these roles to the existing inventory service account on project `mi-tutora-pro`:

| Role | Required inventory | Allows | Does not allow |
| --- | --- | --- | --- |
| `roles/cloudfunctions.viewer` | List the 17 deployed functions and inspect runtime, region, trigger, build/service configuration, update time, and IAM policy | Read-only Cloud Functions API access | Deploy, update, delete, or invoke functions; mutate Cloud Run services |
| `roles/logging.viewer` | Query normal function/application logs in the default log views | Read logs in `_Required` and the `_Default` view | Write/delete logs or modify sinks/buckets; it does not expose private Data Access logs |
| `roles/monitoring.viewer` | List metrics/time series, alert policies, and notification channels | Read-only Monitoring data and configuration | Create/update/delete metrics, policies, channels, incidents, or dashboards |
| `roles/firebaseappcheck.viewer` | Read the registered web provider and enforcement configuration after the API is enabled | Read-only App Check provider, debug-token metadata, and service configuration | Register/update providers, create debug tokens, change enforcement, or verify tokens |

These are predefined least-privilege viewer roles; do not substitute Owner, Editor, Firebase Admin, or App Check Admin. `roles/cloudrun.viewer` is not needed for the planned Cloud Functions v2 API inventory because the required runtime/service configuration is returned by `cloudfunctions.functions.get/list`. Add it only if a later, separately approved inventory must inspect the backing Cloud Run resource directly.

Official role references: [Cloud Functions Viewer](https://cloud.google.com/functions/docs/reference/iam/roles), [Logs Viewer](https://cloud.google.com/logging/docs/access-control), [Monitoring Viewer](https://cloud.google.com/monitoring/access-control), and [Firebase App Check Viewer](https://firebase.google.com/docs/projects/iam/roles-predefined-product#app-check).

## Manual IAM grant commands

Run these as a project IAM administrator. The first command reads only the non-secret `client_email` field locally; never print or upload the JSON file.

```powershell
$projectId = 'mi-tutora-pro'
$serviceAccountEmail = (Get-Content -Raw $env:GOOGLE_APPLICATION_CREDENTIALS | ConvertFrom-Json).client_email

gcloud projects add-iam-policy-binding $projectId --member="serviceAccount:$serviceAccountEmail" --role="roles/cloudfunctions.viewer" --condition=None
gcloud projects add-iam-policy-binding $projectId --member="serviceAccount:$serviceAccountEmail" --role="roles/logging.viewer" --condition=None
gcloud projects add-iam-policy-binding $projectId --member="serviceAccount:$serviceAccountEmail" --role="roles/monitoring.viewer" --condition=None
gcloud projects add-iam-policy-binding $projectId --member="serviceAccount:$serviceAccountEmail" --role="roles/firebaseappcheck.viewer" --condition=None
```

Console alternative: Google Cloud Console → IAM & Admin → IAM → Grant access → enter the existing service-account email → add the four roles above → Save. Confirm the binding scope is only `mi-tutora-pro`.

Read-back after the grant:

```powershell
$env:FIREBASE_PROJECT_ID = 'mi-tutora-pro'
node scripts/read-production-platform-inventory.mjs
npx.cmd firebase-tools functions:list --project mi-tutora-pro
```

The production baseline to verify is 17 functions: 16 HTTPS callable functions and one scheduled function. For each, record name, generation, region, runtime, trigger, update time, and compare the deployed entry point/runtime with `functions/src/index.js` and `functions/package.json`. The current local index exports 18 functions (17 callable and one scheduled), so the inventory must explicitly identify the extra or missing name instead of assuming production and source match. This is read-only; do not deploy during inventory.

## Actual Node.js 22 setup

Detected state:

- active `node`: `v25.9.0`
- `nvm`, `fnm`, Volta, Winget, and Scoop: not detected
- Chocolatey: installed
- system Node installation: `C:\Program Files\nodejs`

The safest low-impact option is the official portable Node.js 22 x64 ZIP. It avoids replacing the system Node 25 installation or installing a version manager. As of this audit, the current Node 22 LTS archive is `v22.23.2`. Run manually:

```powershell
$node22Root = 'C:\Tools\node-v22.23.2-win-x64'
$zip = "$env:TEMP\node-v22.23.2-win-x64.zip"
$checksums = "$env:TEMP\node-v22.23.2-SHASUMS256.txt"

Invoke-WebRequest 'https://nodejs.org/dist/v22.23.2/node-v22.23.2-win-x64.zip' -OutFile $zip
Invoke-WebRequest 'https://nodejs.org/dist/v22.23.2/SHASUMS256.txt' -OutFile $checksums
Get-FileHash $zip -Algorithm SHA256
Select-String -Path $checksums -Pattern 'node-v22.23.2-win-x64.zip'
# Continue only when the two SHA-256 values match.
Expand-Archive $zip -DestinationPath 'C:\Tools' -Force
$env:Path = "$node22Root;$env:Path"
node --version
npm.cmd --version
```

`node --version` must print `v22.23.2` in that same shell. Then install dependencies and run the root validation suite under that same Node 22 process path:

```powershell
Push-Location functions
npm.cmd ci
Pop-Location
node --version
npm.cmd run validate:certification
npm.cmd run validate:certification-trust
npm.cmd run validate:trusted-completion
npm.cmd run validate:certification-evidence
npm.cmd run validate:remediation-batch-8
```

The `functions` package currently has no standalone `test` script, so `npm test --if-present` there would not prove runtime compatibility. The root validation commands above import and exercise the Functions/certification implementation under the active Node 22 runtime.

If a version manager is preferred later, install nvm-windows manually and resolve its documented conflict with the existing `C:\Program Files\nodejs` installation first. Do not claim Node 22 validation from tests executed under Node 25.

## Storage migration prerequisite design

The repository already defines the authorization schema in `storage.rules`: `publicationState` is Firebase Storage **custom metadata**, and the active value is exactly `ACTIVE`. The migration must use that schema, not Firestore or top-level object metadata.

Required workflow:

1. Enumerate only metadata-referenced active version prefixes. Record object path, generation, metageneration, byte length, content type, all existing custom metadata, and SHA-256 of downloaded bytes.
2. Verify each byte sequence against the approved local/generated authority. Classify mismatches before any write. Never activate unknown content.
3. Dry-run an immutable plan containing the expected generation, computed SHA-256, and merged custom metadata for every object.
4. With explicit approval, call metadata update only; preserve bytes, path, content type, cache controls, download tokens, and unrelated custom metadata. Set `publicationState=ACTIVE` and `sha256=<lowercase hex>`.
5. Use generation/metageneration preconditions so concurrent changes fail closed. The command must be idempotent: already-correct objects produce no write.
6. Re-download each object, recompute SHA-256, and verify custom metadata and generation. Abort the rollout on the first mismatch.
7. Deploy `storage.rules` only after all 218 currently served objects pass read-back.

Rollback data must be written to a local, access-controlled audit file before mutation. It contains each original metadata map and generation. Rollback restores only metadata using preconditions; it never deletes or rewrites bytes. Keep the previous ruleset available for immediate rules rollback. The ten unreferenced Python v1 objects are not deleted or activated automatically; they require a separate retention decision.

## Observability readiness

`StructuredLogger` currently emits:

- `certification.callable.rejected`
- `certification.review.rejected`
- `certification.maintenance.completed`
- attempt created, started, recovered, submitted, and finalized events
- certificate issuance, expiry, and finalization-retry failures

It removes object fields whose keys resemble passwords, tokens, credentials, secrets, answers, source code, camera, or microphone data, and converts thrown errors to stable codes at callable boundaries. Gaps to address in a future code checkpoint—not here—are explicit rate-limit rejection events, App Check rejection visibility, trusted-completion success/failure events, per-operation latency, and stable success/outcome counters. Raw `uid`, `attemptId`, `submissionId`, `certificateId`, and some raw error messages are currently logged by service-level events; user identifiers should be pseudonymized and arbitrary error messages removed before expanding production telemetry. The callable wrapper also reports anonymous handlers as `callable`, so several rejection events lack a stable operation dimension.

`roles/logging.viewer` and `roles/monitoring.viewer` are sufficient for the requested read-only inventory. Creating log-based metrics, alert policies, or notification channels will require a separate approved writer-role checkpoint and is intentionally excluded here.

## Security notes

- Viewer grants are project-scoped because list APIs operate at project scope; periodically remove them when the inventory work ends.
- Do not grant private-log access unless a documented Data Access log requirement appears.
- Enabling an API, adding Storage metadata, registering App Check, changing enforcement, deploying rules/functions, and creating alerts are all production mutations and require later explicit approval.
- No Batch 8 blocker is resolved by this document.

## Status

- MIT-006: **PARTIALLY RESOLVED**
- MIT-007: **PARTIALLY RESOLVED**
- MIT-023: **PARTIALLY RESOLVED**
- MIT-033: **PARTIALLY RESOLVED**
- MIT-035: **PARTIALLY RESOLVED**
