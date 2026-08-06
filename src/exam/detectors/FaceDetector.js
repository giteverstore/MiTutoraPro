import { ExamEvent, EXAM_EVENT_TYPES, EXAM_SEVERITIES } from '../models/ExamEvent.js';
import { DetectorStatus, DETECTOR_SEVERITY } from '../models/DetectorStatus.js';

export const FACE_STATUS = Object.freeze({
  INITIALIZING: 'INITIALIZING',
  NO_FACE: 'NO_FACE',
  ONE_FACE: 'ONE_FACE',
  MULTIPLE_FACES: 'MULTIPLE_FACES',
  ERROR: 'ERROR',
});

const DEFAULT_WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const DEFAULT_MODEL_PATH = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

const faceMessages = {
  [FACE_STATUS.INITIALIZING]: ['Initializing face detection…', DETECTOR_SEVERITY.PENDING],
  [FACE_STATUS.NO_FACE]: ['No face detected. Center yourself in the camera frame.', DETECTOR_SEVERITY.ERROR],
  [FACE_STATUS.ONE_FACE]: ['One face detected and stable.', DETECTOR_SEVERITY.SUCCESS],
  [FACE_STATUS.MULTIPLE_FACES]: ['Multiple faces detected. Ensure only one person is visible.', DETECTOR_SEVERITY.ERROR],
  [FACE_STATUS.ERROR]: ['Face detection is unavailable. Reconnect the camera and retry.', DETECTOR_SEVERITY.ERROR],
};

export function createFaceStatus(status, quality = status === FACE_STATUS.ONE_FACE ? 100 : 0) {
  const [message, severity] = faceMessages[status];
  return new DetectorStatus({ status, message, severity, quality });
}

export class FaceDetector {
  constructor({ eventBus, videoProvider, wasmPath = DEFAULT_WASM_PATH, modelPath = DEFAULT_MODEL_PATH, intervalMs = 350, minDetectionConfidence = 0.5, stabilitySampleCount = 12 }) {
    this.eventBus = eventBus;
    this.videoProvider = videoProvider;
    this.wasmPath = wasmPath;
    this.modelPath = modelPath;
    this.intervalMs = intervalMs;
    this.minDetectionConfidence = minDetectionConfidence;
    this.stabilitySampleCount = stabilitySampleCount;
    this.samples = [];
    this.status = createFaceStatus(FACE_STATUS.INITIALIZING);
    this.detector = null;
    this.timer = null;
    this.lastVideoTime = -1;
    this.initializationPromise = null;
    this.active = false;
    this.destroyed = false;
  }

  async start() {
    if (this.destroyed) return;
    this.active = true;
    if (!this.detector) {
      if (!this.initializationPromise) this.initializationPromise = this.initialize();
      await this.initializationPromise;
    }
    if (!this.active || !this.detector || this.timer) return;
    this.timer = globalThis.setInterval(() => this.detectFrame(), this.intervalMs);
  }

  async initialize() {
    this.publish(FACE_STATUS.INITIALIZING);
    try {
      const { FaceDetector: MediaPipeFaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(this.wasmPath);
      this.detector = await MediaPipeFaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: this.modelPath },
        runningMode: 'VIDEO',
        minDetectionConfidence: this.minDetectionConfidence,
        minSuppressionThreshold: 0.3,
      });
      if (this.destroyed) {
        this.detector.close();
        this.detector = null;
      }
    } catch {
      if (!this.destroyed) this.publish(FACE_STATUS.ERROR);
    } finally {
      this.initializationPromise = null;
    }
  }

  detectFrame() {
    const video = this.videoProvider();
    if (!this.detector || !video || video.readyState < 2 || video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = video.currentTime;
    try {
      const result = this.detector.detectForVideo(video, performance.now());
      const count = result.detections?.length ?? 0;
      const status = count === 0 ? FACE_STATUS.NO_FACE : count === 1 ? FACE_STATUS.ONE_FACE : FACE_STATUS.MULTIPLE_FACES;
      this.samples.push(status === FACE_STATUS.ONE_FACE ? 1 : 0);
      if (this.samples.length > this.stabilitySampleCount) this.samples.shift();
      const quality = (this.samples.reduce((total, value) => total + value, 0) / this.stabilitySampleCount) * 100;
      this.publish(status, quality);
    } catch {
      this.publish(FACE_STATUS.ERROR);
    }
  }

  stop() {
    this.active = false;
    if (this.timer) globalThis.clearInterval(this.timer);
    this.timer = null;
  }

  pause() { this.stop(); }
  resume() { return this.start(); }

  reset() {
    this.stop();
    this.lastVideoTime = -1;
    this.samples = [];
    this.publish(FACE_STATUS.INITIALIZING);
  }

  getStatus() {
    return this.status;
  }

  destroy() {
    this.destroyed = true;
    this.stop();
    this.detector?.close();
    this.detector = null;
    this.initializationPromise = null;
  }

  publish(status, quality) {
    if (this.status.status === status && quality === undefined && status !== FACE_STATUS.INITIALIZING) return;
    this.status = createFaceStatus(status, quality);
    this.eventBus.emit(new ExamEvent({
      type: EXAM_EVENT_TYPES.CUSTOM,
      severity: status === FACE_STATUS.ONE_FACE ? EXAM_SEVERITIES.INFO : EXAM_SEVERITIES.LOW,
      metadata: { channel: 'vision', detector: 'face', status: this.status },
    }));
  }
}
