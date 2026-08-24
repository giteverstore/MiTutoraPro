import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import { AttemptService, applyTelemetryCompleteness, telemetryIsComplete } from '../functions/src/certification/AttemptService.js';
import { IntegrityEvaluationEngine } from '../functions/src/certification/IntegrityEvaluationEngine.js';

class AtomicFakeDb {
  constructor(records = {}) { this.records = new Map(Object.entries(records)); this.failAuditWrites = false; }
  doc(path) { return { path, get: async () => this.snapshot(this.records, path) }; }
  snapshot(records, path) { return { exists: records.has(path), data: () => records.get(path) }; }
  async runTransaction(operation) {
    const staged = new Map([...this.records].map(([key, value]) => [key, value && typeof value === 'object' ? { ...value } : value]));
    const transaction = {
      get: async ({ path }) => this.snapshot(staged, path),
      update: ({ path }, values) => staged.set(path, { ...staged.get(path), ...values }),
      set: ({ path }, values, options) => {
        if (this.failAuditWrites && path.includes('/auditEvents/')) throw new Error('simulated audit failure');
        staged.set(path, options?.merge ? { ...staged.get(path), ...values } : values);
      },
      create: ({ path }, values) => { if (this.failAuditWrites && path.includes('/auditEvents/')) throw new Error('simulated audit failure'); if (staged.has(path)) throw Object.assign(new Error('exists'), { code: 6 }); staged.set(path, values); },
    };
    const result = await operation(transaction); this.records = staged; return result;
  }
}

const attemptPath = 'examAttempts/attempt-1';
const baseAttempt = { id: 'attempt-1', ownerUid: 'candidate-1', courseId: 'python', examId: 'python-certification', state: 'CREATED', schemaVersion: '1.0.0' };
const db = new AtomicFakeDb({ [attemptPath]: baseAttempt });
const service = new AttemptService({ db, bucket: {} });

db.failAuditWrites = true;
await assert.rejects(service.beginVerification('candidate-1', 'attempt-1'), /simulated audit failure/);
assert.equal(db.records.get(attemptPath).state, 'CREATED', 'Authoritative state must roll back when required audit persistence fails.');
assert.equal([...db.records.keys()].some((path) => path.includes('/auditEvents/')), false);
db.failAuditWrites = false;

const verifying = await service.beginVerification('candidate-1', 'attempt-1');
assert.equal(verifying.state, 'VERIFYING');
assert.ok(db.records.has(`${attemptPath}/auditEvents/verification-started-${verifying.verificationSessionId}`));
const summary = { ready: true, readinessScore: 100, checks: {} };
const steps = ['camera', 'lighting', 'face', 'background', 'browser', 'fullscreen', 'internet', 'audio'].map((checkId) => ({ checkId, status: 'COMPLETED' }));
await assert.rejects(service.completeVerification('candidate-1', 'attempt-1', { summary: { ready: true } }), (error) => error.code === 'failed-precondition');
await assert.rejects(service.completeVerification('other-user', 'attempt-1', { sessionId: verifying.verificationSessionId, challenge: verifying.verificationChallenge, summary, steps }), (error) => error.code === 'permission-denied');
db.records.set(attemptPath, { ...db.records.get(attemptPath), verificationExpiresAt: Timestamp.fromMillis(Date.now() - 1) });
await assert.rejects(service.completeVerification('candidate-1', 'attempt-1', { sessionId: verifying.verificationSessionId, challenge: verifying.verificationChallenge, summary, steps }), (error) => error.code === 'deadline-exceeded');
db.records.set(attemptPath, { ...db.records.get(attemptPath), verificationExpiresAt: Timestamp.fromMillis(Date.now() + 60_000) });
const ready = await service.completeVerification('candidate-1', 'attempt-1', { sessionId: verifying.verificationSessionId, challenge: verifying.verificationChallenge, summary, steps });
assert.equal(ready.state, 'READY');
const reused = await service.completeVerification('candidate-1', 'attempt-1', { sessionId: verifying.verificationSessionId, challenge: verifying.verificationChallenge, summary, steps });
assert.equal(reused.state, 'READY', 'Identical verification retry must be idempotent.');
await assert.rejects(service.completeVerification('candidate-1', 'attempt-1', { sessionId: 'conflict', challenge: 'conflict', summary, steps }), (error) => error.code === 'failed-precondition');

db.records.set(attemptPath, { ...db.records.get(attemptPath), state: 'RUNNING', sessionId: 'session-1', integrityEventSequence: 0, telemetryGapDetected: false, heartbeatSequence: 1 });
const event = { id: 'event-1', type: 'WINDOW_BLUR', status: 'RECOVERED', startedAt: Date.now(), endedAt: Date.now() + 10, durationMs: 10 };
const first = await service.saveIntegrityEvents('candidate-1', 'attempt-1', 'session-1', { events: [event], startSequence: 1, endSequence: 1 });
assert.equal(first.lastSequence, 1);
const duplicate = await service.saveIntegrityEvents('candidate-1', 'attempt-1', 'session-1', { events: [event], startSequence: 1, endSequence: 1 });
assert.equal(duplicate.idempotent, true);
await assert.rejects(service.saveIntegrityEvents('candidate-1', 'attempt-1', 'wrong-session', { events: [event], startSequence: 2, endSequence: 2 }), (error) => error.code === 'permission-denied');
const gap = await service.saveIntegrityEvents('candidate-1', 'attempt-1', 'session-1', { events: [{ ...event, id: 'event-3' }], startSequence: 3, endSequence: 3 });
assert.equal(gap.gapDetected, true);
assert.equal(db.records.get(attemptPath).telemetryGapDetected, true, 'Detected sequence gaps must remain authoritative state.');
db.records.set(attemptPath, { ...db.records.get(attemptPath), state: 'FINALIZED' });
await assert.rejects(service.saveIntegrityEvents('candidate-1', 'attempt-1', 'session-1', { events: [{ ...event, id: 'late' }], startSequence: 4, endSequence: 4 }), (error) => error.code === 'failed-precondition');

assert.equal(telemetryIsComplete({ integrityEventSequence: 1, heartbeatSequence: 1, telemetryGapDetected: false }, 1), true);
assert.equal(telemetryIsComplete({ integrityEventSequence: 1, heartbeatSequence: 1, telemetryGapDetected: true }, 1), false);
const incomplete = applyTelemetryCompleteness(new IntegrityEvaluationEngine().evaluate([], 1000), { telemetryComplete: false, integrityEventSequence: 1, telemetryFinalSequence: 0 });
assert.ok(incomplete.flags.includes('TELEMETRY_INCOMPLETE'));

console.log('Certification evidence validation passed: atomic audit, verification challenge, event sequence, replay, gap, stale-state, and incomplete telemetry.');
