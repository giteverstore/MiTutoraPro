import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const auditPath = path.join(root, 'docs/compiler-audit/q250-mode-b-execution-shapes.json');
const matrixNames = [
  'mode-de-primitive-dynamic.json',
  'mode-de-primitive-native.json',
  'mode-de-primitive-native-retry.json',
  'mode-de-primitive-managed.json',
  'mode-de-primitive-python.json',
];
const audit = JSON.parse(await readFile(auditPath, 'utf8'));
const matrices = await Promise.all(matrixNames.map(async (name) => JSON.parse(await readFile(path.join(root, 'docs/compiler-audit', name), 'utf8'))));
const outcomeMap = new Map();
for (const { matrix } of matrices) for (const [questionId, languages] of Object.entries(matrix)) for (const [language, outcome] of Object.entries(languages)) {
  outcomeMap.set(`${questionId}/${language}`, { questionId, language, ...outcome });
}
const outcomes = [...outcomeMap.values()];
const activatedIds = [...new Set(outcomes.map(({ questionId }) => questionId))].sort();
const accepted = outcomes.filter(({ allPassed, passed, fixtures }) => allPassed && passed === 3 && fixtures === 3);
if (accepted.length !== activatedIds.length * 9 || accepted.length !== outcomes.length) throw new Error(`Incomplete D/E acceptance matrix: ${accepted.length}/${activatedIds.length * 9} cells accepted.`);

const byLanguage = Object.fromEntries([...new Set(outcomes.map(({ language }) => language))].sort().map((language) => {
  const rows = outcomes.filter((row) => row.language === language);
  return [language, {
    cells: rows.length,
    fixtures: rows.reduce((total, row) => total + row.fixtures, 0),
    averageWallTimeMs: Math.round(rows.reduce((total, row) => total + row.wallTimeMs, 0) / rows.length),
    maxWallTimeMs: Math.max(...rows.map(({ wallTimeMs }) => wallTimeMs)),
  }];
}));
const inactive = audit.records.filter(({ active }) => !active).map(({ id, title, executionFamily, notes }) => ({ id, title, executionFamily, blocker: notes }));
const artifact = {
  schemaVersion: 'practice-mode-de-rollout-v1',
  processed: { D: 80, E: 68, total: 148 },
  activatedIds,
  activatedCount: activatedIds.length,
  inactiveCount: inactive.length,
  runtimeAcceptance: { cells: outcomes.length, fixtureExecutions: outcomes.length * 3, passedCells: accepted.length, failedCells: outcomes.length - accepted.length },
  performanceByLanguage: byLanguage,
  inactive,
};
const output = path.join(root, 'docs/compiler-audit/mode-de-rollout.json');
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(JSON.stringify({ output: path.relative(root, output), ...artifact.runtimeAcceptance, activatedCount: artifact.activatedCount, inactiveCount: artifact.inactiveCount }, null, 2));
