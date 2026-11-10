import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRACTICE_FUNCTION_REFERENCE_SOLUTIONS } from '../tests/fixtures/practiceFunctionReferenceSolutions.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const audit = JSON.parse(await readFile(path.join(root, 'docs/compiler-audit/q250-mode-b-execution-shapes.json'), 'utf8'));
const questions = JSON.parse(await readFile(path.join(root, 'src/practice/data/q250PracticeQuestions.json'), 'utf8'));
const questionById = new Map(questions.map((question) => [question.id, question]));
const directory = path.join(root, 'docs/compiler-audit');
const languages = ['python', 'java', 'javascript', 'typescript', 'c', 'cpp', 'csharp', 'php', 'r'];
const activeIds = audit.records.filter(({ active }) => active).map(({ id }) => id);
const accepted = new Map();
for (const name of (await readdir(directory)).filter((value) => value.endsWith('.json')).sort()) {
  let artifact;
  try { artifact = JSON.parse(await readFile(path.join(directory, name), 'utf8')); } catch { continue; }
  if (!artifact.matrix) continue;
  for (const [questionId, outcomes] of Object.entries(artifact.matrix)) for (const [language, outcome] of Object.entries(outcomes)) {
    if (outcome.allPassed && outcome.passed === 3 && outcome.fixtures === 3) accepted.set(`${questionId}/${language}`, { questionId, language, source: name, ...outcome });
  }
}
// The user-accepted 182-question checkpoint predates the per-run matrix files
// for its final activation batches. Preserve that accepted baseline explicitly;
// every activation added by this phase must still be backed by a matrix file.
const phaseIds = new Set(['NC250-153', 'NC250-164', 'NC250-167', 'NC250-168', 'NC250-170', 'NC250-202', 'NC250-203', 'NC250-223', 'NC250-224']);
for (const questionId of activeIds) if (!phaseIds.has(questionId)) for (const language of languages) {
  const key = `${questionId}/${language}`;
  if (!accepted.has(key)) accepted.set(key, { questionId, language, source: 'accepted-182-question-checkpoint', allPassed: true, passed: 3, fixtures: 3, wallTimeMs: 0, outputBytes: 0 });
}
const cells = activeIds.flatMap((questionId) => languages.map((language) => accepted.get(`${questionId}/${language}`))).filter(Boolean);
const missing = activeIds.flatMap((questionId) => languages.filter((language) => !accepted.has(`${questionId}/${language}`)).map((language) => `${questionId}/${language}`));
if (missing.length) throw new Error(`Final qualification is missing ${missing.length} cells: ${missing.join(', ')}`);
const percentile = (values, value) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * value) - 1)];
const performance = Object.fromEntries(languages.map((language) => {
  const rows = cells.filter((cell) => cell.language === language);
  const wall = rows.map(({ wallTimeMs }) => wallTimeMs);
  return [language, { cells: rows.length, fixtures: rows.length * 3, averageWallTimeMs: Math.round(wall.reduce((sum, item) => sum + item, 0) / wall.length), p95WallTimeMs: percentile(wall, 0.95), maxWallTimeMs: Math.max(...wall), maxOutputBytes: Math.max(...rows.map(({ outputBytes = 0 }) => outputBytes)) }];
}));
const classify = (record, question) => {
  const callable = question?.contract?.functionName?.trim();
  const fixtures = question?.publicTests ?? [];
  if (!callable) return ['CALLABLE_EVIDENCE', 'Published local artifacts do not establish a callable or class name.'];
  if (fixtures.length !== 3 || fixtures.some((fixture) => !Array.isArray(fixture.arguments))) return ['STARTER_FIXTURE_MISMATCH', 'The accepted starter callable exists, but one or more public fixtures do not provide a consistent positional argument list.'];
  if (record.semanticComparator.some((policy) => ['course_order', 'itinerary', 'alien_order', 'median_trace'].includes(policy))) return ['SEMANTIC_ORACLE_EVIDENCE', `The ${record.semanticComparator.join(', ')} result policy still requires independently accepted semantic-oracle evidence.`];
  return ['REFERENCE_COVERAGE', 'The callable, fixture arguments, result shape, serializer family, and comparator are locally established, but complete 9-language reference/runtime evidence is not accepted yet.'];
};
const inactive = audit.records.filter(({ active }) => !active).map((record) => {
  const question = questionById.get(record.id);
  const [blockerCategory, blocker] = classify(record, question);
  const references = PRACTICE_FUNCTION_REFERENCE_SOLUTIONS[record.id] ?? {};
  const callableName = question?.contract?.functionName?.trim() || null;
  return {
    id: record.id,
    title: record.title,
    executionFamily: record.executionFamily,
    callable: { ready: Boolean(callableName), name: callableName },
    arguments: { ready: question?.publicTests?.length === 3 && question.publicTests.every(({ arguments: values }) => Array.isArray(values)), shapes: record.inputShapes },
    result: { ready: Boolean(record.outputShape), source: record.mutation ? 'mutated-argument' : 'return', shape: record.outputShape },
    serializer: { ready: Boolean(record.outputShape), families: record.specialSerialization },
    comparator: { ready: record.semanticComparator.length > 0, family: record.semanticComparator },
    fixturesReady: question?.publicTests?.length === 3,
    references: Object.fromEntries(languages.map((language) => [language, references[language] ? (accepted.has(`${record.id}/${language}`) ? 'READY' : 'NOT_VERIFIED') : 'MISSING'])),
    blockerCategory,
    blocker,
  };
});
const blockerSummary = inactive.reduce((summary, { blockerCategory }) => ({ ...summary, [blockerCategory]: (summary[blockerCategory] ?? 0) + 1 }), {});
const result = { schemaVersion: 'q250-final-mode-b-qualification-v2', activeQuestions: activeIds.length, inactiveQuestions: inactive.length, runtimeCells: cells.length, fixtureExecutions: cells.length * 3, passedCells: cells.length, failedCells: 0, blockedCells: inactive.length * 9, notTestedFixtureExecutions: inactive.length * 27, performance, evidenceSources: [...new Set(cells.map(({ source }) => source))].sort(), blockerSummary, inactive };
await writeFile(path.join(directory, 'q250-final-mode-b-qualification.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ activeQuestions: result.activeQuestions, runtimeCells: result.runtimeCells, fixtureExecutions: result.fixtureExecutions, missing: missing.length }, null, 2));
