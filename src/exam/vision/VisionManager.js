import { BackgroundDetector, BACKGROUND_STATUS } from '../detectors/BackgroundDetector.js';
import { CameraMonitor } from '../detectors/CameraMonitor.js';
import { FaceDetector, FACE_STATUS } from '../detectors/FaceDetector.js';
import { LightingDetector, LIGHTING_STATUS } from '../detectors/LightingDetector.js';
import { CameraService } from '../services/CameraService.js';
import { CAMERA_CONNECTION, CameraStatus } from '../models/CameraStatus.js';
import { VisionResult, VISION_VERIFICATION_STATUS } from '../models/VisionResult.js';
import { EXAM_EVENT_TYPES } from '../models/ExamEvent.js';
import { DetectorManager } from './DetectorManager.js';

export const DEFAULT_VERIFICATION_DURATION_MS = 2 * 60 * 1000;
export const DEFAULT_STABILITY_DURATION_MS = 30 * 1000;

export class VisionManager {
  constructor({
    eventBus,
    fullscreenRequired = true,
    cameraService = new CameraService(),
    durationMs = DEFAULT_VERIFICATION_DURATION_MS,
    stabilityDurationMs = DEFAULT_STABILITY_DURATION_MS,
    clock = () => performance.now(),
    tickIntervalMs = 250,
    detectors,
    windowObject = window,
    documentObject = document,
  }) {
    this.eventBus = eventBus;
    this.fullscreenRequired = fullscreenRequired;
    this.cameraService = cameraService;
    this.durationMs = durationMs;
    this.stabilityDurationMs = stabilityDurationMs;
    this.clock = clock;
    this.tickIntervalMs = tickIntervalMs;
    this.window = windowObject;
    this.document = documentObject;
    this.videoElement = null;
    this.listeners = new Set();
    this.unsubscribeFromBus = null;
    this.timer = null;
    this.lastTick = null;
    this.running = false;
    this.runId = 0;
    this.overrides = new Map();
    this.detectorState = {
      camera: new CameraStatus(),
      face: FACE_STATUS.INITIALIZING,
      lighting: LIGHTING_STATUS.UNKNOWN,
      background: BACKGROUND_STATUS.UNKNOWN,
    };
    this.browser = this.readBrowserState();
    this.elapsedMs = 0;
    this.consecutiveValidMs = 0;
    this.verifiedAt = null;
    this.status = VISION_VERIFICATION_STATUS.IDLE;
    this.handlers = {
      focus: () => this.updateBrowserState(),
      blur: () => this.updateBrowserState(),
      fullscreenchange: () => this.updateBrowserState(),
      visibilitychange: () => this.updateBrowserState(),
    };

    const defaultDetectors = detectors ?? {
      camera: new CameraMonitor({ cameraService, eventBus }),
      face: new FaceDetector({ eventBus, videoProvider: () => this.videoElement }),
      lighting: new LightingDetector({ eventBus, videoProvider: () => this.videoElement }),
      background: new BackgroundDetector({ eventBus, streamProvider: () => this.cameraService.stream }),
    };
    this.detectorManager = new DetectorManager(defaultDetectors);
  }

  async start() {
    if (this.running) return this.getSnapshot();
    const runId = ++this.runId;
    this.running = true;
    this.status = VISION_VERIFICATION_STATUS.INITIALIZING;
    this.lastTick = this.clock();
    this.unsubscribeFromBus = this.eventBus.subscribe((event) => this.handleEvent(event));
    this.window.addEventListener('focus', this.handlers.focus);
    this.window.addEventListener('blur', this.handlers.blur);
    this.document.addEventListener('fullscreenchange', this.handlers.fullscreenchange);
    this.document.addEventListener('visibilitychange', this.handlers.visibilitychange);
    this.timer = globalThis.setInterval(() => this.tick(), this.tickIntervalMs);
    this.notify();
    await this.detectorManager.start();
    if (!this.running || runId !== this.runId) return this.getSnapshot();
    this.attachStream();
    this.updateStatus();
    return this.getSnapshot();
  }

  stop() {
    if (!this.running) return;
    this.runId += 1;
    if (this.timer) globalThis.clearInterval(this.timer);
    this.timer = null;
    this.detectorManager.stop();
    this.unsubscribeFromBus?.();
    this.unsubscribeFromBus = null;
    this.window.removeEventListener('focus', this.handlers.focus);
    this.window.removeEventListener('blur', this.handlers.blur);
    this.document.removeEventListener('fullscreenchange', this.handlers.fullscreenchange);
    this.document.removeEventListener('visibilitychange', this.handlers.visibilitychange);
    if (this.videoElement) this.videoElement.srcObject = null;
    this.running = false;
  }

  reset() {
    this.elapsedMs = 0;
    this.consecutiveValidMs = 0;
    this.verifiedAt = null;
    this.lastTick = this.clock();
    this.overrides.clear();
    this.detectorManager.reset();
    this.status = this.running ? VISION_VERIFICATION_STATUS.INITIALIZING : VISION_VERIFICATION_STATUS.IDLE;
    this.notify();
    if (this.running) {
      this.detectorManager.start().then(() => {
        this.attachStream();
        this.updateStatus();
      });
    }
  }

  getStatus() {
    return this.status;
  }

  destroy() {
    this.stop();
    this.detectorManager.destroy();
    this.listeners.clear();
    this.videoElement = null;
  }

  attachVideoElement(element) {
    this.videoElement = element;
    this.attachStream();
  }

  async reconnectCamera() {
    const cameraMonitor = this.detectorManager.detectors.get('camera');
    cameraMonitor.stop();
    cameraMonitor.reset();
    await cameraMonitor.start();
    this.overrides.delete('camera');
    this.attachStream();
    return this.getSnapshot();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    const state = this.getEffectiveState();
    const pauseReasons = this.getPauseReasons(state);
    return new VisionResult({
      status: this.status,
      ...state,
      browser: this.browser,
      elapsedMs: this.elapsedMs,
      remainingMs: Math.max(0, this.durationMs - this.elapsedMs),
      consecutiveValidMs: this.consecutiveValidMs,
      pauseReasons,
      verifiedAt: this.verifiedAt,
    });
  }

  handleEvent(event) {
    if (event.type !== EXAM_EVENT_TYPES.CUSTOM || event.metadata.channel !== 'vision') return;
    const { detector, status, simulated } = event.metadata;
    if (simulated) this.overrides.set(detector, status);
    else if (Object.hasOwn(this.detectorState, detector)) this.detectorState[detector] = status;
    if (detector === 'camera') this.attachStream();
    this.updateStatus();
  }

  tick() {
    if (!this.running || this.status === VISION_VERIFICATION_STATUS.VERIFIED) return;
    const now = this.clock();
    const delta = Math.max(0, now - this.lastTick);
    this.lastTick = now;
    const state = this.getEffectiveState();
    const paused = this.getPauseReasons(state).length > 0;
    if (!paused) this.elapsedMs = Math.min(this.durationMs, this.elapsedMs + delta);
    this.consecutiveValidMs = this.isEnvironmentValid(state)
      ? this.consecutiveValidMs + delta
      : 0;
    if (this.elapsedMs >= this.durationMs && this.consecutiveValidMs >= this.stabilityDurationMs) {
      this.status = VISION_VERIFICATION_STATUS.VERIFIED;
      this.verifiedAt = Date.now();
    } else {
      this.status = paused ? VISION_VERIFICATION_STATUS.PAUSED : VISION_VERIFICATION_STATUS.VERIFYING;
    }
    this.notify();
  }

  getEffectiveState() {
    return {
      camera: this.overrides.get('camera') ?? this.detectorState.camera,
      face: this.overrides.get('face') ?? this.detectorState.face,
      lighting: this.overrides.get('lighting') ?? this.detectorState.lighting,
      background: this.overrides.get('background') ?? this.detectorState.background,
    };
  }

  getPauseReasons(state) {
    const reasons = [];
    if (state.camera.connection !== CAMERA_CONNECTION.CONNECTED || !state.camera.streamActive) reasons.push('Camera disconnected');
    if (!this.browser.focused) reasons.push('Browser focus lost');
    if (this.fullscreenRequired && !this.browser.fullscreen) reasons.push('Fullscreen disabled');
    return reasons;
  }

  isEnvironmentValid(state) {
    return this.getPauseReasons(state).length === 0
      && state.face === FACE_STATUS.ONE_FACE
      && state.lighting === LIGHTING_STATUS.GOOD;
  }

  updateStatus() {
    if (!this.running || this.status === VISION_VERIFICATION_STATUS.VERIFIED) return;
    this.status = this.getPauseReasons(this.getEffectiveState()).length
      ? VISION_VERIFICATION_STATUS.PAUSED
      : VISION_VERIFICATION_STATUS.VERIFYING;
    this.notify();
  }

  updateBrowserState() {
    this.browser = this.readBrowserState();
    this.updateStatus();
  }

  readBrowserState() {
    return {
      focused: this.document.hasFocus() && !this.document.hidden,
      fullscreen: !this.fullscreenRequired || Boolean(this.document.fullscreenElement),
      compatible: typeof this.document.addEventListener === 'function',
    };
  }

  attachStream() {
    if (this.videoElement && this.cameraService.stream && this.videoElement.srcObject !== this.cameraService.stream) {
      this.videoElement.srcObject = this.cameraService.stream;
      this.videoElement.play().catch(() => undefined);
    }
  }

  notify() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
