import { EXAM_EVENT_TYPES, EXAM_SEVERITIES } from '../models/ExamEvent.js';

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
    vision: { ...defaultExamConfig.vision, ...overrides.vision },
  };
}
