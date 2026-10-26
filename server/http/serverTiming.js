import { performance } from 'node:perf_hooks';

const APPROVED_METRICS = new Set([
  'total',
  'wif',
  'auth',
  'client',
  'claim',
  'premium',
  'scope',
  'history',
  'usage',
]);

function approvedName(name) {
  if (typeof name !== 'string' || !APPROVED_METRICS.has(name)) {
    throw new TypeError('Server timing metric name is not approved.');
  }
  return name;
}

function duration(value) {
  return Math.max(0, value).toFixed(1);
}

export function createServerTiming({ now = () => performance.now() } = {}) {
  const startedAt = now();
  const metrics = new Map();

  function start(name) {
    const metricName = approvedName(name);
    if (metricName === 'total') throw new TypeError('The total metric is managed by the timing utility.');
    const stageStartedAt = now();
    let finished = false;
    return function finish() {
      if (finished) return;
      finished = true;
      metrics.set(metricName, now() - stageStartedAt);
    };
  }

  function apply(response, { include } = {}) {
    const selected = include == null
      ? [...metrics.keys()]
      : include.map(approvedName).filter((name) => name !== 'total' && metrics.has(name));
    const entries = selected.map((name) => `${name};dur=${duration(metrics.get(name))}`);
    entries.push(`total;dur=${duration(now() - startedAt)}`);

    const current = response?.getHeader?.('Server-Timing');
    const prefix = typeof current === 'string' && current.trim() ? `${current.trim()}, ` : '';
    response?.setHeader?.('Server-Timing', `${prefix}${entries.join(', ')}`);
  }

  return Object.freeze({ start, apply });
}
