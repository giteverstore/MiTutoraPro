import { ExamEvent, EXAM_EVENT_TYPES, EXAM_SEVERITIES } from '../models/ExamEvent.js';

export const BACKGROUND_STATUS = Object.freeze({
  UNKNOWN: 'UNKNOWN',
  CLEAR: 'CLEAR',
  BLOCKED: 'BLOCKED',
});

export class BackgroundDetector {
  constructor({ eventBus, streamProvider }) {
    this.eventBus = eventBus;
    this.streamProvider = streamProvider;
    this.status = BACKGROUND_STATUS.UNKNOWN;
  }

  start() {
    this.publish(this.streamProvider() ? BACKGROUND_STATUS.CLEAR : BACKGROUND_STATUS.UNKNOWN);
  }

  stop() {}

  reset() {
    this.publish(BACKGROUND_STATUS.UNKNOWN);
  }

  getStatus() {
    return this.status;
  }

  destroy() {
    this.status = BACKGROUND_STATUS.UNKNOWN;
  }

  publish(status) {
    if (this.status === status) return;
    this.status = status;
    this.eventBus.emit(new ExamEvent({
      type: EXAM_EVENT_TYPES.CUSTOM,
      severity: status === BACKGROUND_STATUS.CLEAR ? EXAM_SEVERITIES.INFO : EXAM_SEVERITIES.LOW,
      metadata: { channel: 'vision', detector: 'background', status },
    }));
  }
}
