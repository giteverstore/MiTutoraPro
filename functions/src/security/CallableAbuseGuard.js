import { Timestamp } from 'firebase-admin/firestore';

const DEFAULT_LIMITS = Object.freeze({ limit: 60, windowMs: 60_000 });

export const CALLABLE_LIMITS = Object.freeze({
  read: Object.freeze({ limit: 120, windowMs: 60_000 }),
  attemptCreate: Object.freeze({ limit: 5, windowMs: 10 * 60_000 }),
  verification: Object.freeze({ limit: 20, windowMs: 10 * 60_000 }),
  heartbeat: Object.freeze({ limit: 180, windowMs: 60_000 }),
  responses: Object.freeze({ limit: 120, windowMs: 60_000 }),
  integrity: Object.freeze({ limit: 120, windowMs: 60_000 }),
  submission: Object.freeze({ limit: 10, windowMs: 10 * 60_000 }),
  completion: Object.freeze({ limit: 120, windowMs: 10 * 60_000 }),
  review: Object.freeze({ limit: 30, windowMs: 10 * 60_000 }),
});

const safeSegment = (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);

export class CallableAbuseGuard {
  constructor({ db, now = () => Date.now() }) {
    this.db = db;
    this.now = now;
  }

  async enforce(uid, operation, limits = DEFAULT_LIMITS) {
    const nowMs = this.now();
    const windowStartMs = Math.floor(nowMs / limits.windowMs) * limits.windowMs;
    const reference = this.db.doc(`callableRateLimits/${safeSegment(uid)}_${safeSegment(operation)}_${windowStartMs}`);
    return this.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const count = snapshot.exists ? snapshot.data().count ?? 0 : 0;
      if (count >= limits.limit) {
        const error = new Error('Too many requests. Please wait and try again.');
        error.code = 'resource-exhausted';
        throw error;
      }
      transaction.set(reference, {
        uid,
        operation,
        count: count + 1,
        windowStartedAt: Timestamp.fromMillis(windowStartMs),
        expiresAt: Timestamp.fromMillis(windowStartMs + limits.windowMs * 2),
        updatedAt: Timestamp.fromMillis(nowMs),
      });
      return { remaining: limits.limit - count - 1 };
    });
  }
}

export function callableOptions() {
  const enforceAppCheck = process.env.ENFORCE_CERTIFICATION_APP_CHECK === 'true'
    && process.env.FUNCTIONS_EMULATOR !== 'true';
  return enforceAppCheck ? { enforceAppCheck: true, consumeAppCheckToken: true } : {};
}
