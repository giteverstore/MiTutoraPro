import { DetectorStatus, DETECTOR_SEVERITY } from '../models/DetectorStatus.js';

export const INFERENCE_STATUS = Object.freeze({ IDLE: 'IDLE', INITIALIZING: 'INITIALIZING', RUNNING: 'RUNNING', PAUSED: 'PAUSED', ERROR: 'ERROR', DESTROYED: 'DESTROYED' });

function poseFromMatrix(matrix) {
  const values = matrix?.data ?? matrix;
  if (!values || values.length < 16) return null;
  const toDegrees = (value) => value * (180 / Math.PI);
  return Object.freeze({
    yaw: toDegrees(Math.atan2(values[8], values[10])),
    pitch: toDegrees(Math.atan2(-values[9], Math.hypot(values[8], values[10]))),
    roll: toDegrees(Math.atan2(values[1], values[5])),
  });
}

export class VisionInferenceService {
  constructor({ videoProvider, config, taskFactory, clock = () => performance.now(), scheduler = globalThis }) {
    this.id = 'vision-inference';
    this.videoProvider = videoProvider;
    this.config = config;
    this.taskFactory = taskFactory;
    this.clock = clock;
    this.scheduler = scheduler;
    this.listeners = new Set();
    this.faceLandmarker = null;
    this.objectDetector = null;
    this.timer = null;
    this.initializationPromise = null;
    this.lastVideoTime = -1;
    this.processing = false;
    this.status = INFERENCE_STATUS.IDLE;
    this.error = null;
    this.canvas = null;
    this.context = null;
    this.previousLuminance = null;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async initialize() {
    if (this.faceLandmarker) return;
    if (this.initializationPromise) return this.initializationPromise;
    this.status = INFERENCE_STATUS.INITIALIZING;
    this.initializationPromise = this.createTasks();
    try { await this.initializationPromise; }
    finally { this.initializationPromise = null; }
  }

  async createTasks() {
    try {
      if (this.taskFactory) {
        ({ faceLandmarker: this.faceLandmarker, objectDetector: this.objectDetector } = await this.taskFactory(this.config));
      } else {
        const { FaceLandmarker, FilesetResolver, ObjectDetector } = await import('@mediapipe/tasks-vision');
        const vision = await FilesetResolver.forVisionTasks(this.config.wasmPath);
        this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: this.config.faceModelPath, delegate: this.config.delegate },
          runningMode: 'VIDEO',
          numFaces: this.config.maxFaces,
          minFaceDetectionConfidence: this.config.minFaceDetectionConfidence,
          minFacePresenceConfidence: this.config.minFacePresenceConfidence,
          minTrackingConfidence: this.config.minTrackingConfidence,
          outputFacialTransformationMatrixes: true,
        });
        this.objectDetector = await ObjectDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: this.config.objectModelPath, delegate: this.config.delegate },
          runningMode: 'VIDEO', scoreThreshold: this.config.minObjectScoreThreshold,
        });
      }
      this.error = null;
    } catch (error) {
      this.error = error;
      this.status = INFERENCE_STATUS.ERROR;
      throw error;
    }
  }

  async start() {
    if (this.status === INFERENCE_STATUS.DESTROYED || this.timer) return;
    this.status = INFERENCE_STATUS.RUNNING;
    this.timer = this.scheduler.setInterval(() => this.processFrame(), this.config.intervalMs);
    try { await this.initialize(); }
    catch { /* Frame-quality analysis remains available when an optional model fails. */ }
    if (this.status !== INFERENCE_STATUS.DESTROYED) this.status = INFERENCE_STATUS.RUNNING;
  }

  processFrame() {
    const video = this.videoProvider();
    if (this.processing || !video || video.readyState < 2 || video.currentTime === this.lastVideoTime) return;
    this.processing = true;
    this.lastVideoTime = video.currentTime;
    const timestamp = this.clock();
    try {
      const face = this.faceLandmarker?.detectForVideo(video, timestamp) ?? {};
      const objects = this.objectDetector?.detectForVideo(video, timestamp) ?? {};
      const frame = this.measureFrame(video);
      const result = Object.freeze({
        timestamp: Date.now(),
        faceCount: face.faceLandmarks?.length ?? 0,
        faceLandmarks: face.faceLandmarks ?? [],
        headPose: poseFromMatrix(face.facialTransformationMatrixes?.[0]),
        detections: (objects.detections ?? []).map((detection) => Object.freeze({ ...detection, timestamp: Date.now(), frameWidth: video.videoWidth, frameHeight: video.videoHeight })),
        frame,
        inferenceFps: this.config.intervalMs > 0 ? Math.round(1000 / this.config.intervalMs) : 0,
      });
      this.listeners.forEach((listener) => listener(result));
    } catch (error) {
      this.error = error;
      this.status = INFERENCE_STATUS.ERROR;
    } finally {
      this.processing = false;
    }
  }

  measureFrame(video) {
    if (!globalThis.document) return null;
    this.canvas ??= globalThis.document.createElement('canvas');
    this.canvas.width = 64; this.canvas.height = 36;
    this.context ??= this.canvas.getContext('2d', { willReadFrequently: true });
    if (!this.context) return null;
    this.context.drawImage(video, 0, 0, 64, 36);
    const pixels = this.context.getImageData(0, 0, 64, 36).data;
    let total = 0; let squareTotal = 0;
    const luminance = new Float32Array(pixels.length / 4);
    for (let source = 0, target = 0; source < pixels.length; source += 4, target += 1) {
      const value = pixels[source] * 0.2126 + pixels[source + 1] * 0.7152 + pixels[source + 2] * 0.0722;
      luminance[target] = value; total += value; squareTotal += value * value;
    }
    const brightness = total / luminance.length;
    const contrast = Math.sqrt(Math.max(0, squareTotal / luminance.length - brightness * brightness));
    let motion = 0;
    if (this.previousLuminance) for (let index = 0; index < luminance.length; index += 1) motion += Math.abs(luminance[index] - this.previousLuminance[index]);
    motion = this.previousLuminance ? motion / luminance.length : 0;
    this.previousLuminance = luminance;
    return Object.freeze({ brightness, contrast, motion });
  }

  stop() { if (this.timer) this.scheduler.clearInterval(this.timer); this.timer = null; if (this.status !== INFERENCE_STATUS.DESTROYED) this.status = INFERENCE_STATUS.IDLE; }
  pause() { this.stop(); if (this.status !== INFERENCE_STATUS.DESTROYED) this.status = INFERENCE_STATUS.PAUSED; }
  resume() { return this.start(); }
  reset() { this.lastVideoTime = -1; this.processing = false; this.previousLuminance = null; }
  getStatus() { return new DetectorStatus({ status: this.status, message: this.error?.message ?? 'Shared vision inference pipeline.', severity: this.status === INFERENCE_STATUS.ERROR ? DETECTOR_SEVERITY.ERROR : DETECTOR_SEVERITY.INFO }); }
  destroy() { this.stop(); this.faceLandmarker?.close?.(); this.objectDetector?.close?.(); this.faceLandmarker = null; this.objectDetector = null; this.canvas = null; this.context = null; this.previousLuminance = null; this.listeners.clear(); this.status = INFERENCE_STATUS.DESTROYED; }
}
