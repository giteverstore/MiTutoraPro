export class MonitoringTimeline {
  constructor() {
    this.entries = new Map();
  }

  update(event) {
    if (event) this.entries.set(event.id, event);
    return this.getEntries();
  }

  reset() {
    this.entries.clear();
  }

  getEntries() {
    return Object.freeze([...this.entries.values()].sort((a, b) => a.startedAt - b.startedAt));
  }
}
