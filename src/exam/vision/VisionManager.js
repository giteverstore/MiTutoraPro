import { BackgroundDetector, createBackgroundStatus, BACKGROUND_STATUS } from '../detectors/BackgroundDetector.js';
import { CameraMonitor } from '../detectors/CameraMonitor.js';
import { createFaceStatus, FACE_STATUS } from '../detectors/FaceDetector.js';
import { FacePresenceDetector } from '../detectors/FacePresenceDetector.js';
import { HeadPoseDetector } from '../detectors/HeadPoseDetector.js';
import { LookingAwayDetector } from '../detectors/LookingAwayDetector.js';
import { PhoneDetector } from '../detectors/PhoneDetector.js';
import { LightingDetector, createLightingStatus, LIGHTING_STATUS } from '../detectors/LightingDetector.js';
import { CameraService } from '../services/CameraService.js';
import { CAMERA_CONNECTION, CameraStatus } from '../models/CameraStatus.js';
import { VisionResult, VISION_VERIFICATION_STATUS } from '../models/VisionResult.js';
import { EXAM_EVENT_TYPES } from '../models/ExamEvent.js';
import { DetectorStatus, DETECTOR_SEVERITY } from '../models/DetectorStatus.js';
import { createExamConfig } from '../engine/ExamConfig.js';
import { DetectorManager } from './DetectorManager.js';
import { VisionInferenceService } from '../services/VisionInferenceService.js';
import { AudioService } from '../services/AudioService.js';
import { VadInferenceService } from '../services/VadInferenceService.js';
import { AudioDetector, createAudioStatus, AUDIO_STATUS } from '../detectors/AudioDetector.js';
import { ExamObjectDetector } from '../detectors/ExamObjectDetector.js';

export const DEFAULT_VERIFICATION_DURATION_MS = 2 * 60 * 1000;
export const DEFAULT_STABILITY_DURATION_MS = 30 * 1000;

export class VisionManager {
  constructor({
    eventBus,
    config: configOverrides,
    fullscreenRequired = true,
    cameraService,
    durationMs,
    stabilityDurationMs,
    clock = () => performance.now(),
    tickIntervalMs,
    detectors,
    windowObject = window,
    documentObject = document,
  }) {
    this.config = createExamConfig(configOverrides);
    const visionConfig = this.config.vision;
    this.eventBus = eventBus;
    this.fullscreenRequired = configOverrides?.browser?.fullscreenRequired ?? fullscreenRequired;
    this.cameraService = cameraService ?? new CameraService({
      defaultVideoConstraints: {
        width: { ideal: visionConfig.detectors.camera.width },
        height: { ideal: visionConfig.detectors.camera.height },
      },
    });
    this.durationMs = durationMs ?? visionConfig.verificationDurationMs;
    this.stabilityDurationMs = stabilityDurationMs ?? visionConfig.stabilityDurationMs;
    this.clock = clock;
    this.tickIntervalMs = tickIntervalMs ?? visionConfig.tickIntervalMs;
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
      face: createFaceStatus(FACE_STATUS.INITIALIZING),
      lighting: createLightingStatus(LIGHTING_STATUS.UNKNOWN),
      background: createBackgroundStatus(BACKGROUND_STATUS.UNKNOWN),
      audio: createAudioStatus(AUDIO_STATUS.INITIALIZING),
    };
    this.browser = this.readBrowserState();
    this.elapsedMs = 0;
    this.consecutiveValidMs = 0;
    this.verifiedAt = null;
    this.summary = null;
    this.cameraStableMs = 0;
    this.recoveryStartedAt = null;
    this.recoveryTimer = null;
    this.recoveringCamera = false;
    this.status = VISION_VERIFICATION_STATUS.IDLE;
    this.handlers = {
      focus: () => this.updateBrowserState(),
      blur: () => this.updateBrowserState(),
      fullscreenchange: () => this.updateBrowserState(),
      visibilitychange: () => this.updateBrowserState(),
      online: () => this.updateBrowserState(),
      offline: () => this.updateBrowserState(),
    };

    const inferenceService = new VisionInferenceService({
      videoProvider: () => this.videoElement,
      config: visionConfig.detectors.inference,
    });
    const headPoseDetector = new HeadPoseDetector({ eventBus, inferenceService, config: visionConfig.detectors.headPose });
    const audioService = new AudioService({});
    const vadService = new VadInferenceService({ audioService, config: visionConfig.detectors.audio });
    const defaultDetectors = detectors ?? {
      camera: new CameraMonitor({ cameraService: this.cameraService, eventBus }),
      inference: inferenceService,
      face: new FacePresenceDetector({ eventBus, inferenceService, config: visionConfig.detectors.facePresence }),
      headPose: headPoseDetector,
      lookingAway: new LookingAwayDetector({ eventBus, inferenceService, headPoseDetector, config: visionConfig.detectors.lookingAway }),
      phone: new PhoneDetector({ eventBus, inferenceService, config: visionConfig.detectors.phone }),
      objects: new ExamObjectDetector({ eventBus, inferenceService, config: visionConfig.detectors.objects }),
      lighting: new LightingDetector({
        eventBus,
        inferenceService,
        config: visionConfig.detectors.lighting,
      }),
      background: new BackgroundDetector({ eventBus, inferenceService, config: visionConfig.detectors.background }),
      audio: new AudioDetector({ eventBus, audioService, vadService, config: visionConfig.detectors.audio }),
    };
    this.enabledDetectorIds = new Set(Object.keys(defaultDetectors));
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
    this.window.addEventListener('online', this.handlers.online);
    this.window.addEventListener('offline', this.handlers.offline);
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
    this.window.removeEventListener('online', this.handlers.online);
    this.window.removeEventListener('offline', this.handlers.offline);
    if (this.recoveryTimer) globalThis.clearTimeout(this.recoveryTimer);
    this.recoveryTimer = null;
    if (this.videoElement) this.videoElement.srcObject = null;
    this.running = false;
  }

  pause() {
    if (!this.running) return;
    if (this.timer) globalThis.clearInterval(this.timer);
    this.timer = null;
    this.detectorManager.pause();
  }

  resume() {
    if (!this.running || this.timer) return;
    this.lastTick = this.clock();
    this.detectorManager.resume();
    this.timer = globalThis.setInterval(() => this.tick(), this.tickIntervalMs);
  }

  reset() {
    this.elapsedMs = 0;
    this.consecutiveValidMs = 0;
    this.verifiedAt = null;
    this.summary = null;
    this.cameraStableMs = 0;
    this.recoveryStartedAt = null;
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
    this.recoveringCamera = true;
    cameraMonitor.stop();
    cameraMonitor.reset();
    await cameraMonitor.start();
    this.recoveringCamera = false;
    this.overrides.delete('camera');
    this.attachStream();
    this.manageCameraRecovery(this.detectorState.camera);
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
      readinessScore: this.calculateReadinessScore(state),
      quality: {
        camera: state.camera.quality,
        face: state.face.quality,
        lighting: state.lighting.quality,
        background: state.background.quality,
        audio: state.audio.quality,
      },
      summary: this.summary,
      health: this.getHealthStatuses(state),
      minimumReadinessScore: this.config.vision.readiness.minimumScore,
      detectors: this.detectorManager.getStatus(),
    });
  }

  handleEvent(event) {
    if (event.type !== EXAM_EVENT_TYPES.CUSTOM) return;
    if (event.metadata.action === 'DEVELOPER_RESET') {
      this.reset();
      return;
    }
    if (event.metadata.action === 'AUDIO_CALIBRATION' && import.meta.env.DEV) {
      this.detectorManager.detectors.get('audio')?.updateCalibration(event.metadata.values ?? {});
      return;
    }
    if (event.metadata.channel !== 'vision') return;
    const { detector, status, simulated } = event.metadata;
    if (simulated) {
      const currentOverride = this.overrides.get(detector);
      if (currentOverride?.status === status.status) this.overrides.delete(detector);
      else this.overrides.set(detector, status);
    }
    else if (Object.hasOwn(this.detectorState, detector)) this.detectorState[detector] = status;
    if (detector === 'camera') this.attachStream();
    if (detector === 'camera') this.manageCameraRecovery(status);
    this.updateStatus();
  }

  tick() {
    if (!this.running || this.status === VISION_VERIFICATION_STATUS.VERIFIED) return;
    const now = this.clock();
    const delta = Math.max(0, now - this.lastTick);
    this.lastTick = now;
    const state = this.getEffectiveState();
    const paused = this.getPauseReasons(state).length > 0;
    this.cameraStableMs = state.camera.status === CAMERA_CONNECTION.CONNECTED && state.camera.streamActive
      ? this.cameraStableMs + delta
      : 0;
    if (!paused) this.elapsedMs = Math.min(this.durationMs, this.elapsedMs + delta);
    this.consecutiveValidMs = this.isEnvironmentValid(state)
      ? this.consecutiveValidMs + delta
      : 0;
    if (this.elapsedMs >= this.durationMs && this.consecutiveValidMs >= this.stabilityDurationMs) {
      this.status = VISION_VERIFICATION_STATUS.VERIFIED;
      this.verifiedAt = Date.now();
      this.summary = this.createSummary(state, true);
    } else {
      this.status = paused ? VISION_VERIFICATION_STATUS.PAUSED : VISION_VERIFICATION_STATUS.VERIFYING;
    }
    this.notify();
  }

  getEffectiveState() {
    const camera = this.overrides.get('camera') ?? this.detectorState.camera;
    const cameraQuality = camera.status === CAMERA_CONNECTION.CONNECTED && camera.streamActive
      ? Math.min(100, (this.cameraStableMs / this.config.vision.stabilityDurationMs) * 100)
      : 0;
    return {
      camera: new CameraStatus({ ...camera, quality: cameraQuality, lastUpdated: camera.lastUpdated }),
      face: this.overrides.get('face') ?? this.detectorState.face,
      lighting: this.overrides.get('lighting') ?? this.detectorState.lighting,
      background: this.overrides.get('background') ?? this.detectorState.background,
      audio: this.overrides.get('audio') ?? this.detectorState.audio,
    };
  }

  getPauseReasons(state) {
    const reasons = [];
    if (state.camera.status !== CAMERA_CONNECTION.CONNECTED || !state.camera.streamActive) reasons.push('Camera disconnected — reconnect the camera to continue.');
    if (!this.browser.focused) reasons.push('Focus lost — return to the exam window.');
    if (this.fullscreenRequired && !this.browser.fullscreen) reasons.push('Fullscreen disabled — restore fullscreen to continue.');
    return reasons;
  }

  isEnvironmentValid(state) {
    const statuses = this.getContributorStatuses(state);
    return this.getPauseReasons(state).length === 0
      && this.calculateReadinessScore(state) >= this.config.vision.readiness.minimumScore
      && Object.entries(this.config.vision.readiness.requiredStatuses)
        .filter(([id]) => id !== 'audio' || this.enabledDetectorIds.has('audio'))
        .every(([id, accepted]) => accepted.includes(statuses[id]));
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
      online: this.window.navigator?.onLine !== false,
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

  getContributorStatuses(state) {
    return {
      camera: state.camera.status,
      face: state.face.status,
      lighting: state.lighting.status,
      background: state.background.status,
      audio: state.audio.details?.audioHealth ?? 'INITIALIZING',
      browser: this.browser.focused ? 'FOCUSED' : 'UNFOCUSED',
      fullscreen: this.browser.fullscreen ? 'ENABLED' : 'DISABLED',
      internet: this.browser.online ? 'ONLINE' : 'OFFLINE',
    };
  }

  calculateReadinessScore(state = this.getEffectiveState()) {
    const statuses = this.getContributorStatuses(state);
    const contributors = Object.fromEntries(Object.entries(this.config.vision.readiness.contributors)
      .filter(([id]) => id !== 'audio' || this.enabledDetectorIds.has('audio')));
    const totalWeight = Object.values(contributors).reduce((total, contributor) => total + contributor.weight, 0);
    const earned = Object.entries(contributors).reduce((total, [id, contributor]) => {
      const status = statuses[id];
      if (contributor.passingStatuses.includes(status)) return total + contributor.weight;
      if (contributor.warningStatuses?.includes(status)) {
        return total + contributor.weight * (contributor.warningFactor ?? 0);
      }
      return total;
    }, 0);
    return totalWeight ? Math.round((earned / totalWeight) * 100) : 0;
  }

  getHealthStatuses(state = this.getEffectiveState()) {
    const virtual = (status, message, ready, warning = false) => new DetectorStatus({
      status,
      message,
      severity: ready ? DETECTOR_SEVERITY.SUCCESS : warning ? DETECTOR_SEVERITY.WARNING : DETECTOR_SEVERITY.ERROR,
      quality: ready ? 100 : 0,
    });
    return {
      camera: state.camera,
      lighting: state.lighting,
      face: state.face,
      background: state.background,
      browser: virtual(this.browser.focused ? 'FOCUSED' : 'UNFOCUSED', this.browser.focused ? 'Browser window is focused.' : 'Return to the exam window to continue.', this.browser.focused),
      fullscreen: virtual(this.browser.fullscreen ? 'ENABLED' : 'DISABLED', this.browser.fullscreen ? 'Fullscreen mode is enabled.' : 'Return to fullscreen to continue.', this.browser.fullscreen),
      internet: virtual(this.browser.online ? 'ONLINE' : 'OFFLINE', this.browser.online ? 'Internet connection is available.' : 'Check your internet connection.', this.browser.online),
      audio: state.audio,
    };
  }

  createReport() {
    return this.createSummary(this.getEffectiveState(), this.status === VISION_VERIFICATION_STATUS.VERIFIED);
  }

  createSummary(state = this.getEffectiveState(), ready = false) {
    const checks = this.getHealthStatuses(state);
    const recommendations = Object.values(checks)
      .filter(({ severity }) => severity !== DETECTOR_SEVERITY.SUCCESS)
      .map(({ message }) => message);
    if (!ready && recommendations.length === 0) {
      recommendations.push(`Maintain the required conditions for ${Math.round(this.stabilityDurationMs / 1000)} consecutive seconds.`);
    }
    return Object.freeze({
      ready,
      verifiedAt: this.verifiedAt,
      verificationTimeMs: this.elapsedMs,
      readinessScore: this.calculateReadinessScore(state),
      checks: Object.freeze({ ...checks }),
      recommendations: Object.freeze(recommendations),
    });
  }

  manageCameraRecovery(cameraStatus) {
    const recoverable = cameraStatus.permission === 'GRANTED'
      && cameraStatus.status === CAMERA_CONNECTION.DISCONNECTED;
    if (!recoverable) {
      if (this.recoveringCamera) return;
      this.recoveryStartedAt = null;
      if (this.recoveryTimer) globalThis.clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
      return;
    }
    if (!this.recoveryStartedAt) this.recoveryStartedAt = Date.now();
    if (Date.now() - this.recoveryStartedAt >= this.config.vision.recoveryTimeoutMs || this.recoveryTimer) return;
    this.recoveryTimer = globalThis.setTimeout(async () => {
      this.recoveryTimer = null;
      await this.reconnectCamera();
      const current = this.detectorState.camera;
      if (current.status === CAMERA_CONNECTION.DISCONNECTED) this.manageCameraRecovery(current);
    }, this.config.vision.recoveryRetryIntervalMs);
  }
}
