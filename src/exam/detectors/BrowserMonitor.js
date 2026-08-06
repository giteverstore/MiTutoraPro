import { ExamEvent, EXAM_EVENT_TYPES, EXAM_SEVERITIES } from '../models/ExamEvent.js';

export class BrowserMonitor {
  constructor({ eventBus, config, windowObject = window, documentObject = document }) {
    this.eventBus = eventBus;
    this.config = config;
    this.window = windowObject;
    this.document = documentObject;
    this.started = false;
    this.paused = false;
    this.hiddenAt = null;
    this.handlers = {
      visibilitychange: () => this.handleVisibilityChange(),
      blur: () => this.emit(EXAM_EVENT_TYPES.WINDOW_BLUR, EXAM_SEVERITIES.MEDIUM),
      focus: () => this.emit(EXAM_EVENT_TYPES.CUSTOM, EXAM_SEVERITIES.INFO, { action: 'WINDOW_FOCUS' }),
      fullscreenchange: () => this.handleFullscreenChange(),
      copy: () => this.handleRestrictedAction(EXAM_EVENT_TYPES.COPY, this.config.browser.allowCopyPaste),
      paste: () => this.handleRestrictedAction(EXAM_EVENT_TYPES.PASTE, this.config.browser.allowCopyPaste),
      contextmenu: () => this.handleRestrictedAction(EXAM_EVENT_TYPES.RIGHT_CLICK, this.config.browser.allowRightClick),
    };
  }

  start() {
    if (this.started) return;
    this.document.addEventListener('visibilitychange', this.handlers.visibilitychange);
    this.window.addEventListener('blur', this.handlers.blur);
    this.window.addEventListener('focus', this.handlers.focus);
    this.document.addEventListener('fullscreenchange', this.handlers.fullscreenchange);
    this.document.addEventListener('copy', this.handlers.copy);
    this.document.addEventListener('paste', this.handlers.paste);
    this.document.addEventListener('contextmenu', this.handlers.contextmenu);
    this.started = true;
  }

  stop() {
    if (!this.started) return;
    this.document.removeEventListener('visibilitychange', this.handlers.visibilitychange);
    this.window.removeEventListener('blur', this.handlers.blur);
    this.window.removeEventListener('focus', this.handlers.focus);
    this.document.removeEventListener('fullscreenchange', this.handlers.fullscreenchange);
    this.document.removeEventListener('copy', this.handlers.copy);
    this.document.removeEventListener('paste', this.handlers.paste);
    this.document.removeEventListener('contextmenu', this.handlers.contextmenu);
    this.hiddenAt = null;
    this.started = false;
  }

  pause() {
    if (!this.started) return;
    this.stop();
    this.paused = true;
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.start();
  }

  reset() {
    this.hiddenAt = null;
  }

  getStatus() {
    return Object.freeze({ status: this.started ? 'RUNNING' : this.paused ? 'PAUSED' : 'STOPPED' });
  }

  destroy() {
    this.stop();
  }

  handleVisibilityChange() {
    if (this.document.hidden) {
      this.hiddenAt = Date.now();
      this.emit(EXAM_EVENT_TYPES.TAB_SWITCH, EXAM_SEVERITIES.HIGH, { hidden: true });
      return;
    }
    if (this.hiddenAt) {
      this.emit(EXAM_EVENT_TYPES.CUSTOM, EXAM_SEVERITIES.INFO, {
        action: 'TAB_RETURN',
        hiddenDurationMs: Date.now() - this.hiddenAt,
      });
      this.hiddenAt = null;
    }
  }

  handleFullscreenChange() {
    if (this.config.browser.fullscreenRequired && !this.document.fullscreenElement) {
      this.emit(EXAM_EVENT_TYPES.FULLSCREEN_EXIT, EXAM_SEVERITIES.HIGH);
    } else if (this.document.fullscreenElement) {
      this.emit(EXAM_EVENT_TYPES.CUSTOM, EXAM_SEVERITIES.INFO, { action: 'FULLSCREEN_RESTORED' });
    }
  }

  handleRestrictedAction(type, allowed) {
    if (!allowed) this.emit(type, EXAM_SEVERITIES.MEDIUM);
  }

  emit(type, severity, metadata = {}) {
    return this.eventBus.emit(new ExamEvent({ type, severity, metadata }));
  }
}
