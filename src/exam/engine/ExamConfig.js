import { EXAM_EVENT_TYPES, EXAM_SEVERITIES } from '../models/ExamEvent.js';
import { detectorConfig } from '../config/detectorConfig.js';

export const defaultExamConfig = Object.freeze({
  browser: Object.freeze({
    fullscreenRequired: true,
    allowCopyPaste: false,
    allowRightClick: false,
  }),
  integrity: Object.freeze({
    initialScore: 100,
    minimumScore: 0,
    maxWarnings: 3,
    ignoredEventChannels: Object.freeze(['vision']),
    rules: Object.freeze({
      [EXAM_EVENT_TYPES.TAB_SWITCH]: Object.freeze({ deduction: 12, warning: true }),
      [EXAM_EVENT_TYPES.WINDOW_BLUR]: Object.freeze({ deduction: 8, warning: true }),
      [EXAM_EVENT_TYPES.FULLSCREEN_EXIT]: Object.freeze({ deduction: 15, warning: true }),
      [EXAM_EVENT_TYPES.COPY]: Object.freeze({ deduction: 5, warning: true }),
      [EXAM_EVENT_TYPES.PASTE]: Object.freeze({ deduction: 5, warning: true }),
      [EXAM_EVENT_TYPES.RIGHT_CLICK]: Object.freeze({ deduction: 3, warning: true }),
      [EXAM_EVENT_TYPES.DEVTOOLS_OPEN]: Object.freeze({ deduction: 20, warning: true }),
      [EXAM_EVENT_TYPES.WARNING]: Object.freeze({ deduction: 0, warning: true }),
      [EXAM_EVENT_TYPES.CUSTOM]: Object.freeze({ deduction: 0, warning: false }),
    }),
  }),
  eventDefaults: Object.freeze({
    severity: EXAM_SEVERITIES.INFO,
  }),
  vision: Object.freeze({
    verificationDurationMs: 2 * 60 * 1000,
    stabilityDurationMs: 30 * 1000,
    tickIntervalMs: 250,
    recoveryRetryIntervalMs: 3000,
    recoveryTimeoutMs: 30000,
    detectors: Object.freeze({
      camera: Object.freeze({ width: 1280, height: 720 }),
      face: Object.freeze({ intervalMs: 350, minDetectionConfidence: 0.5, stabilitySampleCount: 12 }),
      lighting: Object.freeze({ minimumBrightness: 55, maximumBrightness: 210, idealBrightness: 132, intervalMs: 500 }),
      ...detectorConfig,
    }),
    readiness: Object.freeze({
      minimumScore: 90,
      contributors: Object.freeze({
        camera: Object.freeze({ weight: 20, passingStatuses: Object.freeze(['CONNECTED']) }),
        face: Object.freeze({ weight: 25, passingStatuses: Object.freeze(['ONE_FACE']) }),
        lighting: Object.freeze({ weight: 20, passingStatuses: Object.freeze(['GOOD']) }),
        background: Object.freeze({ weight: 5, passingStatuses: Object.freeze(['GOOD']), warningStatuses: Object.freeze(['INITIALIZING', 'ACCEPTABLE']), warningFactor: 0.5 }),
        browser: Object.freeze({ weight: 10, passingStatuses: Object.freeze(['FOCUSED']) }),
        fullscreen: Object.freeze({ weight: 10, passingStatuses: Object.freeze(['ENABLED']) }),
        internet: Object.freeze({ weight: 10, passingStatuses: Object.freeze(['ONLINE']) }),
        audio: Object.freeze({ weight: 10, passingStatuses: Object.freeze(['SILENCE']), warningStatuses: Object.freeze(['SPEECH']), warningFactor: 0.5 }),
      }),
      requiredStatuses: Object.freeze({
        camera: Object.freeze(['CONNECTED']),
        face: Object.freeze(['ONE_FACE']),
        lighting: Object.freeze(['GOOD']),
        browser: Object.freeze(['FOCUSED']),
        fullscreen: Object.freeze(['ENABLED']),
        internet: Object.freeze(['ONLINE']),
        audio: Object.freeze(['SILENCE']),
      }),
    }),
  }),
  monitoring: Object.freeze({
    lifecycleUpdateIntervalMs: 1000,
    gracePeriodMs: 2000,
    recoveryTimeoutMs: 30000,
    escalation: Object.freeze([
      Object.freeze({ id: 'reminder', afterMs: 2000, label: 'Reminder', deduction: 0, warning: true }),
      Object.freeze({ id: 'warning', afterMs: 5000, label: 'Warning', deduction: 5, warning: true }),
      Object.freeze({ id: 'final-warning', afterMs: 15000, label: 'Final Warning', deduction: 10, warning: true }),
      Object.freeze({ id: 'violation-recorded', label: 'Violation Recorded', deduction: 15, warning: true }),
    ]),
    instantPenalties: Object.freeze({
      COPY: Object.freeze({ deduction: 5, warning: true }),
      PASTE: Object.freeze({ deduction: 5, warning: true }),
      RIGHT_CLICK: Object.freeze({ deduction: 3, warning: false }),
    }),
    escalationByViolation: Object.freeze({
      VOICE_ACTIVITY: Object.freeze([
        Object.freeze({ id: 'reminder', afterMs: detectorConfig.audio.minimumVoiceDuration, label: 'Reminder', deduction: 0, warning: true }),
        Object.freeze({ id: 'warning', afterMs: detectorConfig.audio.warningDuration, label: 'Warning', deduction: 5, warning: true }),
        Object.freeze({ id: 'violation-recorded', afterMs: detectorConfig.audio.violationDuration, label: 'Violation Recorded', deduction: 15, warning: true }),
      ]),
      LOUD_AMBIENT_NOISE: Object.freeze([
        Object.freeze({ id: 'reminder', afterMs: detectorConfig.audio.minimumVoiceDuration, label: 'Reminder', deduction: 0, warning: true }),
        Object.freeze({ id: 'warning', afterMs: detectorConfig.audio.warningDuration, label: 'Warning', deduction: 5, warning: true }),
        Object.freeze({ id: 'violation-recorded', afterMs: detectorConfig.audio.violationDuration, label: 'Violation Recorded', deduction: 15, warning: true }),
      ]),
    }),
  }),
});

export function createExamConfig(overrides = {}) {
  return {
    ...defaultExamConfig,
    ...overrides,
    browser: { ...defaultExamConfig.browser, ...overrides.browser },
    integrity: {
      ...defaultExamConfig.integrity,
      ...overrides.integrity,
      rules: { ...defaultExamConfig.integrity.rules, ...overrides.integrity?.rules },
      ignoredEventChannels: overrides.integrity?.ignoredEventChannels
        ?? defaultExamConfig.integrity.ignoredEventChannels,
    },
    eventDefaults: { ...defaultExamConfig.eventDefaults, ...overrides.eventDefaults },
    vision: {
      ...defaultExamConfig.vision,
      ...overrides.vision,
      detectors: {
        ...defaultExamConfig.vision.detectors,
        ...overrides.vision?.detectors,
        camera: { ...defaultExamConfig.vision.detectors.camera, ...overrides.vision?.detectors?.camera },
        face: { ...defaultExamConfig.vision.detectors.face, ...overrides.vision?.detectors?.face },
        lighting: { ...defaultExamConfig.vision.detectors.lighting, ...overrides.vision?.detectors?.lighting },
        background: { ...defaultExamConfig.vision.detectors.background, ...overrides.vision?.detectors?.background },
        audio: { ...defaultExamConfig.vision.detectors.audio, ...overrides.vision?.detectors?.audio },
        inference: { ...defaultExamConfig.vision.detectors.inference, ...overrides.vision?.detectors?.inference },
        facePresence: { ...defaultExamConfig.vision.detectors.facePresence, ...overrides.vision?.detectors?.facePresence },
        headPose: { ...defaultExamConfig.vision.detectors.headPose, ...overrides.vision?.detectors?.headPose },
        lookingAway: { ...defaultExamConfig.vision.detectors.lookingAway, ...overrides.vision?.detectors?.lookingAway },
        phone: { ...defaultExamConfig.vision.detectors.phone, ...overrides.vision?.detectors?.phone },
        objects: { ...defaultExamConfig.vision.detectors.objects, ...overrides.vision?.detectors?.objects },
      },
      readiness: {
        ...defaultExamConfig.vision.readiness,
        ...overrides.vision?.readiness,
        contributors: { ...defaultExamConfig.vision.readiness.contributors, ...overrides.vision?.readiness?.contributors },
        requiredStatuses: { ...defaultExamConfig.vision.readiness.requiredStatuses, ...overrides.vision?.readiness?.requiredStatuses },
      },
    },
    monitoring: {
      ...defaultExamConfig.monitoring,
      ...overrides.monitoring,
      escalation: overrides.monitoring?.escalation ?? defaultExamConfig.monitoring.escalation,
      instantPenalties: { ...defaultExamConfig.monitoring.instantPenalties, ...overrides.monitoring?.instantPenalties },
      escalationByViolation: { ...defaultExamConfig.monitoring.escalationByViolation, ...overrides.monitoring?.escalationByViolation },
    },
  };
}
