import { CAMERA_CONNECTION } from '../models/CameraStatus.js';
import { EXAM_EVENT_TYPES } from '../models/ExamEvent.js';
import { FACE_STATUS } from '../detectors/FaceDetector.js';
import { LIGHTING_STATUS } from '../detectors/LightingDetector.js';
import { BACKGROUND_STATUS } from '../detectors/BackgroundDetector.js';
import { HEAD_POSE_STATUS } from '../detectors/HeadPoseDetector.js';
import { LOOKING_AWAY_STATUS } from '../detectors/LookingAwayDetector.js';
import { PHONE_STATUS } from '../detectors/PhoneDetector.js';
import { AUDIO_STATUS } from '../detectors/AudioDetector.js';
import { OBJECT_STATUS } from '../detectors/ExamObjectDetector.js';
import { DetectorManager } from '../engine/DetectorManager.js';
import { EventLifecycleManager } from '../engine/EventLifecycleManager.js';
import { MonitoringTimeline } from './MonitoringTimeline.js';

export const MONITORING_STATUS = Object.freeze({
  IDLE: 'IDLE',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  STOPPED: 'STOPPED',
});

export const MONITORING_VIOLATIONS = Object.freeze({
  FACE_LOST: 'FACE_LOST',
  MULTIPLE_FACES: 'MULTIPLE_FACES',
  CAMERA_DISCONNECTED: 'CAMERA_DISCONNECTED',
  LIGHTING_ISSUE: 'LIGHTING_ISSUE',
  BACKGROUND_BLOCKED: 'BACKGROUND_BLOCKED',
  HEAD_POSE: 'HEAD_POSE',
  LOOKING_AWAY: 'LOOKING_AWAY',
  PHONE_DETECTED: 'PHONE_DETECTED',
  VOICE_ACTIVITY: 'VOICE_ACTIVITY',
  LOUD_AMBIENT_NOISE: 'LOUD_AMBIENT_NOISE',
  MICROPHONE_UNAVAILABLE: 'MICROPHONE_UNAVAILABLE',
  PROHIBITED_OBJECT: 'PROHIBITED_OBJECT',
  BACKGROUND_MEDIA: 'BACKGROUND_MEDIA',
  KEYBOARD_ACTIVITY: 'KEYBOARD_ACTIVITY',
  AUDIO_INPUT_UNHEALTHY: 'AUDIO_INPUT_UNHEALTHY',
  TAB_SWITCH: EXAM_EVENT_TYPES.TAB_SWITCH,
  WINDOW_BLUR: EXAM_EVENT_TYPES.WINDOW_BLUR,
  FULLSCREEN_EXIT: EXAM_EVENT_TYPES.FULLSCREEN_EXIT,
  COPY: EXAM_EVENT_TYPES.COPY,
  PASTE: EXAM_EVENT_TYPES.PASTE,
  RIGHT_CLICK: EXAM_EVENT_TYPES.RIGHT_CLICK,
});

export class MonitoringSession {
  constructor({ eventBus, detectors, config, onLifecycleEvent, clock = () => Date.now() }) {
    this.eventBus = eventBus;
    this.config = config;
    this.clock = clock;
    this.onLifecycleEvent = onLifecycleEvent;
    this.detectorManager = new DetectorManager(detectors);
    this.lifecycle = new EventLifecycleManager({
      clock,
      updateIntervalMs: config.monitoring.lifecycleUpdateIntervalMs,
    });
    this.timeline = new MonitoringTimeline();
    this.status = MONITORING_STATUS.IDLE;
    this.startedAt = null;
    this.endedAt = null;
    this.listeners = new Set();
    this.unsubscribeBus = null;
    this.unsubscribeLifecycle = null;
    this.heartbeatTimer = null;
  }

  async start() {
    if (this.status === MONITORING_STATUS.RUNNING) return this.getSnapshot();
    this.status = MONITORING_STATUS.RUNNING;
    this.startedAt ??= this.clock();
    this.endedAt = null;
    this.unsubscribeBus ??= this.eventBus.subscribe((event) => this.handleDetection(event));
    this.unsubscribeLifecycle ??= this.lifecycle.subscribe((payload) => this.handleLifecycle(payload));
    this.lifecycle.start();
    this.heartbeatTimer ??= globalThis.setInterval(() => this.notify(), this.config.monitoring.lifecycleUpdateIntervalMs);
    await this.detectorManager.start();
    this.notify();
    return this.getSnapshot();
  }

  stop() {
    if (this.status === MONITORING_STATUS.STOPPED || this.status === MONITORING_STATUS.IDLE) return;
    this.status = MONITORING_STATUS.STOPPED;
    this.endedAt = this.clock();
    this.detectorManager.stop();
    this.lifecycle.stop();
    if (this.heartbeatTimer) globalThis.clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.unsubscribeBus?.();
    this.unsubscribeLifecycle?.();
    this.unsubscribeBus = null;
    this.unsubscribeLifecycle = null;
    this.notify();
  }

  pause() {
    if (this.status !== MONITORING_STATUS.RUNNING) return;
    this.detectorManager.pause();
    this.status = MONITORING_STATUS.PAUSED;
    this.notify();
  }

  resume() {
    if (this.status !== MONITORING_STATUS.PAUSED) return;
    this.detectorManager.resume();
    this.status = MONITORING_STATUS.RUNNING;
    this.notify();
  }

  reset() {
    const wasRunning = this.status === MONITORING_STATUS.RUNNING;
    if (wasRunning) this.status = MONITORING_STATUS.PAUSED;
    this.lifecycle.reset();
    this.timeline.reset();
    this.detectorManager.reset();
    if (wasRunning) this.status = MONITORING_STATUS.RUNNING;
    this.startedAt = wasRunning ? this.clock() : null;
    this.endedAt = null;
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    const lifecycle = this.lifecycle.getSnapshot();
    const end = this.endedAt ?? this.clock();
    return Object.freeze({
      status: this.status,
      startedAt: this.startedAt,
      endedAt: this.endedAt,
      monitoringTimeMs: this.startedAt ? Math.max(0, end - this.startedAt) : 0,
      activeViolations: lifecycle.activeViolations,
      timeline: this.timeline.getEntries(),
      eventCount: lifecycle.events.length,
      detectorStatus: this.detectorManager.getStatus(),
    });
  }

  handleDetection(event) {
    if (this.status !== MONITORING_STATUS.RUNNING) return;
    if (event.type === EXAM_EVENT_TYPES.CUSTOM) {
      if (event.metadata.channel === 'vision') this.handleVisionStatus(event.metadata.detector, event.metadata.status);
      else if (event.metadata.monitoringAction) this.handleMonitoringControl(event.metadata);
      else this.handleBrowserRecovery(event.metadata.action);
      return;
    }
    if ([EXAM_EVENT_TYPES.COPY, EXAM_EVENT_TYPES.PASTE, EXAM_EVENT_TYPES.RIGHT_CLICK].includes(event.type)) {
      this.lifecycle.recordInstant(event.type, event.metadata);
      return;
    }
    if ([EXAM_EVENT_TYPES.TAB_SWITCH, EXAM_EVENT_TYPES.WINDOW_BLUR, EXAM_EVENT_TYPES.FULLSCREEN_EXIT].includes(event.type)) {
      this.lifecycle.startViolation(event.type, event.metadata);
    }
  }

  handleVisionStatus(detector, state) {
    const evidence = state.details?.evidence;
    if (detector === 'face') {
      this.syncViolation(MONITORING_VIOLATIONS.FACE_LOST, state.status === FACE_STATUS.NO_FACE, { detector, message: state.message, evidence });
      this.syncViolation(MONITORING_VIOLATIONS.MULTIPLE_FACES, state.status === FACE_STATUS.MULTIPLE_FACES, { detector, message: state.message, evidence });
    } else if (detector === 'camera') {
      this.syncViolation(MONITORING_VIOLATIONS.CAMERA_DISCONNECTED, state.status !== CAMERA_CONNECTION.CONNECTED || !state.streamActive, { detector, message: state.message });
    } else if (detector === 'lighting') {
      this.syncViolation(MONITORING_VIOLATIONS.LIGHTING_ISSUE, state.status !== LIGHTING_STATUS.GOOD, { detector, condition: state.status, message: state.message });
    } else if (detector === 'background') {
      this.syncViolation(MONITORING_VIOLATIONS.BACKGROUND_BLOCKED, state.status === BACKGROUND_STATUS.UNABLE_TO_VERIFY, { detector, message: state.message });
    } else if (detector === 'headPose') {
      this.syncViolation(MONITORING_VIOLATIONS.HEAD_POSE, ![HEAD_POSE_STATUS.CENTERED, HEAD_POSE_STATUS.UNKNOWN].includes(state.status), { detector, condition: state.status, message: state.message, evidence });
    } else if (detector === 'lookingAway') {
      this.syncViolation(MONITORING_VIOLATIONS.LOOKING_AWAY, state.status === LOOKING_AWAY_STATUS.LOOKING_AWAY, { detector, message: state.message, evidence });
    } else if (detector === 'phone') {
      this.syncViolation(MONITORING_VIOLATIONS.PHONE_DETECTED, state.status === PHONE_STATUS.PHONE_DETECTED, { detector, message: state.message, evidence });
    } else if (detector === 'audio') {
      this.syncViolation(MONITORING_VIOLATIONS.VOICE_ACTIVITY, [AUDIO_STATUS.CANDIDATE_SPEAKING, AUDIO_STATUS.OTHER_SPEAKER_ESTIMATED, AUDIO_STATUS.CONTINUOUS_CONVERSATION].includes(state.status), { detector, condition: state.status, message: state.message, evidence });
      this.syncViolation(MONITORING_VIOLATIONS.LOUD_AMBIENT_NOISE, state.status === AUDIO_STATUS.LOUD_BACKGROUND_NOISE, { detector, message: state.message, evidence });
      this.syncViolation(MONITORING_VIOLATIONS.BACKGROUND_MEDIA, [AUDIO_STATUS.MUSIC_ESTIMATED, AUDIO_STATUS.MEDIA_PLAYBACK_ESTIMATED].includes(state.status), { detector, condition: state.status, message: state.message, evidence });
      this.syncViolation(MONITORING_VIOLATIONS.KEYBOARD_ACTIVITY, state.status === AUDIO_STATUS.KEYBOARD_TYPING_ESTIMATED, { detector, message: state.message, evidence });
      this.syncViolation(MONITORING_VIOLATIONS.AUDIO_INPUT_UNHEALTHY, [AUDIO_STATUS.ZERO_INPUT, AUDIO_STATUS.SATURATED].includes(state.status), { detector, condition: state.status, message: state.message, evidence });
      this.syncViolation(MONITORING_VIOLATIONS.MICROPHONE_UNAVAILABLE, [AUDIO_STATUS.MUTED, AUDIO_STATUS.DISCONNECTED, AUDIO_STATUS.UNAVAILABLE].includes(state.status), { detector, condition: state.status, message: state.message });
    } else if (detector === 'objects') {
      const dedicatedPhoneEvent = state.details?.evidence?.labels?.[0] === 'phone';
      this.syncViolation(MONITORING_VIOLATIONS.PROHIBITED_OBJECT, state.status === OBJECT_STATUS.OBJECT_DETECTED && !dedicatedPhoneEvent, { detector, message: state.message, evidence });
    }
  }

  handleBrowserRecovery(action) {
    if (action === 'TAB_RETURN') this.lifecycle.recoverViolation(MONITORING_VIOLATIONS.TAB_SWITCH);
    if (action === 'WINDOW_FOCUS') this.lifecycle.recoverViolation(MONITORING_VIOLATIONS.WINDOW_BLUR);
    if (action === 'FULLSCREEN_RESTORED') this.lifecycle.recoverViolation(MONITORING_VIOLATIONS.FULLSCREEN_EXIT);
  }

  handleMonitoringControl({ monitoringAction, violationType, metadata = {} }) {
    if (monitoringAction === 'START') this.lifecycle.startViolation(violationType, { ...metadata, simulated: true });
    if (monitoringAction === 'RECOVER') this.lifecycle.recoverViolation(violationType, { ...metadata, simulated: true });
    if (monitoringAction === 'RESET') this.reset();
  }

  syncViolation(type, violating, metadata) {
    if (violating) this.lifecycle.startViolation(type, metadata);
    else this.lifecycle.recoverViolation(type, metadata);
  }

  handleLifecycle(payload) {
    this.timeline.update(payload.event);
    this.onLifecycleEvent?.(payload.event, payload.change);
    this.notify();
  }

  notify() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  destroy() {
    this.stop();
    this.detectorManager.destroy();
    this.lifecycle.destroy();
    this.timeline.reset();
    this.listeners.clear();
  }
}
