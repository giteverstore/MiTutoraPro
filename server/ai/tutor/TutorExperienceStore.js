import { AIServiceError } from '../AIServiceError.js';

const retained = (value) => JSON.parse(JSON.stringify(value));
const exhausted = () => new AIServiceError('ai/included-messages-exhausted', 'Your included AI Tutor messages have been used.', { status: 429 });

export class ProcessLocalTutorExperienceStore {
  constructor({ now = Date.now } = {}) { this.now = now; this.usage = new Map(); this.reservations = new Map(); this.threads = new Map(); this.analytics = []; this.cache = new Map(); }
  async reserveIncluded({ ownerKey, requestId, limit, unlimited }) {
    const existing = this.reservations.get(requestId);
    if (existing) {
      if (existing.ownerKey !== ownerKey) throw new AIServiceError('ai/idempotency-conflict', 'The AI Tutor request could not be safely resumed.', { status: 409 });
      return existing;
    }
    const current = this.usage.get(ownerKey) ?? { usedMessages: 0, reservedMessages: 0 };
    if (!unlimited && current.usedMessages + current.reservedMessages >= limit) throw exhausted();
    const reservation = { ownerKey, requestId, state: 'PENDING', unlimited, createdAt: this.now() };
    this.reservations.set(requestId, reservation);
    if (!unlimited) this.usage.set(ownerKey, { ...current, reservedMessages: current.reservedMessages + 1 });
    return reservation;
  }
  async settleIncluded(reservation, { consume }) {
    const stored = this.reservations.get(reservation?.requestId); if (!stored || stored.state !== 'PENDING') return this.snapshot(stored?.ownerKey);
    const current = this.usage.get(stored.ownerKey) ?? { usedMessages: 0, reservedMessages: 0 };
    if (!stored.unlimited) this.usage.set(stored.ownerKey, { usedMessages: current.usedMessages + (consume ? 1 : 0), reservedMessages: Math.max(0, current.reservedMessages - 1) });
    this.reservations.set(stored.requestId, { ...stored, state: consume ? 'CONSUMED' : 'RELEASED', settledAt: this.now() });
    return this.snapshot(stored.ownerKey);
  }
  snapshot(ownerKey) { return this.usage.get(ownerKey) ?? { usedMessages: 0, reservedMessages: 0 }; }
  async usageSnapshot(ownerKey) { return this.snapshot(ownerKey); }
  threadKey(ownerKey, scope) { return `${ownerKey}\0${scope.surface}\0${scope.scopeId}`; }
  async persistInteraction({ ownerKey, requestId, scope, userText, assistant, metadata }) {
    if (scope.surface === 'practice') { if (!this.analytics.some((item) => item.requestId === requestId)) this.analytics.push(retained({ ownerKey, requestId, scope, metadata, createdAt: this.now() })); return; }
    const key = this.threadKey(ownerKey, scope); const messages = this.threads.get(key) ?? [];
    if (messages.some((item) => item.requestId === requestId)) return;
    const createdAt = this.now() * 1_000 + messages.length; messages.push({ id: `${requestId}-user`, requestId, role: 'user', text: userText, createdAt, activityId: scope.activityId, contentVersion: scope.contentVersion }, { id: `${requestId}-assistant`, requestId, role: 'assistant', response: retained(assistant), createdAt: createdAt + 1, activityId: scope.activityId, contentVersion: scope.contentVersion }); this.threads.set(key, messages);
  }
  async history({ ownerKey, scope, limit = 5, before }) { const all = this.threads.get(this.threadKey(ownerKey, scope)) ?? []; const end = before == null ? all.length : all.findIndex((item) => item.id === before); const safeEnd = end < 0 ? 0 : end; const items = all.slice(Math.max(0, safeEnd - limit), safeEnd); return { items: retained(items), nextCursor: safeEnd - limit > 0 ? items[0]?.id : null }; }
  async getCache(key) { return retained(this.cache.get(key) ?? null); }
  async putCache(key, entry) { if (!this.cache.has(key)) this.cache.set(key, retained(entry)); }
}
