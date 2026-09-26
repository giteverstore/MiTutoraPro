export class BoundedExecutor {
  constructor(executor, { maxActive = 4, maxQueued = 8, queueTimeoutMs = 2_000 } = {}) { this.executor = executor; this.maxActive = maxActive; this.maxQueued = maxQueued; this.queueTimeoutMs = queueTimeoutMs; this.active = 0; this.queue = []; }
  async execute(request) {
    if (this.active >= this.maxActive) {
      if (this.queue.length >= this.maxQueued) throw new Error('runner_busy');
      await new Promise((resolve, reject) => { const item = { resolve, timer: setTimeout(() => { this.queue = this.queue.filter((entry) => entry !== item); reject(new Error('runner_busy')); }, this.queueTimeoutMs) }; this.queue.push(item); });
    }
    this.active += 1;
    try { return await this.executor.execute(request); }
    finally { this.active -= 1; const next = this.queue.shift(); if (next) { clearTimeout(next.timer); next.resolve(); } }
  }
}
