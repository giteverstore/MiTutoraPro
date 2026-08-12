import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { canTransitionAttempt } from '../src/certification/models/ExamAttempt.js';
import { sanitizeCandidateExam } from '../src/certification/models/CandidateExam.js';
import { ExamScoringEngine } from '../functions/src/certification/ExamScoringEngine.js';
import { IntegrityEvaluationEngine } from '../functions/src/certification/IntegrityEvaluationEngine.js';
import { CertificationEngine } from '../functions/src/certification/CertificationEngine.js';
import { candidateExam, getTrustedExamDefinition } from '../functions/src/certification/trustedExamDefinitions.js';
import { ExamPersistenceCoordinator } from '../src/exam/services/ExamPersistenceCoordinator.js';
import { SubmissionCoordinator } from '../src/exam/services/SubmissionCoordinator.js';

const definition = getTrustedExamDefinition('python-foundations-certification');
assert.equal(canTransitionAttempt('READY', 'RUNNING'), true);
for (const transition of [['RUNNING', 'READY'], ['SUBMITTED', 'RUNNING'], ['FINALIZED', 'RUNNING'], ['CANCELLED', 'RUNNING'], ['EXPIRED', 'RUNNING']]) {
  assert.equal(canTransitionAttempt(...transition), false);
}

const delivered = sanitizeCandidateExam(candidateExam(definition));
assert.equal(JSON.stringify(delivered).includes('correctOptionId'), false);
const allCorrect = Object.fromEntries(definition.questions.map((question) => [question.id, question.correctOptionId]));
const scoring = new ExamScoringEngine().evaluate(definition, allCorrect);
assert.equal(scoring.score, 100);
assert.equal(scoring.passed, true);
const cleanIntegrity = new IntegrityEvaluationEngine().evaluate([], definition.durationMs);
assert.equal(cleanIntegrity.score, 100);
assert.equal(new CertificationEngine().evaluate({ eligible: true, attemptState: 'EVALUATING', examResult: scoring, integrityResult: cleanIntegrity }).status, 'CERTIFIED');
assert.equal(new CertificationEngine().evaluate({ eligible: false, attemptState: 'EVALUATING', examResult: scoring, integrityResult: cleanIntegrity }).status, 'INCOMPLETE');

const calls = { responses: 0, events: 0, submissions: 0 };
const service = {
  async saveResponses(payload) { calls.responses += 1; return payload; },
  async saveIntegrityEvents() { calls.events += 1; return { synchronized: 1 }; },
  async heartbeat() { return {}; },
  async submit(payload) { calls.submissions += 1; return { id: payload.attemptId, state: 'FINALIZED' }; },
};
const scheduler = { setTimeout(fn) { fn(); return 1; }, clearTimeout() {}, setInterval() { return 1; }, clearInterval() {} };
const persistence = new ExamPersistenceCoordinator({ service, attemptId: 'attempt-1', sessionId: 'session-1', scheduler });
persistence.scheduleResponses({ q1: 'b' }, 'q1');
await persistence.flushResponses();
persistence.scheduleResponses({ q1: 'b' }, 'q1');
await persistence.flushResponses();
assert.equal(calls.responses, 1, 'unchanged answers must not be written twice');
const storage = new Map();
const storageAdapter = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
const submission = new SubmissionCoordinator({ service, persistence, attemptId: 'attempt-1', sessionId: 'session-1', storage: storageAdapter });
const [first, second] = await Promise.all([submission.submit(), submission.submit('TIMEOUT')]);
assert.equal(first.id, second.id);
assert.equal(calls.submissions, 1, 'submission must be exactly once per coordinator');
persistence.destroy();

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => entry.isDirectory() ? filesUnder(join(directory, entry.name)) : [join(directory, entry.name)]))).flat();
}
const experienceSource = await readFile('src/exam/pages/ExamExperience.jsx', 'utf8');
assert.equal(experienceSource.includes('sampleExam.json'), false, 'production exam experience must not import the answer-key fixture');
try {
  const bundleFiles = (await filesUnder('dist/assets')).filter((path) => path.endsWith('.js'));
  for (const path of bundleFiles) {
    const bundle = await readFile(path, 'utf8');
    assert.equal(/correctOptionId(?!s)/.test(bundle), false, `answer key leaked into ${path}`);
    assert.equal(bundle.includes('DeveloperSimulator'), false, `development simulator leaked into ${path}`);
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
console.log('Certification validation passed.');
