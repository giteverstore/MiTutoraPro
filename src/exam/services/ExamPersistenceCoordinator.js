export const EXAM_SYNC_STATUS = Object.freeze({ SYNCED: 'SYNCED', SYNCING: 'SYNCING', OFFLINE: 'OFFLINE', ERROR: 'ERROR' });

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.keys(value).sort().reduce((result, key) => { if (value[key] !== undefined) result[key] = stable(value[key]); return result; }, {});
  return value;
}
const serialize = (value) => JSON.stringify(stable(value));
const isOnline = () => globalThis.navigator?.onLine !== false;

const ALLOWED_MEASUREMENTS = new Set(['yaw', 'pitch', 'roll', 'faceCount', 'poseStatus', 'condition', 'status', 'count']);
function allowedMeasurements(value = {}) {
  return Object.fromEntries(Object.entries(value).filter(([key, item]) => ALLOWED_MEASUREMENTS.has(key) && (item == null || ['string', 'number', 'boolean'].includes(typeof item))).map(([key, item]) => [key, typeof item === 'string' ? item.slice(0, 64) : item]));
}

function eventDto(event) {
  const evidence = event.metadata?.evidence ?? {};
  return {
    id: event.id, type: event.type, status: event.status,
    startedAt: event.startedAt, endedAt: event.endedAt,
    durationMs: event.duration ?? 0, severity: event.metadata?.severity ?? 'medium',
    warningLevel: event.metadata?.escalationLevel ?? '', detectorId: event.metadata?.detector ?? evidence.detectorId ?? '',
    detectorVersion: evidence.version ?? '', modelVersion: event.metadata?.modelVersion ?? '',
    evidence: {
      detectorId: evidence.detectorId ?? '', type: evidence.type ?? '', confidence: evidence.confidence ?? null,
      stability: evidence.stability ?? 0, quality: evidence.quality ?? 0, durationMs: evidence.durationMs ?? evidence.duration ?? 0,
      version: evidence.version ?? '', labels: [...(evidence.labels ?? [])].slice(0, 8),
      measurements: allowedMeasurements(evidence.measurements ?? evidence.metadata),
    },
  };
}

export class ExamPersistenceCoordinator {
  constructor({ service, attemptId, sessionId, revision = 0, eventSequence = 0, debounceMs = 750, eventDebounceMs = 1000, heartbeatMs = 15000, scheduler = globalThis, onStatus = () => {} }) {
    this.service = service; this.attemptId = attemptId; this.sessionId = sessionId; this.revision = revision;
    this.debounceMs = debounceMs; this.eventDebounceMs = eventDebounceMs; this.heartbeatMs = heartbeatMs; this.scheduler = scheduler; this.onStatus = onStatus;
    this.responseTimer = null; this.eventTimer = null; this.heartbeatTimer = null; this.heartbeatPromise = null; this.pendingResponse = null; this.pendingEvents = new Map(); this.persistedEventStates = new Map(); this.lastResponse = null; this.responsePromise = null; this.eventPromise = null; this.heartbeatSequence = 0; this.eventSequence = eventSequence; this.destroyed = false;
    this.handleOnline = () => { this.flushAll().catch(() => undefined); };
    globalThis.addEventListener?.('online', this.handleOnline);
  }

  notify(status, message = '') { this.onStatus(Object.freeze({ status, message })); }
  updateSession(attemptId, sessionId, revision = this.revision) { this.attemptId = attemptId; this.sessionId = sessionId; this.revision = Math.max(this.revision, revision ?? 0); }

  scheduleResponses(answers, currentQuestionId) {
    if (this.destroyed || !this.attemptId || !this.sessionId) return;
    const value = { answers: { ...answers }, currentQuestionId };
    if (serialize(value) === this.lastResponse || serialize(value) === serialize(this.pendingResponse)) return;
    this.pendingResponse = value; if (this.responseTimer) this.scheduler.clearTimeout(this.responseTimer);
    this.responseTimer = this.scheduler.setTimeout(() => this.flushResponses().catch(() => undefined), this.debounceMs);
  }

  async flushResponses() {
    if (this.responsePromise) return this.responsePromise;
    if (!this.pendingResponse) return null;
    const payload = this.pendingResponse; this.pendingResponse = null; this.responseTimer = null;
    const revision = this.revision + 1; this.notify(EXAM_SYNC_STATUS.SYNCING, 'Saving answers…');
    this.responsePromise = this.service.saveResponses({ attemptId: this.attemptId, sessionId: this.sessionId, ...payload, revision })
      .then((saved) => { this.revision = saved.revision; this.lastResponse = serialize(payload); this.notify(EXAM_SYNC_STATUS.SYNCED, 'Answers saved'); return saved; })
      .catch((error) => { this.pendingResponse = payload; this.notify(isOnline() ? EXAM_SYNC_STATUS.ERROR : EXAM_SYNC_STATUS.OFFLINE, isOnline() ? error.message : 'Connection lost. Answers are waiting to synchronize.'); throw error; })
      .finally(() => { this.responsePromise = null; });
    return this.responsePromise;
  }

  scheduleIntegrityEvents(events) {
    if (this.destroyed || !this.attemptId || !this.sessionId) return;
    events.forEach((event) => {
      const dto = eventDto(event);
      const lifecycleSignature = serialize({ status: dto.status, endedAt: dto.endedAt, severity: dto.severity, warningLevel: dto.warningLevel });
      if (this.persistedEventStates.get(dto.id) !== lifecycleSignature) this.pendingEvents.set(dto.id, { dto, lifecycleSignature });
    });
    if (this.eventTimer) return;
    this.eventTimer = this.scheduler.setTimeout(() => this.flushIntegrityEvents().catch(() => undefined), this.eventDebounceMs);
  }

  async flushIntegrityEvents() {
    if (this.eventPromise) return this.eventPromise;
    const entries = [...this.pendingEvents.values()]; if (!entries.length) return null;
    entries.forEach((entry, index) => { if (!entry.sequence) entry.sequence = this.eventSequence + index + 1; });
    const events = entries.map(({ dto, sequence }) => ({ ...dto, sequence }));
    const startSequence = entries[0].sequence; const endSequence = entries.at(-1).sequence;
    this.pendingEvents.clear(); this.eventTimer = null; this.notify(EXAM_SYNC_STATUS.SYNCING, 'Synchronizing integrity events…');
    this.eventPromise = this.service.saveIntegrityEvents({ attemptId: this.attemptId, sessionId: this.sessionId, events, startSequence, endSequence })
      .then((result) => { this.eventSequence = Math.max(this.eventSequence, result.lastSequence ?? endSequence); entries.forEach(({ dto, lifecycleSignature }) => this.persistedEventStates.set(dto.id, lifecycleSignature)); this.notify(EXAM_SYNC_STATUS.SYNCED, 'Exam synchronized'); return result; })
      .catch((error) => { entries.forEach((entry) => { if (!this.pendingEvents.has(entry.dto.id)) this.pendingEvents.set(entry.dto.id, entry); }); this.notify(isOnline() ? EXAM_SYNC_STATUS.ERROR : EXAM_SYNC_STATUS.OFFLINE, isOnline() ? error.message : 'Connection lost. Integrity events are waiting to synchronize.'); throw error; })
      .finally(() => { this.eventPromise = null; });
    return this.eventPromise;
  }

  startHeartbeat(initialSequence = 0) {
    this.heartbeatSequence = Math.max(this.heartbeatSequence, initialSequence);
    if (this.heartbeatTimer) return;
    this.heartbeatPromise = this.sendHeartbeat();
    this.heartbeatTimer = this.scheduler.setInterval(() => { this.heartbeatPromise = this.sendHeartbeat(); }, this.heartbeatMs);
  }

  async sendHeartbeat() {
    if (!this.attemptId || !this.sessionId || this.destroyed) return null;
    const sequence = this.heartbeatSequence + 1;
    try { const result = await this.service.heartbeat(this.attemptId, this.sessionId, sequence); this.heartbeatSequence = sequence; return result; }
    catch (error) { this.notify(isOnline() ? EXAM_SYNC_STATUS.ERROR : EXAM_SYNC_STATUS.OFFLINE, isOnline() ? error.message : 'Connection lost. Your exam is being protected. Reconnecting…'); return null; }
  }

  async flushAll() {
    if (this.heartbeatPromise) await this.heartbeatPromise;
    do { await this.flushResponses(); } while (this.pendingResponse);
    do { await this.flushIntegrityEvents(); } while (this.pendingEvents.size);
  }
  getTelemetrySequence() { return this.eventSequence; }
  stopHeartbeat() { if (this.heartbeatTimer) this.scheduler.clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
  destroy() { this.destroyed = true; globalThis.removeEventListener?.('online', this.handleOnline); if (this.responseTimer) this.scheduler.clearTimeout(this.responseTimer); if (this.eventTimer) this.scheduler.clearTimeout(this.eventTimer); this.stopHeartbeat(); }
}
