import { createHash, randomBytes } from 'node:crypto';
import { AIServiceError } from '../AIServiceError.js';

const PROCESS_SALT = randomBytes(16);

export class InMemoryTutorRateLimiter {
  constructor({ windowMs = 60_000, maxRequests = 30, maxKeys = 2_000, now = Date.now } = {}) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.maxKeys = maxKeys;
    this.now = now;
    this.entries = new Map();
  }

  assertAllowed(key) {
    const currentTime = this.now();
    const current = (this.entries.get(key) ?? []).filter((timestamp) => currentTime - timestamp < this.windowMs);
    if (current.length >= this.maxRequests) {
      this.entries.set(key, current);
      throw new AIServiceError('ai/rate-limited', 'The AI Tutor is busy right now. Try again shortly.', { status: 429 });
    }
    current.push(currentTime);
    this.entries.set(key, current);
    if (this.entries.size > this.maxKeys) this.entries.delete(this.entries.keys().next().value);
  }
}

export function createTutorRequestKey(request) {
  const address = request?.socket?.remoteAddress || 'local';
  return createHash('sha256').update(PROCESS_SALT).update(String(address)).digest('hex');
}

export function createTutorIdentityKey(uid, trustedNetworkKey = '') {
  return createHash('sha256')
    .update(PROCESS_SALT)
    .update(String(uid))
    .update('\0')
    .update(String(trustedNetworkKey))
    .digest('hex');
}

export const tutorRateLimiter = new InMemoryTutorRateLimiter();
