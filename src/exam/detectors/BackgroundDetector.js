import { ExamEvent, EXAM_EVENT_TYPES, EXAM_SEVERITIES } from '../models/ExamEvent.js';
import { DetectorStatus, DETECTOR_SEVERITY } from '../models/DetectorStatus.js';

export const BACKGROUND_STATUS = Object.freeze({
  UNKNOWN: 'UNKNOWN',
  CLEAR: 'CLEAR',
  BLOCKED: 'BLOCKED',
});

export function createBackgroundStatus(status) {
  const values = {
    [BACKGROUND_STATUS.UNKNOWN]: ['Background is not AI-verified yet.', DETECTOR_SEVERITY.WARNING, 50],
    [BACKGROUND_STATUS.CLEAR]: ['Background check is clear.', DETECTOR_SEVERITY.SUCCESS, 100],
    [BACKGROUND_STATUS.BLOCKED]: ['Background view is blocked. Keep the camera area unobstructed.', DETECTOR_SEVERITY.ERROR, 0],
  };
  const [message, severity, quality] = values[status];
  return new DetectorStatus({ status, message, severity, quality });
}

export class BackgroundDetector {
  constructor({ eventBus, streamProvider }) {
    this.eventBus = eventBus;
    this.streamProvider = streamProvider;
    this.status = createBackgroundStatus(BACKGROUND_STATUS.UNKNOWN);
  }

  start() {
    this.publish(BACKGROUND_STATUS.UNKNOWN);
  }

  stop() {}
  pause() {}
  resume() { this.start(); }

  reset() {
    this.publish(BACKGROUND_STATUS.UNKNOWN);
  }

  getStatus() {
    return this.status;
  }

  destroy() {
    this.status = createBackgroundStatus(BACKGROUND_STATUS.UNKNOWN);
  }

  publish(status) {
    if (this.status.status === status) return;
    this.status = createBackgroundStatus(status);
    this.eventBus.emit(new ExamEvent({
      type: EXAM_EVENT_TYPES.CUSTOM,
      severity: status === BACKGROUND_STATUS.CLEAR ? EXAM_SEVERITIES.INFO : EXAM_SEVERITIES.LOW,
      metadata: { channel: 'vision', detector: 'background', status: this.status },
    }));
  }
}
