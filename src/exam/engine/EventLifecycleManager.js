import { ActiveViolation } from '../models/ActiveViolation.js';
import { IntegrityEvent, INTEGRITY_EVENT_STATUS } from '../models/IntegrityEvent.js';

export class EventLifecycleManager {
  constructor({ clock = () => Date.now(), updateIntervalMs = 1000 } = {}) {
    this.clock = clock;
    this.updateIntervalMs = updateIntervalMs;
    this.events = new Map();
    this.activeByType = new Map();
    this.listeners = new Set();
    this.timer = null;
  }

  start() {
    if (!this.timer) this.timer = globalThis.setInterval(() => this.updateDurations(), this.updateIntervalMs);
  }

  startViolation(type, metadata = {}) {
    const existingId = this.activeByType.get(type);
    if (existingId) return this.events.get(existingId);
    const event = new IntegrityEvent({ type, startedAt: this.clock(), metadata });
    this.events.set(event.id, event);
    this.activeByType.set(type, event.id);
    this.publish(event, 'started');
    return event;
  }

  recoverViolation(type, metadata = {}) {
    return this.closeViolation(type, INTEGRITY_EVENT_STATUS.RECOVERED, metadata);
  }

  dismissViolation(type, metadata = {}) {
    return this.closeViolation(type, INTEGRITY_EVENT_STATUS.DISMISSED, metadata);
  }

  closeViolation(type, status, metadata = {}) {
    const id = this.activeByType.get(type);
    if (!id) return null;
    const current = this.events.get(id);
    const endedAt = this.clock();
    const event = current.update({
      endedAt,
      duration: Math.max(0, endedAt - current.startedAt),
      status,
      metadata: { ...current.metadata, ...metadata },
    });
    this.events.set(id, event);
    this.activeByType.delete(type);
    this.publish(event, status === INTEGRITY_EVENT_STATUS.RECOVERED ? 'recovered' : 'dismissed');
    return event;
  }

  recordInstant(type, metadata = {}) {
    this.startViolation(type, metadata);
    return this.recoverViolation(type, metadata);
  }

  updateDurations() {
    const now = this.clock();
    this.activeByType.forEach((id) => {
      const current = this.events.get(id);
      const event = current.update({ duration: Math.max(0, now - current.startedAt) });
      this.events.set(id, event);
      this.publish(event, 'updated');
    });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    const events = [...this.events.values()].sort((a, b) => a.startedAt - b.startedAt);
    return Object.freeze({
      events: Object.freeze(events),
      activeViolations: Object.freeze(events
        .filter(({ status }) => status === INTEGRITY_EVENT_STATUS.ACTIVE)
        .map((event) => new ActiveViolation(event))),
    });
  }

  reset() {
    this.events.clear();
    this.activeByType.clear();
    this.publish(null, 'reset');
  }

  stop({ closeActive = true } = {}) {
    if (this.timer) globalThis.clearInterval(this.timer);
    this.timer = null;
    if (closeActive) [...this.activeByType.keys()].forEach((type) => this.dismissViolation(type, { reason: 'monitoring-ended' }));
  }

  destroy() {
    this.stop();
    this.listeners.clear();
    this.events.clear();
    this.activeByType.clear();
  }

  publish(event, change) {
    const payload = Object.freeze({ event, change, snapshot: this.getSnapshot() });
    this.listeners.forEach((listener) => listener(payload));
  }
}
