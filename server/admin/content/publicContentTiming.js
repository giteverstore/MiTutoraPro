import { AsyncLocalStorage } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';

const storage = new AsyncLocalStorage();
const metricOrder = Object.freeze(['wif', 'client', 'query', 'project', 'total']);
const allowedMetrics = new Set(metricOrder);

export function runWithPublicContentTiming(enabled, action) {
  return enabled
    ? storage.run({ startedAt: performance.now(), durations: new Map() }, action)
    : action();
}

function record(metric, startedAt) {
  const context = storage.getStore();
  if (!context || !allowedMetrics.has(metric) || metric === 'total') return;
  const duration = performance.now() - startedAt;
  if (!Number.isFinite(duration) || duration < 0) return;
  context.durations.set(metric, (context.durations.get(metric) ?? 0) + duration);
}

export async function timePublicContent(metric, action) {
  const startedAt = performance.now();
  try { return await action(); }
  finally { record(metric, startedAt); }
}

export function timePublicContentSync(metric, action) {
  const startedAt = performance.now();
  try { return action(); }
  finally { record(metric, startedAt); }
}

export function setPublicContentTimingHeader(response, { success = true } = {}) {
  const context = storage.getStore();
  if (!context) return;
  const total = performance.now() - context.startedAt;
  const values = success
    ? metricOrder.filter((metric) => metric !== 'total' && context.durations.has(metric))
      .map((metric) => `${metric};dur=${context.durations.get(metric).toFixed(1)}`)
    : [];
  values.push(`total;dur=${Math.max(0, total).toFixed(1)}`);
  response.setHeader('Server-Timing', values.join(', '));
}
