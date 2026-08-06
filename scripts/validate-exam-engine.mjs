import assert from 'node:assert/strict';
import { BrowserMonitor } from '../src/exam/detectors/BrowserMonitor.js';
import { createExamConfig } from '../src/exam/engine/ExamConfig.js';
import { ExamSession, EXAM_SESSION_STATES } from '../src/exam/engine/ExamSession.js';
import { EventBus } from '../src/exam/engine/EventBus.js';
import { IntegrityEngine } from '../src/exam/engine/IntegrityEngine.js';
import { WarningManager } from '../src/exam/engine/WarningManager.js';
import { ExamEvent, EXAM_EVENT_TYPES, EXAM_SEVERITIES } from '../src/exam/models/ExamEvent.js';

class EventTargetStub {
  constructor() {
    this.listeners = new Map();
    this.hidden = false;
    this.fullscreenElement = {};
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type) {
    this.listeners.get(type)?.forEach((listener) => listener({ type }));
  }
}

const bus = new EventBus();
let duplicateListenerCalls = 0;
const duplicateListener = () => { duplicateListenerCalls += 1; };
bus.subscribe(duplicateListener);
bus.subscribe(duplicateListener);
bus.emit(new ExamEvent({ type: EXAM_EVENT_TYPES.CUSTOM }));
assert.equal(duplicateListenerCalls, 1, 'EventBus must prevent duplicate listeners.');
bus.unsubscribe(duplicateListener);

const config = createExamConfig();
const warningManager = new WarningManager({ maxWarnings: config.integrity.maxWarnings });
const integrity = new IntegrityEngine({ eventBus: bus, warningManager, config });
integrity.start();
bus.emit(new ExamEvent({ type: EXAM_EVENT_TYPES.TAB_SWITCH, severity: EXAM_SEVERITIES.HIGH }));
assert.equal(integrity.score, 88, 'Configured score deduction was not applied.');
assert.equal(warningManager.count, 1, 'WarningManager did not track the configured warning.');
assert.equal(integrity.createReport().timeline.length, 1, 'Integrity timeline did not retain the event.');

const windowStub = new EventTargetStub();
const documentStub = new EventTargetStub();
const monitor = new BrowserMonitor({ eventBus: bus, config, windowObject: windowStub, documentObject: documentStub });
monitor.start();
documentStub.hidden = true;
documentStub.dispatch('visibilitychange');
windowStub.dispatch('blur');
documentStub.fullscreenElement = null;
documentStub.dispatch('fullscreenchange');
documentStub.dispatch('copy');
documentStub.dispatch('paste');
documentStub.dispatch('contextmenu');
monitor.stop();
assert.equal(integrity.timeline.length, 7, 'BrowserMonitor did not emit every required violation event.');

const session = new ExamSession({ examId: 'exam', candidateId: 'candidate', duration: 60000 });
session.transition(EXAM_SESSION_STATES.ENVIRONMENT_CHECK);
session.transition(EXAM_SESSION_STATES.READY);
session.transition(EXAM_SESSION_STATES.RUNNING, 1000);
session.transition(EXAM_SESSION_STATES.COMPLETED, 2000);
assert.equal(session.startTime, 1000);
assert.equal(session.endTime, 2000);
assert.throws(() => session.transition(EXAM_SESSION_STATES.RUNNING), /Invalid exam session transition/);

const simulatorSource = await import('node:fs/promises').then(({ readFile }) =>
  readFile(new URL('../src/exam/components/DeveloperSimulator/DeveloperSimulator.jsx', import.meta.url), 'utf8'));
assert.match(simulatorSource, /import\.meta\.env\.DEV/, 'Developer simulator must have a production guard.');

integrity.dispose();
bus.clear();
process.stdout.write('Exam engine validation passed: event bus, monitor, integrity, warnings, timeline, session.\n');
