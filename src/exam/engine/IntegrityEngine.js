import { ExamEvent } from '../models/ExamEvent.js';
import { IntegrityReport } from '../models/IntegrityReport.js';
import { INTEGRITY_EVENT_STATUS } from '../models/IntegrityEvent.js';

export class IntegrityEngine {
  constructor({ eventBus, warningManager, config }) {
    this.eventBus = eventBus;
    this.warningManager = warningManager;
    this.config = config;
    this.score = config.integrity.initialScore;
    this.timeline = [];
    this.listeners = new Set();
    this.unsubscribeFromBus = null;
    this.lifecycleMode = false;
    this.appliedEscalations = new Map();
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
    if (this.lifecycleMode && (event.type === 'CUSTOM' || [
      'TAB_SWITCH', 'WINDOW_BLUR', 'FULLSCREEN_EXIT', 'COPY', 'PASTE', 'RIGHT_CLICK',
    ].includes(event.type))) return this.getSnapshot();
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

  setLifecycleMode(active) {
    this.lifecycleMode = active;
  }

  processLifecycleEvent(event, change) {
    if (!event) return this.getSnapshot();
    const existingIndex = this.timeline.findIndex(({ id }) => id === event.id);
    if (existingIndex >= 0) this.timeline[existingIndex] = event;
    else this.timeline.push(event);
    this.timeline.sort((a, b) => (a.timestamp ?? a.startedAt) - (b.timestamp ?? b.startedAt));

    const applied = this.appliedEscalations.get(event.id) ?? new Set();
    const instantRule = this.config.monitoring.instantPenalties[event.type];
    if (instantRule && event.status !== INTEGRITY_EVENT_STATUS.ACTIVE && !applied.has('instant')) {
      this.applyPenalty(event, { id: 'instant', label: 'Violation Recorded', ...instantRule });
      applied.add('instant');
    }
    if (!instantRule) {
      const escalation = this.config.monitoring.escalationByViolation?.[event.type] ?? this.config.monitoring.escalation;
      escalation.forEach((level) => {
        const configuredThreshold = level.id === 'violation-recorded'
          ? level.afterMs ?? this.config.monitoring.recoveryTimeoutMs
          : level.afterMs ?? 0;
        const threshold = Math.max(this.config.monitoring.gracePeriodMs, configuredThreshold);
        if (event.duration >= threshold && !applied.has(level.id)) {
          this.applyPenalty(event, level);
          applied.add(level.id);
        }
      });
    }
    this.appliedEscalations.set(event.id, applied);
    this.notify();
    return this.getSnapshot();
  }

  applyPenalty(event, level) {
    this.score = Math.max(
      this.config.integrity.minimumScore,
      this.score - (Number.isFinite(level.deduction) ? level.deduction : 0),
    );
    if (level.warning) {
      this.warningManager.handleEvent({
        id: `${event.id}:${level.id}`,
        type: event.type,
        severity: level.id === 'violation-recorded' ? 'critical' : 'medium',
        timestamp: Date.now(),
        metadata: {
          message: `${level.label}: ${event.type.replaceAll('_', ' ').toLowerCase()} detected. Return to compliant exam conditions.`,
          integrityEventId: event.id,
          escalationLevel: level.id,
        },
      }, { warning: true });
    }
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
    this.appliedEscalations.clear();
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
