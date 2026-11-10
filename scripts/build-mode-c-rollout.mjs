import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'docs/compiler-audit');
const ids = ['BLIND150-004', 'BLIND150-005', 'BLIND150-012', 'BLIND150-062', 'BLIND150-070', 'BLIND150-072', 'BLIND150-074', 'BLIND150-075', 'BLIND150-076', 'BLIND150-079', 'BLIND150-085', 'BLIND150-103', 'BLIND150-131', 'BLIND150-141'];
const reclassifiedIds = ['NC250-161', 'NC250-207', 'NC250-208', 'NC250-212', 'NC250-219', 'NC250-221', 'NC250-223'];
const languages = ['python', 'java', 'javascript', 'typescript', 'c', 'cpp', 'csharp', 'php', 'r'];
const files = ['mode-c-blind-dynamic.json', 'mode-c-blind-dynamic-corrected.json', 'mode-c-blind-python.json', 'mode-c-blind-native.json', 'mode-c-blind-managed.json', 'mode-c-blind-java-corrected.json'];
const fragments = await Promise.all(files.map(async (name) => JSON.parse(await readFile(path.join(dir, name), 'utf8'))));
const matrix = Object.fromEntries(ids.map((id) => [id, {}]));
for (const fragment of fragments) for (const id of ids) Object.assign(matrix[id], fragment.matrix[id] ?? {});
for (const id of ids) for (const language of languages) {
  const result = matrix[id][language];
  if (!result?.allPassed || result.passed !== 3 || result.fixtures !== 3) throw new Error(`${id}/${language} did not pass its activation gate.`);
}
const audit = JSON.parse(await readFile(path.join(dir, 'q250-mode-b-execution-shapes.json'), 'utf8'));
const runtime = { schemaVersion: 'practice-mode-b-runtime-matrix-v1', fixtureExecutions: ids.length * languages.length * 3, matrix };
await writeFile(path.join(dir, 'mode-c-runtime-matrix.json'), `${JSON.stringify(runtime, null, 2)}\n`);
const selected = ids.map((id) => ({
  ...audit.records.find((record) => record.id === id),
  activationDecision: 'activate',
  acceptance: Object.fromEntries(languages.map((language) => [language, { status: 'PASS', fixtures: '3/3', wallTimeMs: matrix[id][language].wallTimeMs, executionTimeMs: matrix[id][language].executionTimeMs, outputBytes: matrix[id][language].outputBytes }])),
}));
const reclassified = reclassifiedIds.map((id) => ({
  id,
  title: audit.records.find((record) => record.id === id)?.title,
  originalClassification: 'comparator-serializer-extension',
  newClassification: 'manual-review',
  exactMissingCapability: 'No independent accepted nine-language reference bundle exists for this imported NC250 record. Generic comparator support is present, but activation remains blocked rather than weakening the browser acceptance gate.',
}));
const rollout = { schemaVersion: 'practice-mode-c-rollout-v1', considered: 21, previousActive: 88, newlyActivated: ids, newlyActivatedCount: ids.length, totalActive: 102, remainingInactive: 148, deferred: 0, reclassified, selected };
await writeFile(path.join(dir, 'mode-c-rollout.json'), `${JSON.stringify(rollout, null, 2)}\n`);
await writeFile(path.join(dir, 'mode-c-comparator-validation.json'), `${JSON.stringify({ schemaVersion: 'practice-semantic-comparator-validation-v1', families: ['anagrams', 'top-k', 'triplets', 'closest-points', 'ordered-int-rows', 'unordered-strings', 'ordered-string-rows', 'coordinate-set', 'longest-palindrome', 'interval-set', 'float-close', 'unordered-unique', 'combination-set', 'permutation-set', 'account-set', 'edge-groups'], negativePaths: ['wrong-result', 'malformed-shape', 'missing-values', 'extra-values', 'wrong-ordering', 'alternate-valid-ordering', 'duplicate-values', 'nan', 'infinity', 'tolerance-boundaries'] }, null, 2)}\n`);
console.log(JSON.stringify({ considered: 21, activated: ids.length, reclassified: reclassified.length, groupCRemaining: audit.coverageCounts['comparator-serializer-extension'] ?? 0, totalActive: 102, fixtureExecutions: runtime.fixtureExecutions }, null, 2));
