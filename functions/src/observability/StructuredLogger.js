const PROHIBITED_KEYS = /password|token|credential|secret|answer|sourcecode|camera|microphone/i;

const sanitize = (value, depth = 0) => {
  if (depth > 4 || value == null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1));
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !PROHIBITED_KEYS.test(key))
    .map(([key, item]) => [key, sanitize(item, depth + 1)]));
};

export class StructuredLogger {
  constructor({ sink, component, environment = process.env.GCLOUD_PROJECT ? 'production' : 'local' }) {
    this.sink = sink; this.component = component; this.environment = environment;
  }

  emit(severity, event, fields = {}) {
    try {
      const method = severity === 'ERROR' ? 'error' : severity === 'WARNING' ? 'warn' : 'info';
      this.sink[method]?.(event, sanitize({ event, severity, component: this.component, environment: this.environment, ...fields }));
    } catch { /* telemetry must never break the business operation */ }
  }
  info(event, fields) { this.emit('INFO', event, fields); }
  warn(event, fields) { this.emit('WARNING', event, fields); }
  error(event, fields) { this.emit('ERROR', event, fields); }
}

export const stableErrorCode = (error) => typeof error?.code === 'string' ? error.code : 'UNEXPECTED_ERROR';
