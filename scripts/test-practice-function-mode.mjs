import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { PRACTICE_FUNCTION_REFERENCE_SOLUTIONS } from '../tests/fixtures/practiceFunctionReferenceSolutions.js';

Object.assign(process.env, {
  VITE_FIREBASE_API_KEY: 'demo',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'demo-practice-function-mode',
  VITE_FIREBASE_STORAGE_BUCKET: 'demo.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '1',
  VITE_FIREBASE_APP_ID: '1:1:web:1',
});

const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const baseUrl = server.resolvedUrls?.local?.[0];
if (!baseUrl) throw new Error('Unable to resolve the local Vite test URL.');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const q250 = JSON.parse(await readFile(new URL('../src/practice/data/q250PracticeQuestions.json', import.meta.url), 'utf8'));
const flatArrayBatchIds = ['BLIND150-007', 'BLIND150-013', 'BLIND150-014', 'BLIND150-020', 'BLIND150-024', 'BLIND150-025', 'BLIND150-026', 'BLIND150-029', 'BLIND150-030', 'BLIND150-061', 'BLIND150-100', 'BLIND150-101', 'BLIND150-102', 'BLIND150-106', 'BLIND150-107', 'BLIND150-109', 'BLIND150-110', 'BLIND150-122', 'BLIND150-124', 'BLIND150-140'];
const requestedIds = (process.env.MODE_B_QUESTION_IDS || 'BLIND150-001,BLIND150-003,BLIND150-138,BLIND150-034,BLIND150-045,BLIND150-082,BLIND150-022,BLIND150-067,BLIND150-009,BLIND150-027,BLIND150-099,BLIND150-111,BLIND150-123').split(',');
const requestedLanguages = new Set((process.env.MODE_B_LANGUAGES || 'python,java,javascript,typescript,c,cpp,csharp,php,r').split(','));
const solutions = Object.fromEntries(Object.entries(PRACTICE_FUNCTION_REFERENCE_SOLUTIONS['BLIND150-001']).filter(([language]) => requestedLanguages.has(language)));
const familyQuestions = q250.filter(({ id }) => requestedIds.includes(id));
const selectedSolutions = Object.fromEntries(Object.entries(PRACTICE_FUNCTION_REFERENCE_SOLUTIONS).map(([id, values]) => [id, Object.fromEntries(Object.entries(values).filter(([language]) => requestedLanguages.has(language)))]));

try {
  await page.goto(`${baseUrl}dotnet/main.js`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  const results = await page.evaluate(async (solutionMap) => {
    const [{ createCompilerManager }, { createFunctionExecutionStrategy }, { CONTAINS_DUPLICATE_CONTRACT }] = await Promise.all([
      import('/src/compiler/createCompilerManager.js'),
      import('/src/compiler/function-mode/functionExecutionStrategy.js'),
      import('/src/compiler/function-mode/functionExecutionContract.js'),
    ]);
    const fixtures = [
      { name: 'BLIND150-001-T01', arguments: [[8, -2, 8]], input: { nums: [8, -2, 8] }, expected: true },
      { name: 'BLIND150-001-T02', arguments: [[0, -5, 7]], input: { nums: [0, -5, 7] }, expected: false },
      { name: 'BLIND150-001-T03', arguments: [[19]], input: { nums: [19] }, expected: false },
    ];
    const manager = createCompilerManager();
    const strategy = createFunctionExecutionStrategy({ ...CONTAINS_DUPLICATE_CONTRACT, fixtures });
    const extensions = { python: 'py', java: 'java', javascript: 'js', typescript: 'ts', c: 'c', cpp: 'cpp', csharp: 'cs', php: 'php', r: 'R' };
    const outcomes = {};
    try {
      for (const [language, source] of Object.entries(solutionMap)) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(new DOMException(`${language} validation timed out.`, 'AbortError')), 120_000);
        try {
          outcomes[language] = await strategy.execute({
            compilerManager: manager,
            definition: { language, editor: { fileName: `main.${extensions[language]}` }, timeoutMs: 30_000 },
            source,
            signal: controller.signal,
            instanceId: `mode-b-${language}`,
          });
        } finally { clearTimeout(timer); }
      }
    } finally { await manager.dispose(); }
    return outcomes;
  }, solutions);

  const summary = Object.fromEntries(Object.entries(results).map(([language, result]) => [language, {
    status: result.status,
    passed: result.functionResults.filter(({ passed }) => passed).length,
    error: result.errors?.[0] ?? null,
  }]));
  console.log(JSON.stringify(summary, null, 2));
  for (const [language, result] of Object.entries(results)) {
    assert.equal(result.allPassed, true, `${language}: ${JSON.stringify(result)}`);
    assert.equal(result.functionResults.length, 3, `${language} did not run all public fixtures.`);
  }
  const familyMatrix = await page.evaluate(async ({ questions, referenceSolutions }) => {
    const [{ createCompilerManager }, { createFunctionExecutionStrategy }, { resolvePracticeExecutionContract, resolveLinkedListCandidateExecutionContract }] = await Promise.all([
      import('/src/compiler/createCompilerManager.js'), import('/src/compiler/function-mode/functionExecutionStrategy.js'), import('/src/compiler/function-mode/functionExecutionContract.js'),
    ]);
    const manager = createCompilerManager();
    const extensions = { python: 'py', java: 'java', javascript: 'js', typescript: 'ts', c: 'c', cpp: 'cpp', csharp: 'cs', php: 'php', r: 'R' };
    const matrix = {};
    try {
      for (const question of questions) {
        matrix[question.id] = {};
        const base = resolvePracticeExecutionContract(question) ?? resolveLinkedListCandidateExecutionContract(question);
        for (const [language, source] of Object.entries(referenceSolutions[question.id])) {
          const started = performance.now();
          const execution = await createFunctionExecutionStrategy(base).execute({ compilerManager: manager, definition: { language, editor: { fileName: `main.${extensions[language]}` }, timeoutMs: 60_000 }, source, signal: new AbortController().signal, instanceId: `${question.id}-${language}` });
          matrix[question.id][language] = { status: execution.status, allPassed: execution.allPassed, passed: execution.functionResults.filter(({ passed }) => passed).length, fixtures: execution.functionResults.length, executionTimeMs: execution.executionTimeMs, wallTimeMs: Math.round(performance.now() - started), outputBytes: new TextEncoder().encode(JSON.stringify(execution.functionResults)).length, message: execution.errors?.[0] ?? null, failures: execution.functionResults.filter(({ passed }) => !passed).map(({ id, status, actual, expected, message }) => ({ id, status, actual, expected, message })) };
        }
      }
    } finally { await manager.dispose(); }
    return matrix;
  }, { questions: familyQuestions, referenceSolutions: selectedSolutions });
  console.log(JSON.stringify({ familyHarnessMatrix: familyMatrix }, null, 2));
  if (process.env.MODE_B_MATRIX_OUTPUT) {
    const output = new URL(`../docs/compiler-audit/${process.env.MODE_B_MATRIX_OUTPUT}`, import.meta.url);
    await mkdir(new URL('../docs/compiler-audit/', import.meta.url), { recursive: true });
    await writeFile(output, `${JSON.stringify({ schemaVersion: 'practice-mode-b-runtime-matrix-v1', fixtureExecutions: requestedIds.length * requestedLanguages.size * 3, matrix: familyMatrix }, null, 2)}\n`);
  }
  if (!process.env.MODE_B_LANGUAGES && (!process.env.MODE_B_QUESTION_IDS || requestedIds.every((id) => ['BLIND150-009', 'BLIND150-027', 'BLIND150-099', 'BLIND150-111', 'BLIND150-123'].includes(id)))) {
    const output = new URL('../docs/compiler-audit/mode-b-low-risk-batch-runtime-matrix.json', import.meta.url);
    await mkdir(new URL('../docs/compiler-audit/', import.meta.url), { recursive: true });
    await writeFile(output, `${JSON.stringify({ schemaVersion: 'practice-mode-b-runtime-matrix-v1', fixtureExecutions: requestedIds.length * requestedLanguages.size * 3, matrix: familyMatrix }, null, 2)}\n`);
  }
  if (!process.env.MODE_B_LANGUAGES && process.env.MODE_B_QUESTION_IDS && requestedIds.length === flatArrayBatchIds.length && flatArrayBatchIds.every((id) => requestedIds.includes(id))) {
    const output = new URL('../docs/compiler-audit/mode-b-flat-array-batch-runtime-matrix.json', import.meta.url);
    await mkdir(new URL('../docs/compiler-audit/', import.meta.url), { recursive: true });
    await writeFile(output, `${JSON.stringify({ schemaVersion: 'practice-mode-b-runtime-matrix-v1', fixtureExecutions: requestedIds.length * requestedLanguages.size * 3, matrix: familyMatrix }, null, 2)}\n`);
  }
  for (const [questionId, languages] of Object.entries(familyMatrix)) for (const [language, outcome] of Object.entries(languages)) {
    assert.equal(outcome.allPassed, true, `${questionId}/${language}: ${JSON.stringify(outcome)}`);
    assert.equal(outcome.passed, 3, `${questionId}/${language} did not pass all public fixtures.`);
  }
} finally {
  await browser.close();
  await server.close();
}
