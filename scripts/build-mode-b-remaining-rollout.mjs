import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'docs/compiler-audit');
const audit = JSON.parse(await readFile(path.join(dir, 'q250-mode-b-execution-shapes.json'), 'utf8'));
const files = [
  'mode-b-remaining-dynamic.json',
  'mode-b-remaining-dynamic-corrected-r.json',
  'mode-b-remaining-dynamic-corrected-python.json',
  'mode-b-remaining-native.json',
  'mode-b-remaining-native-corrected.json',
  'mode-b-remaining-managed.json',
  'mode-b-remaining-managed-corrected.json',
  'mode-b-remaining-managed-corrected-java.json',
  'mode-b-remaining-primitive-extra-dynamic.json',
  'mode-b-remaining-primitive-extra-python.json',
  'mode-b-remaining-primitive-extra-native.json',
  'mode-b-remaining-primitive-extra-native-corrected.json',
  'mode-b-remaining-primitive-extra-managed.json',
];
const fragments = await Promise.all(files.map(async (name) => JSON.parse(await readFile(path.join(dir, name), 'utf8'))));
const ids = ['BLIND150-008', 'BLIND150-023', 'BLIND150-068', 'BLIND150-071', 'BLIND150-073', 'BLIND150-080', 'BLIND150-081', 'BLIND150-084', 'BLIND150-090', 'BLIND150-091', 'BLIND150-092', 'BLIND150-093', 'BLIND150-095', 'BLIND150-096', 'BLIND150-098', 'BLIND150-105', 'BLIND150-108', 'BLIND150-117', 'BLIND150-127', 'BLIND150-130', 'BLIND150-132', 'BLIND150-133', 'BLIND150-134', 'BLIND150-135', 'BLIND150-137', 'BLIND150-139', 'BLIND150-142', 'BLIND150-150'];
const languages = ['python', 'java', 'javascript', 'typescript', 'c', 'cpp', 'csharp', 'php', 'r'];
const matrix = Object.fromEntries(ids.map((id) => [id, {}]));
for (const fragment of fragments) for (const id of ids) Object.assign(matrix[id], fragment.matrix[id] ?? {});
for (const id of ids) for (const language of languages) {
  const result = matrix[id][language];
  if (!result || !result.allPassed || result.passed !== 3 || result.fixtures !== 3) throw new Error(`${id}/${language} did not pass its activation gate.`);
}
const runtime = { schemaVersion: 'practice-mode-b-runtime-matrix-v1', fixtureExecutions: ids.length * languages.length * 3, matrix };
await writeFile(path.join(dir, 'mode-b-remaining-runtime-matrix.json'), `${JSON.stringify(runtime, null, 2)}\n`);

const reclassifiedIds = ['BLIND150-032', 'BLIND150-035', 'BLIND150-038', 'BLIND150-040', 'BLIND150-042', 'BLIND150-043', 'BLIND150-046', 'BLIND150-047', 'BLIND150-048', 'BLIND150-049', 'BLIND150-050', 'BLIND150-051', 'BLIND150-052', 'BLIND150-053', 'BLIND150-054', 'BLIND150-055', 'BLIND150-056', 'BLIND150-057', 'BLIND150-058', 'BLIND150-143'];
const selected = ids.map((id) => ({
  ...audit.records.find((record) => record.id === id), activationDecision: 'activate',
  acceptance: Object.fromEntries(languages.map((language) => {
    const value = matrix[id][language];
    return [language, { status: 'PASS', fixtures: `${value.passed}/${value.fixtures}`, wallTimeMs: value.wallTimeMs, executionTimeMs: value.executionTimeMs, outputBytes: value.outputBytes }];
  })),
}));
const reclassified = reclassifiedIds.map((id) => {
  const record = audit.records.find((entry) => entry.id === id);
  return { id, title: record.title, originalClassification: 'metadata-only-mapping', newClassification: 'new-adapter-required', exactMissingCapability: record.notes };
});
const artifact = { schemaVersion: 'practice-mode-b-remaining-rollout-v1', considered: 48, previousActive: 60, newlyActivated: ids, newlyActivatedCount: ids.length, totalActive: 88, remainingInactive: 162, deferred: 0, reclassified, selected };
await writeFile(path.join(dir, 'mode-b-remaining-rollout.json'), `${JSON.stringify(artifact, null, 2)}\n`);
const primitive = JSON.parse(await readFile(path.join(dir, 'mode-b-remaining-primitive-smoke.json'), 'utf8'));
await writeFile(path.join(dir, 'mode-b-primitive-serializer-validation.json'), `${JSON.stringify({ schemaVersion: 'practice-primitive-serializer-validation-v1', shapes: ['string-array', 'string-matrix', 'integer-matrix-input', 'integer-matrix-output'], fixtureExecutions: primitive.fixtureExecutions, matrix: primitive.matrix }, null, 2)}\n`);
console.log(JSON.stringify({ considered: 48, activated: ids.length, reclassified: reclassified.length, groupBRemaining: audit.coverageCounts['metadata-only-mapping'] ?? 0, totalActive: 88, fixtureExecutions: runtime.fixtureExecutions }, null, 2));
