import assert from 'node:assert/strict';
import { Timestamp } from 'firebase/firestore';
import {
  createCertificate,
  formatCertificateDate,
  normalizeCertificateDate,
} from '../src/certificates/certificateModel.js';

const instant = Date.UTC(2026, 7, 12, 10, 30, 15, 125);
const iso = new Date(instant).toISOString();
const firestoreTimestamp = Timestamp.fromMillis(instant);
const serializedTimestamp = JSON.parse(JSON.stringify(firestoreTimestamp));

assert.equal(normalizeCertificateDate(firestoreTimestamp), iso);
assert.equal(normalizeCertificateDate(serializedTimestamp), iso);
assert.equal(normalizeCertificateDate(new Date(instant)), iso);
assert.equal(normalizeCertificateDate(iso), iso);
assert.equal(normalizeCertificateDate(instant), iso);
assert.equal(normalizeCertificateDate(null), null);
assert.equal(normalizeCertificateDate(undefined), null);
assert.equal(normalizeCertificateDate('not-a-date'), null);
assert.equal(formatCertificateDate(null), 'Date unavailable');
assert.equal(formatCertificateDate('not-a-date'), 'Date unavailable');

const normalized = createCertificate({
  credentialId: 'MIT-PYTHON-TEST',
  courseId: 'python',
  issuedAt: serializedTimestamp,
  status: 'ACTIVE',
});
assert.equal(normalized.completionDate, iso);
assert.equal(normalized.issueDate, iso);

const missing = createCertificate({ credentialId: 'MIT-PYTHON-MISSING', courseId: 'python' });
assert.equal(missing.completionDate, null);
assert.equal(missing.issueDate, null);
assert.equal(formatCertificateDate(missing.issueDate), 'Date unavailable');

process.stdout.write('Certificate date validation passed: Firestore, Date, ISO, numeric, missing, and malformed values are safe.\n');
