import assert from 'node:assert/strict';
import { CameraMonitor } from '../src/exam/detectors/CameraMonitor.js';
import { FaceDetector, FACE_STATUS } from '../src/exam/detectors/FaceDetector.js';
import { LightingDetector, LIGHTING_STATUS } from '../src/exam/detectors/LightingDetector.js';
import { createExamConfig } from '../src/exam/engine/ExamConfig.js';
import { EventBus } from '../src/exam/engine/EventBus.js';
import { IntegrityEngine } from '../src/exam/engine/IntegrityEngine.js';
import { WarningManager } from '../src/exam/engine/WarningManager.js';
import { CAMERA_CONNECTION, CAMERA_PERMISSION, CameraStatus } from '../src/exam/models/CameraStatus.js';
import { ExamEvent, EXAM_EVENT_TYPES } from '../src/exam/models/ExamEvent.js';
import { CameraService } from '../src/exam/services/CameraService.js';
import { DetectorManager } from '../src/exam/vision/DetectorManager.js';
import { VisionManager } from '../src/exam/vision/VisionManager.js';
import { VISION_VERIFICATION_STATUS } from '../src/exam/models/VisionResult.js';

class EventTargetStub {
  constructor() {
    this.listeners = new Map();
    this.hidden = false;
    this.fullscreenElement = {};
    this.focused = true;
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

  hasFocus() {
    return this.focused;
  }
}

function createTrack() {
  const target = new EventTargetStub();
  return Object.assign(target, {
    readyState: 'live',
    stop() { this.readyState = 'ended'; },
    getSettings: () => ({ width: 1280, height: 720, deviceId: 'camera-1' }),
  });
}

const firstTrack = createTrack();
const secondTrack = createTrack();
let cameraRequest = 0;
const mediaDevices = {
  async getUserMedia() {
    cameraRequest += 1;
    return { getTracks: () => [cameraRequest === 1 ? firstTrack : secondTrack], getVideoTracks: () => [cameraRequest === 1 ? firstTrack : secondTrack] };
  },
  async enumerateDevices() { return [{ kind: 'videoinput', deviceId: 'camera-1' }, { kind: 'audioinput', deviceId: 'mic-1' }]; },
};
const cameraService = new CameraService({ mediaDevices });
await cameraService.open();
assert.equal(cameraService.isActive(), true);
assert.equal((await cameraService.enumerateDevices()).length, 1);
await cameraService.reconnect();
assert.equal(cameraRequest, 2, 'Camera reconnect must request a fresh stream.');

const deniedBus = new EventBus();
const deniedError = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
const deniedMonitor = new CameraMonitor({
  eventBus: deniedBus,
  cameraService: new CameraService({ mediaDevices: { getUserMedia: async () => { throw deniedError; } } }),
});
const deniedStatus = await deniedMonitor.start();
assert.equal(deniedStatus.permission, CAMERA_PERMISSION.DENIED);

const bus = new EventBus();
const emitted = [];
bus.subscribe((event) => emitted.push(event));
const face = new FaceDetector({ eventBus: bus, videoProvider: () => ({ readyState: 2, currentTime: 1 }) });
face.detector = { detectForVideo: () => ({ detections: [{}] }), close() {} };
face.detectFrame();
assert.equal(face.getStatus(), FACE_STATUS.ONE_FACE);
face.videoProvider = () => ({ readyState: 2, currentTime: 2 });
face.detector.detectForVideo = () => ({ detections: [{}, {}] });
face.detectFrame();
assert.equal(face.getStatus(), FACE_STATUS.MULTIPLE_FACES);

const originalDocument = globalThis.document;
const pixel = (brightness) => new Uint8ClampedArray([brightness, brightness, brightness, 255]);
let currentPixels = pixel(25);
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {}, getImageData: () => ({ data: currentPixels }) }) }) };
const lighting = new LightingDetector({ eventBus: bus, videoProvider: () => ({ readyState: 2 }), intervalMs: 100000 });
lighting.start();
lighting.analyzeFrame();
assert.equal(lighting.getStatus(), LIGHTING_STATUS.TOO_DARK);
currentPixels = pixel(120);
lighting.analyzeFrame();
assert.equal(lighting.getStatus(), LIGHTING_STATUS.GOOD);
currentPixels = pixel(240);
lighting.analyzeFrame();
assert.equal(lighting.getStatus(), LIGHTING_STATUS.TOO_BRIGHT);
lighting.destroy();
globalThis.document = originalDocument;

class StubDetector {
  constructor(onStart) { this.onStart = onStart; this.status = 'IDLE'; }
  async start() { this.status = 'RUNNING'; this.onStart?.(); }
  stop() { this.status = 'STOPPED'; }
  reset() { this.status = 'IDLE'; }
  getStatus() { return this.status; }
  destroy() { this.status = 'DESTROYED'; }
}
assert.throws(() => new DetectorManager({ invalid: {} }), /must implement/);

const documentStub = new EventTargetStub();
const windowStub = new EventTargetStub();
let now = 0;
const cameraStatus = new CameraStatus({ permission: CAMERA_PERMISSION.GRANTED, connection: CAMERA_CONNECTION.CONNECTED, streamActive: true });
const emitVision = (detector, status) => bus.emit(new ExamEvent({ type: EXAM_EVENT_TYPES.CUSTOM, metadata: { channel: 'vision', detector, status } }));
const detectors = {
  camera: new StubDetector(() => emitVision('camera', cameraStatus)),
  face: new StubDetector(() => emitVision('face', FACE_STATUS.ONE_FACE)),
  lighting: new StubDetector(() => emitVision('lighting', LIGHTING_STATUS.GOOD)),
  background: new StubDetector(() => emitVision('background', 'CLEAR')),
};
const vision = new VisionManager({
  eventBus: bus,
  detectors,
  cameraService: { stream: null },
  durationMs: 1000,
  stabilityDurationMs: 300,
  tickIntervalMs: 100000,
  clock: () => now,
  windowObject: windowStub,
  documentObject: documentStub,
});
await vision.start();
now = 400;
vision.tick();
assert.equal(vision.getSnapshot().elapsedMs, 400);
documentStub.focused = false;
windowStub.dispatch('blur');
now = 700;
vision.tick();
assert.equal(vision.getSnapshot().elapsedMs, 400, 'Verification timer must pause when browser focus is lost.');
documentStub.focused = true;
windowStub.dispatch('focus');
now = 1300;
vision.tick();
assert.equal(vision.getStatus(), VISION_VERIFICATION_STATUS.VERIFIED, 'Valid consecutive environment window must complete verification.');

const config = createExamConfig();
const warningManager = new WarningManager();
const integrity = new IntegrityEngine({ eventBus: bus, warningManager, config });
integrity.start();
emitVision('face', FACE_STATUS.NO_FACE);
assert.equal(integrity.score, 100, 'Vision status must not alter integrity score.');
assert.equal(warningManager.count, 0, 'Vision status must not create exam warnings.');
assert.equal(integrity.timeline.length, 0, 'Vision status must remain outside the integrity report timeline.');

vision.destroy();
face.destroy();
deniedMonitor.destroy();
cameraService.destroy();
integrity.dispose();
bus.clear();
process.stdout.write('Vision engine validation passed: permission, reconnect, face count, lighting, detector contract, countdown, and integrity isolation.\n');
