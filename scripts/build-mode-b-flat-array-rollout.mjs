import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const audit = JSON.parse(await readFile(path.join(root, 'docs/compiler-audit/q250-mode-b-execution-shapes.json'), 'utf8'));
const baseline = JSON.parse(await readFile(path.join(root, 'docs/compiler-audit/mode-b-flat-array-batch-runtime-matrix.json'), 'utf8'));
const corrected = JSON.parse(await readFile(path.join(root, 'docs/compiler-audit/mode-b-flat-array-java-r-runtime-matrix.json'), 'utf8'));
const selectedIds = ['BLIND150-007', 'BLIND150-013', 'BLIND150-014', 'BLIND150-020', 'BLIND150-024', 'BLIND150-025', 'BLIND150-026', 'BLIND150-029', 'BLIND150-030', 'BLIND150-061', 'BLIND150-100', 'BLIND150-101', 'BLIND150-102', 'BLIND150-106', 'BLIND150-107', 'BLIND150-109', 'BLIND150-110', 'BLIND150-122', 'BLIND150-124', 'BLIND150-140'];

for (const id of selectedIds) Object.assign(baseline.matrix[id], corrected.matrix[id]);
baseline.fixtureExecutions = selectedIds.length * 9 * 3;
for (const id of selectedIds) for (const [language, result] of Object.entries(baseline.matrix[id])) {
  if (!result.allPassed || result.passed !== 3 || result.fixtures !== 3) throw new Error(`${id}/${language} did not pass its activation gate.`);
}
await writeFile(path.join(root, 'docs/compiler-audit/mode-b-flat-array-batch-runtime-matrix.json'), `${JSON.stringify(baseline, null, 2)}\n`);

const selected = selectedIds.map((id) => {
  const record = audit.records.find((entry) => entry.id === id);
  return {
    id,
    title: record.title,
    inputShapes: record.inputShapes,
    outputShape: record.outputShape,
    adapterFamily: 'plain-return',
    comparator: 'exact',
    activationDecision: 'activate',
    acceptance: Object.fromEntries(Object.entries(baseline.matrix[id]).map(([language, value]) => [language, { status: 'PASS', fixtures: `${value.passed}/${value.fixtures}`, wallTimeMs: value.wallTimeMs, executionTimeMs: value.executionTimeMs }])),
  };
});
const futureCandidates = audit.records.filter(({ coverage, active }) => coverage === 'metadata-only-mapping' && !active).map(({ id, title, outputShape }) => ({ id, title, outputShape, decision: 'inactive', reason: 'Not selected for this bounded rollout; requires its own nine-language activation gate.' }));
const artifact = { schemaVersion: 'practice-mode-b-flat-array-rollout-v1', previousActive: 13, newlyActivated: selectedIds, totalActive: 33, remainingInactive: 217, selected, futureCandidates };
await writeFile(path.join(root, 'docs/compiler-audit/mode-b-flat-array-rollout.json'), `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({ newlyActivated: selectedIds.length, totalActive: artifact.totalActive, remainingInactive: artifact.remainingInactive, futureCandidates: futureCandidates.length }, null, 2));
