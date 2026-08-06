export const DETECTOR_SEVERITY = Object.freeze({
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  PENDING: 'pending',
  INFO: 'info',
});

export class DetectorStatus {
  constructor({ status, message, severity, quality = 0, lastUpdated = Date.now(), details = {} }) {
    if (!status || !message || !severity) {
      throw new TypeError('DetectorStatus requires status, message, and severity.');
    }
    this.status = status;
    this.lastUpdated = lastUpdated;
    this.message = message;
    this.severity = severity;
    this.quality = Math.max(0, Math.min(100, Math.round(quality)));
    this.details = Object.freeze({ ...details });
    Object.freeze(this);
  }
}
