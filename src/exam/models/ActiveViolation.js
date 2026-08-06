import { INTEGRITY_EVENT_STATUS } from './IntegrityEvent.js';

export class ActiveViolation {
  constructor(event) {
    if (event.status !== INTEGRITY_EVENT_STATUS.ACTIVE) {
      throw new TypeError('ActiveViolation requires an active integrity event.');
    }
    this.id = event.id;
    this.type = event.type;
    this.startedAt = event.startedAt;
    this.duration = event.duration;
    this.metadata = event.metadata;
    Object.freeze(this);
  }
}
