export class AcousticEvent {
  constructor({ type, confidence = 0, duration = 0, startTime = Date.now(), endTime = null, severity = 'info', metadata = {} }) {
    if (!type) throw new TypeError('AcousticEvent requires type.');
    this.type = type; this.confidence = Math.max(0, Math.min(1, confidence)); this.duration = Math.max(0, duration);
    this.startTime = startTime; this.endTime = endTime; this.severity = severity; this.metadata = Object.freeze({ ...metadata }); Object.freeze(this);
  }
  close(endTime = Date.now()) { return new AcousticEvent({ ...this, duration: Math.max(this.duration, endTime - this.startTime), endTime }); }
}
