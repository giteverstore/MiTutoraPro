# Certificates

Certificates is an AppShell module under `src/certificates/`. It presents authoritative credentials, certification eligibility, attempt status, and a responsive credential viewer without depending on Learning Engine internals.

## Source of truth

`CertificateService` is read-only. It queries `certificates/{credentialId}` records whose `ownerUid` matches the authenticated user. Candidate code cannot create, update, reset, or delete credentials. Trusted certification Functions issue deterministic credentials after a finalized `CERTIFIED` decision.

The page also reads `users/{uid}/certifications/{courseId}` through `CertificationService` and distinguishes locked, eligible/exam available, active attempt, evaluation, certified, not certified, review required, and incomplete states. No mock credential is seeded in production.

## Page composition

- `CertificateOverview` derives aggregate values from authoritative records.
- `CertificateCard` renders issued credentials.
- `CertificateViewer` provides an accessible preview with Escape/backdrop close behavior.
- `CertificateVerification` displays the credential ID and status. Public verification links and PDF generation remain deferred.

See [Certification lifecycle](certification-lifecycle.md) for issuance, security, and trust-boundary details.
