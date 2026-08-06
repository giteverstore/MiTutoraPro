import assert from 'node:assert/strict';
import { createFaceStatus, FACE_STATUS } from '../src/exam/detectors/FaceDetector.js';
import { DetectorManager } from '../src/exam/engine/DetectorManager.js';
import { EventBus } from '../src/exam/engine/EventBus.js';
import { EventLifecycleManager } from '../src/exam/engine/EventLifecycleManager.js';
import { createExamConfig } from '../src/exam/engine/ExamConfig.js';
import { IntegrityEngine } from '../src/exam/engine/IntegrityEngine.js';
import { WarningManager } from '../src/exam/engine/WarningManager.js';
import { ExamEvent, EXAM_EVENT_TYPES } from '../src/exam/models/ExamEvent.js';
import { INTEGRITY_EVENT_STATUS } from '../src/exam/models/IntegrityEvent.js';
import { MonitoringSession, MONITORING_STATUS } from '../src/exam/monitoring/MonitoringSession.js';

class LifecycleDetector {
  constructor() {
    this.status = 'IDLE';
    this.calls = { start: 0, stop: 0, pause: 0, resume: 0, reset: 0, destroy: 0 };
  }

  async start() { this.calls.start += 1; this.status = 'RUNNING'; }
  stop() { this.calls.stop += 1; this.status = 'STOPPED'; }
  pause() { this.calls.pause += 1; this.status = 'PAUSED'; }
  resume() { this.calls.resume += 1; this.status = 'RUNNING'; }
  reset() { this.calls.reset += 1; this.status = 'IDLE'; }
  destroy() { this.calls.destroy += 1; this.status = 'DESTROYED'; }
  getStatus() { return { status: this.status }; }
}

const detector = new LifecycleDetector();
const detectorManager = new DetectorManager({ primary: detector });
await detectorManager.start();
detectorManager.pause();
detectorManager.resume();
detectorManager.reset();
detectorManager.stop();
assert.deepEqual(detector.calls, { start: 1, stop: 1, pause: 1, resume: 1, reset: 1, destroy: 0 });
assert.equal(detectorManager.unregister('primary'), true);
assert.equal(detector.calls.destroy, 1);
assert.throws(() => new DetectorManager({ invalid: { start() {} } }), /must implement/);

let now = 1000;
const lifecycle = new EventLifecycleManager({ clock: () => now, updateIntervalMs: 100000 });
const first = lifecycle.startViolation('FACE_LOST');
const duplicate = lifecycle.startViolation('FACE_LOST');
assert.equal(first.id, duplicate.id, 'A repeated active violation must reuse its existing event.');
assert.equal(lifecycle.getSnapshot().events.length, 1);
now = 7000;
lifecycle.updateDurations();
assert.equal(lifecycle.getSnapshot().activeViolations[0].duration, 6000);
const recovered = lifecycle.recoverViolation('FACE_LOST');
assert.equal(recovered.id, first.id, 'Recovery must close the original event ID.');
assert.equal(recovered.status, INTEGRITY_EVENT_STATUS.RECOVERED);
assert.equal(recovered.duration, 6000);
lifecycle.destroy();

now = 0;
const bus = new EventBus();
const config = createExamConfig({ monitoring: { lifecycleUpdateIntervalMs: 100000 } });
const warningManager = new WarningManager({ maxWarnings: config.integrity.maxWarnings });
const integrity = new IntegrityEngine({ eventBus: bus, warningManager, config });
integrity.start();
integrity.setLifecycleMode(true);
const monitoringDetector = new LifecycleDetector();
const monitoring = new MonitoringSession({
  eventBus: bus,
  detectors: { detector: monitoringDetector },
  config,
  clock: () => now,
  onLifecycleEvent: (event, change) => integrity.processLifecycleEvent(event, change),
});
const snapshots = [];
monitoring.subscribe((snapshot) => snapshots.push(snapshot));
await monitoring.start();
assert.equal(monitoring.getSnapshot().status, MONITORING_STATUS.RUNNING);
assert.equal(monitoringDetector.calls.start, 1);

const faceLost = createFaceStatus(FACE_STATUS.NO_FACE);
bus.emit(new ExamEvent({ type: EXAM_EVENT_TYPES.CUSTOM, metadata: { channel: 'vision', detector: 'face', status: faceLost } }));
bus.emit(new ExamEvent({ type: EXAM_EVENT_TYPES.CUSTOM, metadata: { channel: 'vision', detector: 'face', status: faceLost } }));
assert.equal(monitoring.getSnapshot().activeViolations.length, 1, 'Continuous status updates must not duplicate active events.');
assert.equal(monitoring.getSnapshot().eventCount, 1);

now = 36000;
monitoring.lifecycle.updateDurations();
assert.equal(integrity.score, 70, 'All configured escalation deductions should apply exactly once.');
assert.equal(warningManager.count, 4, 'Each configured warning escalation should be recorded once.');
const scoreAfterEscalation = integrity.score;
monitoring.lifecycle.updateDurations();
assert.equal(integrity.score, scoreAfterEscalation, 'Repeated duration updates must not duplicate penalties.');

bus.emit(new ExamEvent({ type: EXAM_EVENT_TYPES.CUSTOM, metadata: { channel: 'vision', detector: 'face', status: createFaceStatus(FACE_STATUS.ONE_FACE) } }));
const recoveredFace = monitoring.getSnapshot().timeline[0];
assert.equal(recoveredFace.status, INTEGRITY_EVENT_STATUS.RECOVERED);
assert.equal(recoveredFace.id, monitoring.lifecycle.getSnapshot().events[0].id);
assert.equal(recoveredFace.duration, 36000);

monitoring.stop();
assert.equal(monitoring.getSnapshot().status, MONITORING_STATUS.STOPPED);
assert.equal(monitoringDetector.calls.stop, 1);
assert.ok(snapshots.length > 0, 'Monitoring timeline should publish live snapshots.');
monitoring.destroy();
integrity.dispose();
bus.clear();

process.stdout.write('Monitoring engine validation passed: detector lifecycle, automatic session lifecycle, deduplication, duration, recovery, timeline, escalation, and cleanup.\n');
