import { AsyncLocalStorage } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';

const context = new AsyncLocalStorage();
const stages = Object.freeze([
  'handler', 'credential_setup', 'wif', 'firestore_client', 'storage_client',
  'catalog_query', 'catalog_map', 'pointer_get', 'version_get',
  'artifact_read', 'parse',
]);
const allowed = new Set(stages);

export function runWithPublicContentTiming(enabled, action) {
  return enabled ? context.run({ started: performance.now(), durations: new Map() }, action) : action();
}

export function recordPublicCatalogCount(count) {
  const active = context.getStore();
  if (active && Number.isInteger(count) && count >= 0 && count <= 100) active.catalogDocuments = count;
}

export function observePublicResponseFinish(response) {
  const active = context.getStore();
  if (!active || typeof response.once !== 'function') return;
  response.once('finish', () => {
    const total = performance.now() - active.started;
    if (!Number.isFinite(total) || total < 0) return;
    console.info(JSON.stringify({ operation: 'admin-public-response-finish', totalMs: Number(total.toFixed(2)) }));
  });
}

function record(stage, started) {
  const active = context.getStore();
  if (!active || !allowed.has(stage)) return;
  const elapsed = performance.now() - started;
  if (!Number.isFinite(elapsed) || elapsed < 0) return;
  active.durations.set(stage, (active.durations.get(stage) ?? 0) + elapsed);
}

export function timePublicSync(stage, action) {
  const started = performance.now();
  try { return action(); }
  finally { record(stage, started); }
}

export async function timePublic(stage, action) {
  const started = performance.now();
  try { return await action(); }
  finally { record(stage, started); }
}

export function setPublicContentTimingHeader(response) {
  const active = context.getStore();
  if (!active) return;
  record('handler', active.started);
  const value = stages.filter((stage) => active.durations.has(stage))
    .map((stage) => `${stage};dur=${active.durations.get(stage).toFixed(2)}`).join(', ');
  response.setHeader('Server-Timing', value);
  if (active.catalogDocuments !== undefined) {
    console.info(JSON.stringify({ operation: 'admin-public-catalog-timing', documents: active.catalogDocuments, serverTiming: value }));
  }
}
