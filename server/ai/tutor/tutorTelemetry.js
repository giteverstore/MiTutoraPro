import { RESPONSE_SCHEMA_VERSION, TUTOR_POLICY_VERSION } from './tutorConfig.js';
import { InMemoryTutorAlertEvaluator } from './tutorAlerts.js';

const ALLOWED_FIELDS = new Set([
  'event', 'eventVersion', 'policyVersion', 'schemaVersion', 'provider', 'model', 'operation',
  'latencyMs', 'success', 'httpStatus', 'retryable', 'errorCategory', 'responseBytes',
  'inputTokens', 'outputTokens', 'totalTokens', 'estimatedCostMicros', 'costKnown',
  'quotaDecision', 'featureFlagState', 'rolloutBucket', 'rolloutVersion',
]);
const ALLOWED_TYPES = new Set(['string', 'number', 'boolean']);

export function createTutorTelemetryEvent(fields) {
  const event = {
    event: 'ai_tutor.request',
    eventVersion: '1',
    policyVersion: TUTOR_POLICY_VERSION,
    schemaVersion: RESPONSE_SCHEMA_VERSION,
  };
  for (const [key, value] of Object.entries(fields ?? {})) {
    if (ALLOWED_FIELDS.has(key) && ALLOWED_TYPES.has(typeof value) && (typeof value !== 'number' || Number.isFinite(value))) event[key] = value;
  }
  return Object.freeze(event);
}

export class TutorTelemetrySink {
  record() {}
}

export class NoopTutorTelemetrySink extends TutorTelemetrySink {}

export class StructuredTutorTelemetrySink extends TutorTelemetrySink {
  constructor({ write } = {}) {
    super();
    if (typeof write !== 'function') throw new TypeError('A structured telemetry writer is required.');
    this.write = write;
  }

  record(event) {
    return this.write(event);
  }
}

export class TutorTelemetry {
  constructor({ sink = new NoopTutorTelemetrySink(), onFailure = () => {} } = {}) {
    this.sink = typeof sink === 'function' ? { record: sink } : sink;
    this.onFailure = onFailure;
  }

  record(fields) {
    const event = createTutorTelemetryEvent(fields);
    try {
      const pending = this.sink.record(event);
      Promise.resolve(pending).catch(() => this.reportFailure());
    } catch {
      this.reportFailure();
    }
    return event;
  }

  reportFailure() {
    try { this.onFailure(Object.freeze({ type: 'telemetry-pipeline-failure', severity: 'high' })); }
    catch { /* Operational reporting must never alter tutor safety behavior. */ }
  }
}

export function createOperationalTutorTelemetry({ write, alertSink, alertPolicies, now } = {}) {
  const alerts = new InMemoryTutorAlertEvaluator({ sink: alertSink, policies: alertPolicies, now });
  const sink = new StructuredTutorTelemetrySink({
    write(event) {
      alerts.record(event);
      return write(event);
    },
  });
  return new TutorTelemetry({
    sink,
    onFailure: (event) => alertSink?.emit?.(event),
  });
}

export const tutorTelemetry = new TutorTelemetry();
