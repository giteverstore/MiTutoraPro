# Certification integrity review

## Purpose

An attempt with a passing exam result but review-required integrity status is finalized with certification decision `REVIEW_REQUIRED`. It is not treated as failed and receives no certificate. Trusted finalization creates exactly one `certificationReviews/review-{attemptId}` record linked to the immutable integrity report.

## Record and lifecycle

```text
certificationReviews/{reviewId}
  reviewId, attemptId, candidateUid, courseId
  status: PENDING | IN_REVIEW | RESOLVED
  resolution: CERTIFIED | NOT_CERTIFIED | null
  reasonSummary, integrityReportId
  createdAt, updatedAt, resolvedAt, resolvedBy
  schemaVersion
```

The candidate can read their record but cannot create, update, or delete it. Review creation uses the deterministic ID `review-{attemptId}` and occurs in the finalization transaction, preventing duplicates.

## Privileged operations

`beginCertificationReview` and `resolveCertificationReview` are trusted callable Functions. They authorize only Firebase Auth tokens carrying a server-managed `admin: true` or `certificationReviewer: true` custom claim. No Firestore profile field or client-provided `isAdmin` value is accepted.

Resolution does not rewrite the immutable original attempt decision. Instead it records the review resolution and updates the candidate certification projection. A `CERTIFIED` resolution issues the same deterministic credential used by normal finalization; a `NOT_CERTIFIED` resolution issues nothing. Repeating the same resolution returns the existing record, while a conflicting resolution is rejected.

Custom claims must be provisioned through a separately controlled administrative process. A reviewer UI and role-management workflow are intentionally not included in this sprint.

## Candidate communication and privacy

Candidates see a concise result, decision explanation, and grouped integrity summary. Exact anti-cheating thresholds, raw timeline evidence, detector confidence details, media, frames, audio, and biometric material are not exposed. The detailed structured report and audit trail remain available for a future reviewer interface.
