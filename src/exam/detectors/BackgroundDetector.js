import { ExamEvent, EXAM_EVENT_TYPES, EXAM_SEVERITIES } from '../models/ExamEvent.js';
import { DetectorStatus, DETECTOR_SEVERITY } from '../models/DetectorStatus.js';

export const BACKGROUND_STATUS = Object.freeze({ UNKNOWN: 'INITIALIZING', GOOD: 'GOOD', CLEAR: 'GOOD', ACCEPTABLE: 'ACCEPTABLE', NEEDS_ATTENTION: 'NEEDS_ATTENTION', UNABLE_TO_VERIFY: 'UNABLE_TO_VERIFY', BLOCKED: 'UNABLE_TO_VERIFY' });
const values = {
  [BACKGROUND_STATUS.UNKNOWN]: ['Preparing background verification…', DETECTOR_SEVERITY.PENDING],
  [BACKGROUND_STATUS.GOOD]: ['Background is stable and clearly visible.', DETECTOR_SEVERITY.SUCCESS],
  [BACKGROUND_STATUS.ACCEPTABLE]: ['Background is usable, with minor movement.', DETECTOR_SEVERITY.WARNING],
  [BACKGROUND_STATUS.NEEDS_ATTENTION]: ['Please ensure a clear, stable background.', DETECTOR_SEVERITY.WARNING],
  [BACKGROUND_STATUS.UNABLE_TO_VERIFY]: ['Background cannot be verified. Check that the camera is unobstructed.', DETECTOR_SEVERITY.ERROR],
};
export function createBackgroundStatus(status, quality = status === BACKGROUND_STATUS.GOOD ? 100 : 0, details = {}) { const [message, severity] = values[status]; return new DetectorStatus({ status, message, severity, quality, details }); }

export class BackgroundDetector {
  constructor({ eventBus, inferenceService, config }) { this.eventBus = eventBus; this.inferenceService = inferenceService; this.config = config; this.status = createBackgroundStatus(BACKGROUND_STATUS.UNKNOWN); this.unsubscribe = null; this.samples = []; }
  start() { if (!this.unsubscribe) this.unsubscribe = this.inferenceService.subscribe((result) => this.handleResult(result)); }
  stop() { this.unsubscribe?.(); this.unsubscribe = null; }
  pause() { this.stop(); } resume() { this.start(); }
  reset() { this.stop(); this.samples = []; this.publish(BACKGROUND_STATUS.UNKNOWN); }
  destroy() { this.stop(); this.samples = []; }
  getStatus() { return this.status; }
  handleResult({ frame }) {
    if (!frame) return;
    this.samples.push(frame); if (this.samples.length > this.config.smoothingWindow) this.samples.shift();
    const average = (key) => this.samples.reduce((sum, sample) => sum + sample[key], 0) / this.samples.length;
    const metrics = { brightness: average('brightness'), contrast: average('contrast'), motion: average('motion') };
    let status = BACKGROUND_STATUS.GOOD;
    if (metrics.brightness <= this.config.blockedBrightness || metrics.contrast < this.config.minimumContrast) status = BACKGROUND_STATUS.UNABLE_TO_VERIFY;
    else if (metrics.motion >= this.config.excessiveMotion) status = BACKGROUND_STATUS.NEEDS_ATTENTION;
    else if (metrics.motion >= this.config.acceptableMotion) status = BACKGROUND_STATUS.ACCEPTABLE;
    const quality = Math.max(0, Math.round(100 - Math.min(70, metrics.motion * 1.5) - (metrics.contrast < this.config.minimumContrast * 2 ? 20 : 0)));
    this.publish(status, quality, metrics);
  }
  publish(status, quality, details) { this.status = createBackgroundStatus(status, quality, details); this.eventBus.emit(new ExamEvent({ type: EXAM_EVENT_TYPES.CUSTOM, severity: status === BACKGROUND_STATUS.GOOD ? EXAM_SEVERITIES.INFO : EXAM_SEVERITIES.LOW, metadata: { channel: 'vision', detector: 'background', status: this.status } })); }
}
