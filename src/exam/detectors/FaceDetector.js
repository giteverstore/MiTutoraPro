import { ExamEvent, EXAM_EVENT_TYPES, EXAM_SEVERITIES } from '../models/ExamEvent.js';

export const FACE_STATUS = Object.freeze({
  INITIALIZING: 'INITIALIZING',
  NO_FACE: 'NO_FACE',
  ONE_FACE: 'ONE_FACE',
  MULTIPLE_FACES: 'MULTIPLE_FACES',
  ERROR: 'ERROR',
});

const DEFAULT_WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const DEFAULT_MODEL_PATH = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

export class FaceDetector {
  constructor({ eventBus, videoProvider, wasmPath = DEFAULT_WASM_PATH, modelPath = DEFAULT_MODEL_PATH, intervalMs = 350 }) {
    this.eventBus = eventBus;
    this.videoProvider = videoProvider;
    this.wasmPath = wasmPath;
    this.modelPath = modelPath;
    this.intervalMs = intervalMs;
    this.status = FACE_STATUS.INITIALIZING;
    this.detector = null;
    this.timer = null;
    this.lastVideoTime = -1;
    this.initializationPromise = null;
  }

  async start() {
    if (!this.detector) {
      if (!this.initializationPromise) this.initializationPromise = this.initialize();
      await this.initializationPromise;
    }
    if (!this.detector || this.timer) return;
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
        minDetectionConfidence: 0.5,
        minSuppressionThreshold: 0.3,
      });
    } catch {
      this.publish(FACE_STATUS.ERROR);
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
      this.publish(count === 0 ? FACE_STATUS.NO_FACE : count === 1 ? FACE_STATUS.ONE_FACE : FACE_STATUS.MULTIPLE_FACES);
    } catch {
      this.publish(FACE_STATUS.ERROR);
    }
  }

  stop() {
    if (this.timer) globalThis.clearInterval(this.timer);
    this.timer = null;
  }

  reset() {
    this.stop();
    this.lastVideoTime = -1;
    this.publish(FACE_STATUS.INITIALIZING);
  }

  getStatus() {
    return this.status;
  }

  destroy() {
    this.stop();
    this.detector?.close();
    this.detector = null;
    this.initializationPromise = null;
  }

  publish(status) {
    if (this.status === status && status !== FACE_STATUS.INITIALIZING) return;
    this.status = status;
    this.eventBus.emit(new ExamEvent({
      type: EXAM_EVENT_TYPES.CUSTOM,
      severity: status === FACE_STATUS.ONE_FACE ? EXAM_SEVERITIES.INFO : EXAM_SEVERITIES.LOW,
      metadata: { channel: 'vision', detector: 'face', status },
    }));
  }
}
