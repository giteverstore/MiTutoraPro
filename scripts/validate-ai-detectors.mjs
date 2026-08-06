import assert from 'node:assert/strict';
import { detectorConfig } from '../src/exam/config/detectorConfig.js';
import { EventBus } from '../src/exam/engine/EventBus.js';
import { FacePresenceDetector } from '../src/exam/detectors/FacePresenceDetector.js';
import { FACE_STATUS } from '../src/exam/detectors/FaceDetector.js';
import { HeadPoseDetector, HEAD_POSE_STATUS } from '../src/exam/detectors/HeadPoseDetector.js';
import { LookingAwayDetector, LOOKING_AWAY_STATUS } from '../src/exam/detectors/LookingAwayDetector.js';
import { PhoneDetector, PHONE_STATUS } from '../src/exam/detectors/PhoneDetector.js';
import { DetectorEvidence } from '../src/exam/models/DetectorEvidence.js';
import { VisionInferenceService } from '../src/exam/services/VisionInferenceService.js';

class FakeInference {
  constructor() { this.listeners = new Set(); }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  emit(result) { this.listeners.forEach((listener) => listener({ timestamp: Date.now(), faceCount: 1, detections: [], headPose: { yaw: 0, pitch: 0, roll: 0 }, ...result })); }
}

let now = 0;
const bus = new EventBus();
const inference = new FakeInference();
const headPose = new HeadPoseDetector({ eventBus: bus, inferenceService: inference, config: detectorConfig.headPose });
const face = new FacePresenceDetector({ eventBus: bus, inferenceService: inference, config: { ...detectorConfig.facePresence, violationPersistenceMs: 100 }, clock: () => now });
const looking = new LookingAwayDetector({ eventBus: bus, inferenceService: inference, headPoseDetector: headPose, config: { ...detectorConfig.lookingAway, gracePeriodMs: 100 }, clock: () => now });
const phone = new PhoneDetector({ eventBus: bus, inferenceService: inference, config: { ...detectorConfig.phone, minimumPersistence: 100, minimumVisibleArea: 0 }, clock: () => now });
[face, headPose, looking, phone].forEach((detector) => detector.start());

inference.emit({ faceCount: 1 });
assert.equal(face.getStatus().status, FACE_STATUS.ONE_FACE);
assert.equal(headPose.getStatus().status, HEAD_POSE_STATUS.CENTERED);

inference.emit({ faceCount: 0, headPose: { yaw: 35, pitch: 0, roll: 0 } });
now = 150;
inference.emit({ faceCount: 0, headPose: { yaw: 35, pitch: 0, roll: 0 } });
assert.equal(face.getStatus().status, FACE_STATUS.NO_FACE, 'Persistent face loss should become a violation.');
assert.equal(headPose.getStatus().status, HEAD_POSE_STATUS.RIGHT);
assert.equal(looking.getStatus().status, LOOKING_AWAY_STATUS.LOOKING_AWAY, 'Looking-away grace period should suppress transient pose changes.');

const phoneDetection = { categories: [{ categoryName: 'cell phone', score: 0.9 }], boundingBox: { originX: 1, originY: 2, width: 30, height: 40 }, frameWidth: 640, frameHeight: 480 };
inference.emit({ detections: [phoneDetection] });
now = 300;
inference.emit({ detections: [phoneDetection] });
assert.equal(phone.getStatus().status, PHONE_STATUS.PHONE_DETECTED);
assert.ok(phone.getStatus().details.evidence instanceof DetectorEvidence);
assert.ok(Math.abs(phone.getStatus().details.evidence.confidence - 0.9) < Number.EPSILON * 2);

let faceCalls = 0; let objectCalls = 0; let scheduled;
const video = { readyState: 4, currentTime: 1 };
const service = new VisionInferenceService({
  videoProvider: () => video,
  config: { ...detectorConfig.inference, intervalMs: 100 },
  taskFactory: async () => ({
    faceLandmarker: { detectForVideo: () => { faceCalls += 1; return { faceLandmarks: [[]], facialTransformationMatrixes: [] }; }, close() {} },
    objectDetector: { detectForVideo: () => { objectCalls += 1; return { detections: [] }; }, close() {} },
  }),
  scheduler: { setInterval: (callback) => { scheduled = callback; return 1; }, clearInterval() {} },
  clock: () => 1,
});
let subscriberCalls = 0;
service.subscribe(() => { subscriberCalls += 1; });
service.subscribe(() => { subscriberCalls += 1; });
await service.start();
scheduled();
assert.equal(faceCalls, 1, 'A frame must run face inference only once for all subscribers.');
assert.equal(objectCalls, 1, 'A frame must run object inference only once for all subscribers.');
assert.equal(subscriberCalls, 2);
service.destroy();
[face, headPose, looking, phone].forEach((detector) => detector.destroy());
bus.clear();

process.stdout.write('AI detector validation passed: shared inference, face persistence, head pose, looking-away grace, phone confidence, and evidence.\n');
