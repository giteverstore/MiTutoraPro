import { createHash } from 'node:crypto';
import { AIServiceError } from '../AIServiceError.js';

export class TutorRequestCoordinator {
  constructor({ maxEntries = 1_000 } = {}) {
    this.maxEntries = maxEntries;
    this.active = new Set();
  }

  async run(context, requestKey, task) {
    const fingerprint = createHash('sha256')
      .update(String(requestKey))
      .update(JSON.stringify(context))
      .digest('hex');
    if (this.active.has(fingerprint)) {
      throw new AIServiceError('ai/duplicate-request', 'This explanation is already in progress.', { status: 409 });
    }
    if (this.active.size >= this.maxEntries) {
      throw new AIServiceError('ai/rate-limited', 'The AI Tutor is busy right now. Try again shortly.', { status: 429 });
    }
    this.active.add(fingerprint);
    try {
      return await task();
    } finally {
      this.active.delete(fingerprint);
    }
  }
}

export const tutorRequestCoordinator = new TutorRequestCoordinator();

