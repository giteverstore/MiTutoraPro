function identifier() { return globalThis.crypto?.randomUUID?.() ?? `submission-${Date.now()}-${Math.random().toString(36).slice(2)}`; }

export class SubmissionCoordinator {
  constructor({ service, persistence, attemptId, sessionId, storage = globalThis.sessionStorage }) {
    this.service = service; this.persistence = persistence; this.attemptId = attemptId; this.sessionId = sessionId; this.storage = storage; this.promise = null;
    this.storageKey = `mitutora:exam-submission:${attemptId}`;
    this.submissionId = this.storage?.getItem(this.storageKey) ?? identifier();
    this.storage?.setItem(this.storageKey, this.submissionId);
  }

  submit(reason = 'MANUAL') {
    if (this.promise) return this.promise;
    this.promise = Promise.resolve().then(async () => {
      await this.persistence.flushAll();
      const result = await this.service.submit({ attemptId: this.attemptId, sessionId: this.sessionId, submissionId: this.submissionId, reason, telemetryFinalSequence: this.persistence.getTelemetrySequence() });
      this.storage?.removeItem(this.storageKey); return result;
    });
    this.promise.catch(() => { this.promise = null; });
    return this.promise;
  }
}
