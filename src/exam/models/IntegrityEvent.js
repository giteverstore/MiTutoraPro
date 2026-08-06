export const INTEGRITY_EVENT_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  RECOVERED: 'RECOVERED',
  DISMISSED: 'DISMISSED',
});

let integrityEventSequence = 0;

function createId(type, timestamp) {
  integrityEventSequence += 1;
  return `integrity-${type.toLowerCase()}-${timestamp}-${integrityEventSequence}`;
}

export class IntegrityEvent {
  constructor({
    id,
    type,
    startedAt,
    endedAt = null,
    duration = 0,
    status = INTEGRITY_EVENT_STATUS.ACTIVE,
    metadata = {},
  }) {
    if (!type || !Number.isFinite(startedAt)) throw new TypeError('IntegrityEvent requires type and startedAt.');
    this.id = id ?? createId(type, startedAt);
    this.type = type;
    this.startedAt = startedAt;
    this.endedAt = endedAt;
    this.duration = Math.max(0, duration);
    this.status = status;
    this.metadata = Object.freeze({ ...metadata });
    Object.freeze(this);
  }

  update(values) {
    return new IntegrityEvent({ ...this, ...values, id: this.id });
  }
}
