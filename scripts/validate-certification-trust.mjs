import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { CourseCompletionEngine } from '../functions/src/certification/CourseCompletionEngine.js';
import { IntegrityEvaluationEngine } from '../functions/src/certification/IntegrityEvaluationEngine.js';
import { IntegrityReportEngine } from '../functions/src/certification/IntegrityReportEngine.js';
import { CertificationEngine } from '../functions/src/certification/CertificationEngine.js';
import { ReviewService } from '../functions/src/certification/ReviewService.js';
import { CertificateIssuer } from '../functions/src/certification/CertificateIssuer.js';

const manifest = { id: 'future-course', schemaVersion: '1.0.0', metadata: { version: '3.0.0' }, modules: [{ id: 'module-a', lessons: [{ id: 'lesson-a' }, { id: 'lesson-b' }, { id: 'optional', required: false }] }] };
const completion = new CourseCompletionEngine();
assert.equal(completion.evaluate(manifest, { completion: 100, completedLessons: [] }).eligibilityStatus, 'LOCKED', 'client aggregate completion must not unlock certification');
assert.equal(completion.evaluate(manifest, { completedLessons: ['lesson-a'] }).completionPercentage, 50);
const eligible = completion.evaluate(manifest, { completedLessons: ['lesson-a', 'lesson-b'] });
assert.equal(eligible.eligibilityStatus, 'ELIGIBLE');
assert.equal(eligible.requiredLessons, 2);

const events = [
  { id: 'event-1', type: 'LOOKING_AWAY', status: 'RECOVERED', startedAt: 1000, endedAt: 4000, durationMs: 3000, severity: 'medium', detectorId: 'lookingAway', detectorVersion: '1.2.0', modelVersion: 'vision-1' },
  { id: 'event-2', type: 'LOOKING_AWAY', status: 'RECOVERED', startedAt: 5000, endedAt: 7000, durationMs: 2000, severity: 'medium', detectorId: 'lookingAway', detectorVersion: '1.2.0', modelVersion: 'vision-1' },
];
const integrityEngine = new IntegrityEvaluationEngine();
const integrityResult = integrityEngine.evaluate(events, 10000);
const report = new IntegrityReportEngine(integrityEngine.policy).create({ attempt: { id: 'attempt-1', ownerUid: 'candidate', examVersion: '1.0.0', configVersions: { certification: '2.0.0' } }, events, integrityResult, createdAt: 8000 });
assert.equal(report.violations[0].occurrences, 2);
assert.equal(report.violations[0].totalDurationMs, 5000);
assert.equal(report.violations[0].maximumDurationMs, 3000);
assert.equal(report.detectorVersions.lookingAway, '1.2.0');
assert.equal(report.modelVersions[0], 'vision-1');
assert.equal(/camera|audio|frame|tensor|base64|screenshot/i.test(JSON.stringify(report)), false, 'report must not contain raw media fields');

const certification = new CertificationEngine();
const passed = { score: 90, passingScore: 70, passed: true };
const failed = { score: 50, passingScore: 70, passed: false };
const clean = { ...integrityResult, score: 100, flags: [], overallStatus: 'CLEAN' };
const suspicious = { ...integrityResult, score: 40, flags: ['CRITICAL_VIOLATION'], overallStatus: 'REVIEW_REQUIRED' };
assert.equal(certification.evaluate({ eligible: true, attemptState: 'EVALUATING', examResult: passed, integrityResult: clean }).status, 'CERTIFIED');
assert.equal(certification.evaluate({ eligible: true, attemptState: 'EVALUATING', examResult: failed, integrityResult: clean }).status, 'NOT_CERTIFIED');
assert.equal(certification.evaluate({ eligible: true, attemptState: 'EVALUATING', examResult: passed, integrityResult: suspicious }).status, 'REVIEW_REQUIRED');
assert.equal(certification.evaluate({ eligible: true, attemptState: 'ABANDONED', examResult: passed, integrityResult: clean }).status, 'INCOMPLETE');

const issuer = new CertificateIssuer();
const attempt = { id: 'attempt-1', ownerUid: 'candidate', courseId: 'python', examVersion: '1.0.0' };
assert.equal(issuer.credentialId(attempt), issuer.credentialId(attempt), 'credential issuance key must be deterministic');
const reviewService = new ReviewService({ db: {}, issuer, audit: {} });
const reviewA = reviewService.createRecord(attempt, report, 'Additional review required.', 8000);
const reviewB = reviewService.createRecord(attempt, report, 'Additional review required.', 8000);
assert.equal(reviewA.reviewId, reviewB.reviewId, 'review creation must be idempotent');
await assert.rejects(() => reviewService.resolve({ uid: 'candidate', token: {} }, reviewA.reviewId, 'CERTIFIED'), /reviewer privileges/i);

class FakeReviewDb {
  constructor(records) { this.records = new Map(Object.entries(records)); }
  doc(path) { return { path }; }
  async runTransaction(operation) {
    const transaction = {
      get: async ({ path }) => ({ exists: this.records.has(path), data: () => this.records.get(path) }),
      update: ({ path }, values) => this.records.set(path, { ...this.records.get(path), ...values }),
      set: ({ path }, values, options) => this.records.set(path, options?.merge ? { ...this.records.get(path), ...values } : values),
    };
    return operation(transaction);
  }
}
const reviewDb = new FakeReviewDb({
  [`certificationReviews/${reviewA.reviewId}`]: reviewA,
  'examAttempts/attempt-1': { ...attempt, state: 'FINALIZED' },
});
const auditEvents = [];
const trustedReview = new ReviewService({ db: reviewDb, issuer, audit: { record: async (...args) => auditEvents.push(args) } });
const reviewer = { uid: 'reviewer', token: { certificationReviewer: true } };
const resolvedOnce = await trustedReview.resolve(reviewer, reviewA.reviewId, 'CERTIFIED');
const resolvedTwice = await trustedReview.resolve(reviewer, reviewA.reviewId, 'CERTIFIED');
assert.equal(resolvedOnce.resolution, 'CERTIFIED');
assert.equal(resolvedTwice.resolution, 'CERTIFIED');
assert.equal([...reviewDb.records.keys()].filter((key) => key.startsWith('certificates/')).length, 1, 'review resolution must issue one certificate');
await assert.rejects(() => trustedReview.resolve(reviewer, reviewA.reviewId, 'NOT_CERTIFIED'), /different resolution/i);

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? filesUnder(join(directory, entry.name)) : [join(directory, entry.name)]))).flat();
}
const bundleFiles = (await filesUnder('dist/assets')).filter((path) => path.endsWith('.js'));
for (const path of bundleFiles) {
  const bundle = await readFile(path, 'utf8');
  assert.equal(/correctOptionId(?!s)/.test(bundle), false, `answer key leaked into ${path}`);
  assert.equal(/resolveCertificationReview|beginCertificationReview|Start Face Lost|Detector calibration/.test(bundle), false, `privileged or development control leaked into ${path}`);
}
console.log('Certification trust validation passed.');
