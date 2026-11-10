import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const audit = JSON.parse(await readFile(path.join(root, 'docs/compiler-audit/q250-mode-b-execution-shapes.json'), 'utf8'));
const acceptance = JSON.parse(await readFile(path.join(root, 'docs/compiler-audit/mode-b-low-risk-batch-runtime-matrix.json'), 'utf8'));
const selectedIds = ['BLIND150-009', 'BLIND150-027', 'BLIND150-099', 'BLIND150-111', 'BLIND150-123'];
const selected = selectedIds.map((id) => {
  const record = audit.records.find((entry) => entry.id === id);
  const matrix = acceptance.matrix[id];
  return {
    id,
    title: record.title,
    category: record.category,
    inputShapes: record.inputShapes,
    outputShape: record.outputShape,
    comparator: 'exact',
    adapterFamily: 'plain-return',
    reason: 'Exact scalar result with scalar and/or flat integer-array inputs; no mutation, state, identity, or special serialization.',
    acceptance: Object.fromEntries(Object.entries(matrix).map(([language, result]) => [language, { status: result.allPassed ? 'PASS' : 'FAIL', fixtures: `${result.passed}/${result.fixtures}`, wallTimeMs: result.wallTimeMs, executionTimeMs: result.executionTimeMs, outputBytes: result.outputBytes }])),
    activationDecision: Object.values(matrix).every(({ allPassed, passed, fixtures }) => allPassed && passed === 3 && fixtures === 3) ? 'activate' : 'defer',
  };
});
const deferred = ['BLIND150-007', 'BLIND150-013', 'BLIND150-014', 'BLIND150-020', 'BLIND150-024', 'BLIND150-025', 'BLIND150-026', 'BLIND150-029', 'BLIND150-030', 'BLIND150-061'].map((id) => {
  const record = audit.records.find((entry) => entry.id === id);
  return { id, title: record.title, reason: record.outputShape === 'array' ? 'Deferred until generic native flat-array return serialization is accepted.' : 'Qualified exact scalar candidate deferred to keep the first native-generic rollout bounded.' };
});
const artifact = { schemaVersion: 'practice-mode-b-low-risk-rollout-v1', previousActive: 8, newlyActivated: selected.filter(({ activationDecision }) => activationDecision === 'activate').map(({ id }) => id), totalActive: 13, remainingInactive: 237, selected, deferred };
await writeFile(path.join(root, 'docs/compiler-audit/mode-b-low-risk-rollout.json'), `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({ newlyActivated: artifact.newlyActivated, totalActive: artifact.totalActive, deferred: deferred.length }, null, 2));
