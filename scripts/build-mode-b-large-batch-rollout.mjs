import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const audit = JSON.parse(await readFile(path.join(root, 'docs/compiler-audit/q250-mode-b-execution-shapes.json'), 'utf8'));
const matrixFiles = ['mode-b-large-batch-dynamic.json', 'mode-b-large-batch-native.json', 'mode-b-large-batch-managed.json'];
const fragments = await Promise.all(matrixFiles.map(async (name) => JSON.parse(await readFile(path.join(root, 'docs/compiler-audit', name), 'utf8'))));
const selectedIds = ['BLIND150-002', 'BLIND150-010', 'BLIND150-016', 'BLIND150-017', 'BLIND150-018', 'BLIND150-019', 'BLIND150-021', 'BLIND150-064', 'BLIND150-104', 'BLIND150-112', 'BLIND150-113', 'BLIND150-114', 'BLIND150-115', 'BLIND150-116', 'BLIND150-118', 'BLIND150-119', 'BLIND150-120', 'BLIND150-121', 'BLIND150-126', 'BLIND150-128', 'BLIND150-129', 'BLIND150-144', 'BLIND150-145', 'BLIND150-146', 'BLIND150-147', 'BLIND150-148', 'BLIND150-149'];
const languages = ['python', 'java', 'javascript', 'typescript', 'c', 'cpp', 'csharp', 'php', 'r'];
const matrix = Object.fromEntries(selectedIds.map((id) => [id, {}]));
for (const fragment of fragments) for (const id of selectedIds) Object.assign(matrix[id], fragment.matrix[id] ?? {});
for (const id of selectedIds) for (const language of languages) {
  const result = matrix[id][language];
  if (!result || !result.allPassed || result.passed !== 3 || result.fixtures !== 3) throw new Error(`${id}/${language} did not pass its activation gate.`);
}

const runtime = { schemaVersion: 'practice-mode-b-runtime-matrix-v1', fixtureExecutions: selectedIds.length * languages.length * 3, matrix };
await writeFile(path.join(root, 'docs/compiler-audit/mode-b-large-batch-runtime-matrix.json'), `${JSON.stringify(runtime, null, 2)}\n`);

const selected = selectedIds.map((id) => {
  const record = audit.records.find((entry) => entry.id === id);
  return {
    id, title: record.title, inputShapes: record.inputShapes, outputShape: record.outputShape,
    adapterFamily: 'plain-return', comparator: 'exact', activationDecision: 'activate',
    acceptance: Object.fromEntries(languages.map((language) => {
      const value = matrix[id][language];
      return [language, { status: 'PASS', fixtures: `${value.passed}/${value.fixtures}`, wallTimeMs: value.wallTimeMs, executionTimeMs: value.executionTimeMs, outputBytes: value.outputBytes }];
    })),
  };
});
const deferred = audit.records.filter(({ coverage, active }) => coverage === 'metadata-only-mapping' && !active).map(({ id, title, inputShapes, outputShape, executionFamily }) => ({
  id, title, inputShapes, outputShape, executionFamily, decision: 'inactive',
  reason: 'Outside this bounded primitive rollout or requires a broader input/serialization review and its own nine-language activation gate.',
}));
const artifact = {
  schemaVersion: 'practice-mode-b-large-batch-rollout-v1', previousActive: 33,
  newlyActivated: selectedIds, newlyActivatedCount: selectedIds.length, totalActive: 60,
  remainingInactive: 190, fixtureExecutions: runtime.fixtureExecutions,
  serializerExtension: 'Generic scalar string arguments and JSON-compatible scalar string returns; no comparator or execution-family change.',
  selected, deferred,
};
await writeFile(path.join(root, 'docs/compiler-audit/mode-b-large-batch-rollout.json'), `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({ newlyActivated: selectedIds.length, totalActive: artifact.totalActive, remainingInactive: artifact.remainingInactive, fixtureExecutions: artifact.fixtureExecutions, deferred: deferred.length }, null, 2));
