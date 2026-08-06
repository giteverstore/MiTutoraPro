export class EventBus {
  constructor() {
    this.listeners = new Set();
  }

  emit(event) {
    [...this.listeners].forEach((listener) => listener(event));
    return event;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('EventBus listeners must be functions.');
    this.listeners.add(listener);
    return () => this.unsubscribe(listener);
  }

  unsubscribe(listener) {
    return this.listeners.delete(listener);
  }

  clear() {
    this.listeners.clear();
  }
}
