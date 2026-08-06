export const EXAM_EVENT_TYPES = Object.freeze({
  TAB_SWITCH: 'TAB_SWITCH',
  WINDOW_BLUR: 'WINDOW_BLUR',
  FULLSCREEN_EXIT: 'FULLSCREEN_EXIT',
  COPY: 'COPY',
  PASTE: 'PASTE',
  RIGHT_CLICK: 'RIGHT_CLICK',
  DEVTOOLS_OPEN: 'DEVTOOLS_OPEN',
  WARNING: 'WARNING',
  CUSTOM: 'CUSTOM',
});

export const EXAM_SEVERITIES = Object.freeze({
  INFO: 'info',
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
});

const validTypes = new Set(Object.values(EXAM_EVENT_TYPES));
const validSeverities = new Set(Object.values(EXAM_SEVERITIES));
let eventSequence = 0;

function createEventId(timestamp) {
  eventSequence += 1;
  return `exam-event-${timestamp}-${eventSequence}`;
}

export class ExamEvent {
  constructor({
    id,
    type,
    timestamp = Date.now(),
    durationMs = 0,
    severity = EXAM_SEVERITIES.INFO,
    metadata = {},
  }) {
    if (!validTypes.has(type)) throw new TypeError(`Unsupported exam event type: ${type}`);
    if (!validSeverities.has(severity)) throw new TypeError(`Unsupported exam event severity: ${severity}`);
    if (!Number.isFinite(timestamp) || !Number.isFinite(durationMs) || durationMs < 0) {
      throw new TypeError('Exam event timing values must be valid non-negative numbers.');
    }
    this.id = id ?? createEventId(timestamp);
    this.type = type;
    this.timestamp = timestamp;
    this.durationMs = durationMs;
    this.severity = severity;
    this.metadata = Object.freeze({ ...metadata });
    Object.freeze(this);
  }
}
