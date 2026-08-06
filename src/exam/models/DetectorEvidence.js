export class DetectorEvidence {
  constructor({ detectorId, type = 'detection', capturedAt = Date.now(), timestamp = capturedAt, confidence = null, stability = 0, durationMs = 0, duration = durationMs, quality = 0, version = '1.0.0', measurements = {}, metadata = measurements, labels = [], source = 'camera' }) {
    if (!detectorId) throw new TypeError('DetectorEvidence requires detectorId.');
    this.detectorId = detectorId;
    this.type = type;
    this.capturedAt = timestamp;
    this.timestamp = timestamp;
    this.confidence = Number.isFinite(confidence) ? confidence : null;
    this.stability = Math.max(0, Math.min(1, stability));
    this.durationMs = Math.max(0, duration);
    this.duration = this.durationMs;
    this.quality = Math.max(0, Math.min(100, quality));
    this.version = version;
    this.measurements = Object.freeze({ ...metadata });
    this.metadata = this.measurements;
    this.labels = Object.freeze([...labels]);
    this.source = source;
    Object.freeze(this);
  }
}
