import { ExamEvent } from '../models/ExamEvent.js';
import { IntegrityReport } from '../models/IntegrityReport.js';

export class IntegrityEngine {
  constructor({ eventBus, warningManager, config }) {
    this.eventBus = eventBus;
    this.warningManager = warningManager;
    this.config = config;
    this.score = config.integrity.initialScore;
    this.timeline = [];
    this.listeners = new Set();
    this.unsubscribeFromBus = null;
  }

  start() {
    if (!this.unsubscribeFromBus) {
      this.unsubscribeFromBus = this.eventBus.subscribe((event) => this.process(event));
    }
  }

  process(candidate) {
    const event = candidate instanceof ExamEvent ? candidate : new ExamEvent(candidate);
    if (this.config.integrity.ignoredEventChannels.includes(event.metadata.channel)) {
      return this.getSnapshot();
    }
    const rule = this.config.integrity.rules[event.type] ?? {};
    this.timeline.push(event);
    this.timeline.sort((a, b) => a.timestamp - b.timestamp);
    this.score = Math.max(
      this.config.integrity.minimumScore,
      this.score - (Number.isFinite(rule.deduction) ? rule.deduction : 0),
    );
    this.warningManager.handleEvent(event, rule);
    this.notify();
    return this.getSnapshot();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    return Object.freeze({ score: this.score, timeline: Object.freeze([...this.timeline]) });
  }

  createReport() {
    return new IntegrityReport({
      score: this.score,
      warningCount: this.warningManager.count,
      timeline: this.timeline,
    });
  }

  reset() {
    this.score = this.config.integrity.initialScore;
    this.timeline = [];
    this.warningManager.reset();
    this.notify();
  }

  dispose() {
    this.unsubscribeFromBus?.();
    this.unsubscribeFromBus = null;
    this.listeners.clear();
  }

  notify() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
