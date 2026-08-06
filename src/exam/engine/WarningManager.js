export class WarningManager {
  constructor({ maxWarnings = Infinity } = {}) {
    this.maxWarnings = maxWarnings;
    this.queue = [];
    this.seenEventIds = new Set();
    this.listeners = new Set();
  }

  handleEvent(event, rule = {}) {
    if (!rule.warning || this.seenEventIds.has(event.id)) return null;
    this.seenEventIds.add(event.id);
    const warning = Object.freeze({
      id: `warning-${event.id}`,
      eventId: event.id,
      type: event.type,
      severity: event.severity,
      timestamp: event.timestamp,
      message: event.metadata.message ?? `Exam integrity event detected: ${event.type.replaceAll('_', ' ').toLowerCase()}.`,
      limitReached: this.count + 1 >= this.maxWarnings,
    });
    this.queue.push(warning);
    this.notify();
    return warning;
  }

  get activeWarning() {
    return this.queue[0] ?? null;
  }

  get count() {
    return this.seenEventIds.size;
  }

  acknowledge() {
    const warning = this.queue.shift() ?? null;
    if (warning) this.notify();
    return warning;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    return Object.freeze({ activeWarning: this.activeWarning, count: this.count });
  }

  reset() {
    this.queue = [];
    this.seenEventIds.clear();
    this.notify();
  }

  notify() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
