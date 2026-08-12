# Secure certification lifecycle

## Purpose and trust boundary

Certification wraps the existing browser exam and proctoring runtime in a persistent, trusted workflow. The browser observes the candidate environment, stores recoverable answers, and sends allow-listed structured integrity evidence. Firebase Functions establish time, validate state transitions, score answers, evaluate integrity, decide certification, and issue credentials.

**Client observation is not an authoritative certification result.** Client-provided scores, decisions, deadlines, and certificate fields are ignored. Correct answers exist only in the Functions source and are not delivered in the candidate exam payload.

## Runtime flow

Course completion → eligibility → attempt → environment verification → running exam and monitoring → submission → trusted evaluation → certification decision → optional certificate issuance.

`ExamProvider` remains the UI/runtime coordinator. It delegates remote operations to `CertificationService`, debounced answer and lifecycle-event synchronization to `ExamPersistenceCoordinator`, and idempotent submission to `SubmissionCoordinator`. Existing detectors continue to emit events through the existing event bus; they do not know about Firestore.

## Attempt lifecycle

Durable states are `CREATED`, `SCHEDULED`, `VERIFYING`, `READY`, `RUNNING`, `SUBMITTED`, `EVALUATING`, and `FINALIZED`. Exceptional terminals are `CANCELLED`, `EXPIRED`, and `ABANDONED`. `SUBMITTING` is UI-only. Both client contracts and trusted backend code centralize transition validation; terminal attempts cannot return to a running state.

## Firestore layout

- `certificationExams/{examId}`: published, versioned metadata without answer keys.
- `users/{uid}/certifications/{courseId}`: candidate projection, eligibility, active/latest attempt and credential reference.
- `examAttempts/{attemptId}`: server-owned aggregate, lifecycle, lease, trusted deadline, and final results.
- `examAttempts/{attemptId}/responses/current`: recoverable untrusted answers and monotonic revision.
- `examAttempts/{attemptId}/integrityEvents/{eventId}`: allow-listed structured evidence; never raw media.
- `certificates/{credentialId}`: immutable authoritative credential.

Direct client writes to attempt, response, integrity, decision, and certificate documents are denied. Callable Functions use the Admin SDK and enforce ownership, session leases, revisions, and lifecycle rules.

## Time, lease, and recovery

Starting an attempt creates `startedAt` and `expiresAt` from trusted timestamps. The countdown renders `expiresAt - serverAdjustedNow`; remaining seconds are never persisted. A session UUID owns the active lease, and a monotonic heartbeat refreshes it at a cost-controlled interval. Reload recovery reuses the attempt, answers, integrity events, and deadline. A fresh tab may acquire a stale lease only within `recoveryDeadline`; an active lease blocks concurrent tabs/devices.

## Persistence and submission

Answers are debounced, serialized for change detection, and assigned increasing revisions. The backend rejects stale revisions and any write after submission. Integrity synchronization stores lifecycle changes (start/recovery/dismissal), not detector frames or timer ticks.

Manual and timeout submission share one `SubmissionCoordinator`, stable `submissionId`, and promise. The backend transaction freezes the accepted revision and changes `RUNNING → SUBMITTED`. Retries with the same ID return the existing attempt. Evaluation claims `EVALUATING`, calculates separate `ExamResult` and `IntegrityResult`, applies the versioned certification policy, and finalizes once. Credential IDs are deterministic, so retrying issuance cannot duplicate a certificate.

## Trusted course completion and eligibility

The local Learning Progress model continues to drive navigation and learner UX, but it is no longer an eligibility authority. Completing a lesson calls the trusted `recordTrustedLessonCompletion` operation. Trusted code loads the current published course manifest from the versioned Storage path, validates the course and lesson identity, and records a bounded completion fact in `users/{uid}/trustedCourseProgress/{courseId}`. Direct client writes to that ledger are denied.

`CourseCompletionEngine` derives required lessons from the manifest (`required !== false`), so module and lesson counts are not hardcoded. `getCertificationStatus` evaluates the trusted ledger against the same manifest and persists only the eligibility projection: progress version, required/completed counts, percentage, evaluated time, and policy version. Changing the legacy user-writable aggregate progress document cannot unlock certification.

This mechanism establishes server ownership and manifest consistency. Like any browser-delivered reading product, it cannot cryptographically prove that a human understood prose; assessments and exercise verification provide stronger evidence where applicable.

## Decisions and explanations

Decision values are `CERTIFIED`, `NOT_CERTIFIED`, `REVIEW_REQUIRED`, and `INCOMPLETE`. Passing the exam and acceptable integrity produce `CERTIFIED`; a low exam score produces `NOT_CERTIFIED`; suspicious integrity produces `REVIEW_REQUIRED`; ineligible or exceptional terminal attempts produce `INCOMPLETE`.

The versioned trusted certification policy is defined once in `CertificationPolicy.js` and consumed by `CertificationEngine`. Each decision includes a candidate-safe explanation with the exam score, passing requirement, integrity status, and plain-language statements. Sensitive monitoring thresholds and detector confidence values are deliberately excluded.

## Integrity report and immutable finalization

At finalization, `IntegrityReportEngine` aggregates normalized lifecycle events by candidate-facing category. The immutable report records occurrence counts, total/maximum durations, monitoring duration, integrity status, policy version, detector/model version snapshots, a timeline summary, and a content hash. It never contains raw media. Integrity statuses (`CLEAN`, `MINOR_CONCERNS`, `SIGNIFICANT_CONCERNS`, `REVIEW_REQUIRED`) remain distinct from certification decisions.

The final transaction atomically writes the final exam and integrity results, report reference, decision, evaluation versions, certificate or review reference, and `finalizedAt`. Candidate rules deny writes to all of these records. Retries observe `FINALIZED` and return the existing artifacts.

## Audit trail

`examAttempts/{attemptId}/auditEvents/{eventId}` stores immutable, idempotently keyed lifecycle facts such as creation, start, recovery, submission, evaluation, decision, review, and issuance. Events include actor type, an actor identifier only when operationally necessary, trusted timestamp, bounded metadata, and schema version. The trail contains no answers, answer keys, or raw monitoring media.

## Privacy and observability

No camera frames, screenshots, face images, microphone recordings, PCM buffers, tensors, streams, or base64 media are persisted. Evidence is reduced to bounded primitive measurements, identifiers, versions, confidence/quality values, and lifecycle times. Backend logs contain operation identifiers and outcomes, not answer keys, raw media, passwords, or unnecessary personal data.

## Deployment and validation

Deploy Firestore rules/indexes and Functions from `firebase.json`. Create the published `certificationExams/python-foundations-certification` metadata document with version `1.0.0` before using the exam. Run `npm run validate:certification`, `npm run validate:certification-security`, all existing exam suites, `npm run build`, and `git diff --check` before release.
