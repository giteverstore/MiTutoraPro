# Certificates

Certificates is an AppShell module under `src/certificates/`. It presents earned credentials, in-progress courses, a responsive certificate viewer, and credential verification without depending on Learning Engine internals.

## Model and service

`certificateModel.js` normalizes earned and in-progress records. Stable fields include course identity, status, progress, certified hours, issue/completion dates, credential ID, verification status, and verification URL.

`CertificateService` exposes certificate retrieval, lookup, saving, reset, and export behavior through a replaceable repository. The local repository stores user-scoped records at `mi-tutora:certificates:v1:<userId>` and initializes the mock records on first use. A backend implementation can replace the repository without changing page components.

## Page composition

- `CertificateOverview` displays mock aggregate values.
- `CertificateCard` is shared by all earned credentials.
- `InProgressCertificateCard` renders progress and delegates Continue to the existing application course-opening callback.
- `CertificateViewer` is an accessible modal-style preview with Escape/backdrop close behavior.
- `CertificateVerification` displays the selected credential’s ID, verified status, URL, and QR placeholder.

The viewer’s PDF action is intentionally a placeholder for a future document service. Browser share and clipboard actions are used when available, with user-facing fallback status.

## Boundaries

Certificates does not calculate course completion or issue credentials from Learning Progress yet. Mock service records are the source for this sprint. Future issuance should consume a backend credential service rather than introducing certificate-generation logic into the Learning Engine.
