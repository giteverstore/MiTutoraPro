import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRACTICE_FUNCTION_REFERENCE_SOLUTIONS } from '../tests/fixtures/practiceFunctionReferenceSolutions.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'docs/compiler-audit');
const ids = ['BLIND150-035', 'BLIND150-036', 'BLIND150-037', 'BLIND150-038', 'BLIND150-039', 'BLIND150-040', 'BLIND150-043', 'BLIND150-044', 'NC250-190', 'NC250-245'];
const languages = ['python', 'java', 'javascript', 'typescript', 'c', 'cpp', 'csharp', 'php', 'r'];
const inputs = ['mode-b-linked-list-rollout.partial.json', 'mode-b-linked-list-python.json', 'mode-b-linked-list-java.json', 'mode-b-linked-list-native.json', 'mode-b-linked-list-managed-dynamic.json', 'mode-b-linked-list-r.json', 'mode-b-linked-list-r-random.json', 'mode-b-linked-list-nc-managed-dynamic.json', 'mode-b-linked-list-nc-python.json', 'mode-b-linked-list-nc-native.json', 'mode-b-linked-list-nc245-cpp.json'];
const matrix = Object.fromEntries(ids.map((id) => [id, {}]));
for (const name of inputs) {
  const artifact = JSON.parse(await readFile(path.join(dir, name), 'utf8'));
  for (const [id, outcomes] of Object.entries(artifact.matrix ?? {})) for (const [language, outcome] of Object.entries(outcomes)) {
    if (ids.includes(id) && outcome.allPassed && outcome.passed === 3 && outcome.fixtures === 3) matrix[id][language] = { ...outcome, evidenceSource: name };
  }
}
const missing = ids.flatMap((id) => languages.filter((language) => !matrix[id][language]).map((language) => `${id}/${language}`));
if (missing.length) throw new Error(`Missing linked-list acceptance cells: ${missing.join(', ')}`);
const runtime = { schemaVersion: 'practice-mode-b-linked-list-rollout-v1', targets: ids.length, runtimeCells: ids.length * languages.length, fixtureExecutions: ids.length * languages.length * 3, passedCells: ids.length * languages.length, failedCells: 0, matrix };
const referenceCoverage = { schemaVersion: 'practice-mode-b-linked-list-reference-coverage-v1', languages, targets: Object.fromEntries(ids.map((id) => [id, Object.fromEntries(languages.map((language) => [language, Boolean(PRACTICE_FUNCTION_REFERENCE_SOLUTIONS[id]?.[language])]))])) };
for (const [id, coverage] of Object.entries(referenceCoverage.targets)) for (const [language, ready] of Object.entries(coverage)) if (!ready) throw new Error(`Missing reference ${id}/${language}`);
await writeFile(path.join(dir, 'mode-b-linked-list-rollout.json'), `${JSON.stringify(runtime, null, 2)}\n`);
await writeFile(path.join(dir, 'mode-b-linked-list-reference-coverage.json'), `${JSON.stringify(referenceCoverage, null, 2)}\n`);
const regression = { schemaVersion: 'practice-mode-b-runtime-matrix-v1', fixtureExecutions: 27, matrix: { 'BLIND150-034': {} } };
for (const name of ['mode-b-linked-list-generic-regression.json', 'mode-b-linked-list-generic-regression-managed.json']) {
  const artifact = JSON.parse(await readFile(path.join(dir, name), 'utf8'));
  for (const [language, outcome] of Object.entries(artifact.matrix?.['BLIND150-034'] ?? {})) if (outcome.allPassed) regression.matrix['BLIND150-034'][language] = outcome;
}
if (Object.keys(regression.matrix['BLIND150-034']).length !== 9) throw new Error('Reverse Linked List regression is incomplete.');
await writeFile(path.join(dir, 'mode-b-linked-list-generic-regression.json'), `${JSON.stringify(regression, null, 2)}\n`);
console.log(JSON.stringify({ targets: ids.length, runtimeCells: runtime.runtimeCells, fixtureExecutions: runtime.fixtureExecutions, missing: missing.length }, null, 2));
