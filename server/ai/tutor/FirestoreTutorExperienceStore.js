import { AIServiceError } from '../AIServiceError.js';

const exhausted = () => new AIServiceError('ai/included-messages-exhausted', 'Your included AI Tutor messages have been used.', { status: 429 });
const retentionMs = 7 * 24 * 60 * 60 * 1_000;
const threadId = (ownerKey, scope) => `${ownerKey}_${scope.surface}_${scope.scopeId}`;

export class FirestoreTutorExperienceStore {
  constructor({ db, now = Date.now } = {}) { if (!db?.runTransaction) throw new TypeError('Tutor experience storage requires Firestore transactions.'); this.db = db; this.now = now; }
  async reserveIncluded({ ownerKey, requestId, limit, unlimited }) {
    const usageRef = this.db.collection('aiTutorIncludedUsage').doc(ownerKey); const reservationRef = this.db.collection('aiTutorIncludedReservations').doc(requestId); const now = this.now();
    return this.db.runTransaction(async (tx) => {
      const existing = await tx.get(reservationRef); if (existing.exists) { const value = existing.data(); if (value.ownerKey !== ownerKey) throw new AIServiceError('ai/idempotency-conflict', 'The AI Tutor request could not be safely resumed.', { status: 409 }); return value; }
      const snapshot = await tx.get(usageRef); const current = snapshot.exists ? snapshot.data() : { usedMessages: 0, reservedMessages: 0 };
      if (!unlimited && current.usedMessages + current.reservedMessages >= limit) throw exhausted();
      const reservation = { ownerKey, requestId, state: 'PENDING', unlimited, createdAt: now, expiresAt: new Date(now + retentionMs) };
      if (!unlimited) tx.set(usageRef, { usedMessages: current.usedMessages, reservedMessages: current.reservedMessages + 1, updatedAt: now }, { merge: false });
      tx.create(reservationRef, reservation); return reservation;
    });
  }
  async settleIncluded(reservation, { consume }) {
    if (!reservation?.requestId) return null; const reservationRef = this.db.collection('aiTutorIncludedReservations').doc(reservation.requestId); const usageRef = this.db.collection('aiTutorIncludedUsage').doc(reservation.ownerKey); const now = this.now();
    return this.db.runTransaction(async (tx) => {
      const [storedSnapshot, usageSnapshot] = await Promise.all([tx.get(reservationRef), tx.get(usageRef)]); if (!storedSnapshot.exists || storedSnapshot.data().state !== 'PENDING') return usageSnapshot.exists ? usageSnapshot.data() : { usedMessages: 0, reservedMessages: 0 };
      const stored = storedSnapshot.data(); if (stored.ownerKey !== reservation.ownerKey) throw new AIServiceError('ai/idempotency-conflict', 'The AI Tutor request could not be safely resumed.', { status: 409 });
      const current = usageSnapshot.exists ? usageSnapshot.data() : { usedMessages: 0, reservedMessages: 0 }; const next = stored.unlimited ? current : { usedMessages: current.usedMessages + (consume ? 1 : 0), reservedMessages: Math.max(0, current.reservedMessages - 1), updatedAt: now };
      if (!stored.unlimited) tx.set(usageRef, next, { merge: false }); tx.update(reservationRef, { state: consume ? 'CONSUMED' : 'RELEASED', settledAt: now }); return next;
    });
  }
  async usageSnapshot(ownerKey) { const snapshot = await this.db.collection('aiTutorIncludedUsage').doc(ownerKey).get(); return snapshot.exists ? snapshot.data() : { usedMessages: 0, reservedMessages: 0 }; }
  async persistInteraction({ ownerKey, requestId, scope, userText, assistant, metadata }) {
    if (scope.surface === 'practice') { const ref = this.db.collection('aiTutorPracticeInteractions').doc(requestId); await this.db.runTransaction(async (tx) => { if ((await tx.get(ref)).exists) return; tx.create(ref, { ownerKey, requestId, surface: scope.surface, scopeId: scope.scopeId, activityId: scope.activityId, contentVersion: scope.contentVersion, ...metadata, createdAt: this.now() }); }); return; }
    const threadRef = this.db.collection('aiTutorConversations').doc(threadId(ownerKey, scope)); const userRef = threadRef.collection('messages').doc(`${requestId}-user`); const assistantRef = threadRef.collection('messages').doc(`${requestId}-assistant`); const now = this.now();
    await this.db.runTransaction(async (tx) => { if ((await tx.get(assistantRef)).exists) return; tx.set(threadRef, { ownerKey, surface: scope.surface, scopeId: scope.scopeId, updatedAt: now, createdAt: now }, { merge: true }); tx.create(userRef, { role: 'user', text: userText, requestId, activityId: scope.activityId, contentVersion: scope.contentVersion, createdAt: now }); tx.create(assistantRef, { role: 'assistant', response: assistant, requestId, activityId: scope.activityId, contentVersion: scope.contentVersion, createdAt: now + 1 }); });
  }
  async history({ ownerKey, scope, limit = 5, before }) { const ref = this.db.collection('aiTutorConversations').doc(threadId(ownerKey, scope)); const thread = await ref.get(); if (!thread.exists || thread.data().ownerKey !== ownerKey || thread.data().surface !== scope.surface || thread.data().scopeId !== scope.scopeId) return { items: [], nextCursor: null }; let query = ref.collection('messages').orderBy('createdAt', 'desc').orderBy('__name__', 'desc'); if (before) { const cursor = await ref.collection('messages').doc(before).get(); if (!cursor.exists) throw new AIServiceError('ai/activity-invalid', 'The requested Tutor history is unavailable.', { status: 400 }); query = query.startAfter(cursor); } const snapshot = await query.limit(limit + 1).get(); const docs = snapshot.docs; const page = docs.slice(0, limit); return { items: page.map((doc) => ({ id: doc.id, ...doc.data() })).reverse(), nextCursor: docs.length > limit ? page[page.length - 1].id : null }; }
  async getCache(key) { const snapshot = await this.db.collection('aiTutorExactCache').doc(key).get(); return snapshot.exists ? snapshot.data() : null; }
  async putCache(key, entry) { const ref = this.db.collection('aiTutorExactCache').doc(key); await this.db.runTransaction(async (tx) => { if (!(await tx.get(ref)).exists) tx.create(ref, { ...entry, createdAt: this.now() }); }); }
}
