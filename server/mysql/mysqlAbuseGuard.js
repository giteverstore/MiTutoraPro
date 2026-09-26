import { MySqlExecutionError } from './MySqlExecutionError.js';

export class MySqlAbuseGuard {
  constructor({ maxRequests = 20, windowMs = 60_000, maxConcurrent = 4, now = Date.now } = {}) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.maxConcurrent = maxConcurrent;
    this.now = now;
    this.history = new Map();
    this.active = 0;
  }

  async run(uid, operation) {
    const currentTime = this.now();
    const recent = (this.history.get(uid) ?? []).filter((time) => currentTime - time < this.windowMs);
    if (recent.length >= this.maxRequests) throw new MySqlExecutionError('mysql/rate-limited', 'Too many MySQL executions. Try again shortly.', { status: 429 });
    if (this.active >= this.maxConcurrent) throw new MySqlExecutionError('mysql/busy', 'The MySQL learning runtime is busy. Try again shortly.', { status: 429 });
    recent.push(currentTime);
    this.history.set(uid, recent);
    this.active += 1;
    try { return await operation(); }
    finally { this.active -= 1; }
  }
}

export const mysqlAbuseGuard = new MySqlAbuseGuard();
