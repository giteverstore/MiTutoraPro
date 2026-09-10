const SAFE_ALERT_FIELDS = new Set(['type', 'severity', 'windowMs', 'observed', 'threshold', 'provider', 'model', 'policyVersion']);

export function createTutorAlertEvent(value) {
  const event = {};
  for (const [key, item] of Object.entries(value ?? {})) {
    if (SAFE_ALERT_FIELDS.has(key) && ['string', 'number', 'boolean'].includes(typeof item)) event[key] = item;
  }
  return Object.freeze(event);
}

export class TutorAlertSink {
  emit() {}
}

export class NoopTutorAlertSink extends TutorAlertSink {}

export class InMemoryTutorAlertEvaluator {
  constructor({ sink = new NoopTutorAlertSink(), now = Date.now, policies = {} } = {}) {
    this.sink = sink;
    this.now = now;
    this.policies = Object.freeze({
      providerFailures: { windowMs: 300_000, threshold: 10, ...policies.providerFailures },
      serverErrors: { windowMs: 300_000, threshold: 10, ...policies.serverErrors },
      quotaExhaustion: { windowMs: 300_000, threshold: 20, ...policies.quotaExhaustion },
      requestVolume: { windowMs: 60_000, threshold: 500, ...policies.requestVolume },
      highLatency: { windowMs: 300_000, threshold: 10, latencyMs: 20_000, ...policies.highLatency },
      unsafeResponses: { windowMs: 300_000, threshold: 5, ...policies.unsafeResponses },
      providerTimeouts: { windowMs: 300_000, threshold: 5, ...policies.providerTimeouts },
      estimatedCostMicros: { windowMs: 86_400_000, threshold: null, ...policies.estimatedCostMicros },
    });
    this.samples = [];
    this.lastEmitted = new Map();
  }

  record(event) {
    const timestamp = this.now();
    const maximumWindow = Math.max(...Object.values(this.policies).map((policy) => policy.windowMs));
    this.samples = this.samples.filter((sample) => timestamp - sample.timestamp <= maximumWindow);
    this.samples.push({ timestamp, event });
    this.evaluate(timestamp);
  }

  evaluate(now) {
    this.check('request-volume', 'warning', this.policies.requestVolume, () => true, now);
    this.check('provider-failure-spike', 'high', this.policies.providerFailures, (event) => event.errorCategory?.startsWith('ai/provider-'), now);
    this.check('http-5xx-spike', 'high', this.policies.serverErrors, (event) => Number(event.httpStatus) >= 500, now);
    this.check('quota-exhaustion-spike', 'warning', this.policies.quotaExhaustion, (event) => event.errorCategory === 'ai/rate-limited', now);
    this.check('latency-degradation', 'warning', this.policies.highLatency, (event) => Number(event.latencyMs) >= this.policies.highLatency.latencyMs, now);
    this.check('unsafe-response-rate', 'high', this.policies.unsafeResponses, (event) => event.errorCategory === 'ai/unsafe-response', now);
    this.check('provider-timeout-rate', 'high', this.policies.providerTimeouts, (event) => event.errorCategory === 'ai/provider-timeout', now);
    const costPolicy = this.policies.estimatedCostMicros;
    if (costPolicy.threshold != null) {
      const samples = this.window(costPolicy, now);
      const observed = samples.reduce((sum, sample) => sum + (Number(sample.event.estimatedCostMicros) || 0), 0);
      if (observed >= costPolicy.threshold) this.emitOnce('estimated-cost-threshold', 'high', costPolicy, observed, now);
    }
  }

  window(policy, now) {
    return this.samples.filter((sample) => now - sample.timestamp <= policy.windowMs);
  }

  check(type, severity, policy, predicate, now) {
    const observed = this.window(policy, now).filter((sample) => predicate(sample.event)).length;
    if (observed >= policy.threshold) this.emitOnce(type, severity, policy, observed, now);
  }

  emitOnce(type, severity, policy, observed, now) {
    const last = this.lastEmitted.get(type) ?? -Infinity;
    if (now - last < policy.windowMs) return;
    this.lastEmitted.set(type, now);
    this.sink.emit(createTutorAlertEvent({ type, severity, windowMs: policy.windowMs, threshold: policy.threshold, observed }));
  }
}

