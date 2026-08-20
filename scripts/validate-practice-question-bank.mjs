import { loadPyodide } from 'pyodide';
import { practiceQuestions } from '../src/practice/practiceData.js';
import { fundamentalsVariablesBatch1 } from '../src/practice/data/fundamentalsVariablesBatch1.js';
import { fundamentalsConditionalsBatch2 } from '../src/practice/data/fundamentalsConditionalsBatch2.js';
import { fundamentalsLoopsBatch3 } from '../src/practice/data/fundamentalsLoopsBatch3.js';
import { fundamentalsFunctionsBatch4 } from '../src/practice/data/fundamentalsFunctionsBatch4.js';
import { fundamentalsStringsBatch5 } from '../src/practice/data/fundamentalsStringsBatch5.js';
import { fundamentalsArraysBatch6 } from '../src/practice/data/fundamentalsArraysBatch6.js';
import { fundamentalsDictionariesBatch7 } from '../src/practice/data/fundamentalsDictionariesBatch7.js';
import { fundamentalsSetsBatch8 } from '../src/practice/data/fundamentalsSetsBatch8.js';
import { fundamentalsInputOutputBatch9 } from '../src/practice/data/fundamentalsInputOutputBatch9.js';
import { fundamentalsErrorsMixedBatch10 } from '../src/practice/data/fundamentalsErrorsMixedBatch10.js';
import { protectedTests as batch1ProtectedTests, referenceImplementations as batch1References } from './fixtures/practice-bank-batch-1.private.mjs';
import { protectedTests as batch2ProtectedTests, referenceImplementations as batch2References } from './fixtures/practice-bank-batch-2.private.mjs';
import { protectedTests as batch3ProtectedTests, referenceImplementations as batch3References } from './fixtures/practice-bank-batch-3.private.mjs';
import { protectedTests as batch4ProtectedTests, referenceImplementations as batch4References } from './fixtures/practice-bank-batch-4.private.mjs';
import { protectedTests as batch5ProtectedTests, referenceImplementations as batch5References } from './fixtures/practice-bank-batch-5.private.mjs';
import { protectedTests as batch6ProtectedTests, referenceImplementations as batch6References } from './fixtures/practice-bank-batch-6.private.mjs';
import { protectedTests as batch7ProtectedTests, referenceImplementations as batch7References } from './fixtures/practice-bank-batch-7.private.mjs';
import { protectedTests as batch8ProtectedTests, referenceImplementations as batch8References } from './fixtures/practice-bank-batch-8.private.mjs';
import { protectedTests as batch9ProtectedTests, referenceImplementations as batch9References } from './fixtures/practice-bank-batch-9.private.mjs';
import { protectedTests as batch10ProtectedTests, referenceImplementations as batch10References } from './fixtures/practice-bank-batch-10.private.mjs';

const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };
const countBy = (items, key) => items.reduce((counts, item) => ({ ...counts, [item[key]]: (counts[item[key]] ?? 0) + 1 }), {});
const pyodide = await loadPyodide();
const expectedTypes = { implementation: 12, debugging: 4, reasoning: 4 };
const expectedDifficulties = { very_easy: 6, easy: 14 };
const legacyIds = ['practice-even-or-odd', 'practice-sum-range', 'practice-reverse-text', 'practice-largest-number', 'practice-word-frequency', 'practice-palindrome'];
const batches = [
  {
    name: 'Batch 1', slug: 'fundamentals/variables-data-types-expressions/1', questions: fundamentalsVariablesBatch1,
    topic: 'variables-data-types-expressions', idPrefix: 'fund-variables-', references: batch1References, protectedTests: batch1ProtectedTests,
    subtopics: { 'variable-creation-assignment': 4, 'data-types': 4, 'expressions-evaluation': 4, 'variable-interaction': 3, 'type-conversion': 3, 'edge-cases-common-mistakes': 2 },
  },
  {
    name: 'Batch 2', slug: 'fundamentals/conditionals/2', questions: fundamentalsConditionalsBatch2,
    topic: 'conditionals', idPrefix: 'fund-conditionals-', references: batch2References, protectedTests: batch2ProtectedTests,
    subtopics: { 'basic-conditions': 4, 'if-else': 4, 'multiple-conditions': 4, 'elif-branching': 3, 'nested-conditions': 2, 'boundary-conditions-common-mistakes': 3 },
  },
  {
    name: 'Batch 3', slug: 'fundamentals/loops/3', questions: fundamentalsLoopsBatch3,
    topic: 'loops', idPrefix: 'fund-loops-', references: batch3References, protectedTests: batch3ProtectedTests,
    subtopics: { 'basic-loops': 4, 'looping-over-sequences': 4, 'accumulators-counters': 4, 'nested-loops': 3, 'loop-control': 2, 'loop-edge-cases-common-mistakes': 3 },
  },
  {
    name: 'Batch 4', slug: 'fundamentals/functions/4', questions: fundamentalsFunctionsBatch4,
    topic: 'functions', idPrefix: 'fund-functions-', references: batch4References, protectedTests: batch4ProtectedTests,
    subtopics: { 'function-basics-parameters': 4, 'return-values': 4, 'multiple-parameters': 3, 'default-optional-behavior': 2, 'scope-local-state': 3, 'combining-functions': 2, 'function-edge-cases-common-mistakes': 2 },
  },
  {
    name: 'Batch 5', slug: 'fundamentals/strings/5', questions: fundamentalsStringsBatch5,
    topic: 'strings', idPrefix: 'fund-strings-', references: batch5References, protectedTests: batch5ProtectedTests,
    subtopics: { 'string-basics-indexing': 4, 'string-traversal': 4, 'searching-matching': 3, 'string-transformation': 3, 'splitting-joining-parsing': 3, 'string-validation-edge-cases': 3 },
  },
  {
    name: 'Batch 6', slug: 'fundamentals/arrays-lists/6', questions: fundamentalsArraysBatch6,
    topic: 'arrays-lists', idPrefix: 'fund-arrays-', references: batch6References, protectedTests: batch6ProtectedTests,
    subtopics: { 'list-array-basics-indexing': 4, 'traversing-lists': 4, 'adding-removing-updating-elements': 3, 'searching-counting': 3, 'aggregation-simple-transformations': 3, 'edge-cases-common-mistakes': 3 },
  },
  {
    name: 'Batch 7', slug: 'fundamentals/dictionaries-hash-maps/7', questions: fundamentalsDictionariesBatch7,
    topic: 'dictionaries-hash-maps', idPrefix: 'fund-dictionaries-', references: batch7References, protectedTests: batch7ProtectedTests,
    subtopics: { 'dictionary-map-basics': 4, 'accessing-updating-values': 4, 'adding-removing-entries': 3, 'searching-membership': 3, 'counting-frequency-tracking': 3, 'edge-cases-common-mistakes': 3 },
  },
  {
    name: 'Batch 8', slug: 'fundamentals/sets/8', questions: fundamentalsSetsBatch8,
    topic: 'sets', idPrefix: 'fund-sets-', references: batch8References, protectedTests: batch8ProtectedTests,
    subtopics: { 'set-basics-uniqueness': 4, 'membership-lookup': 3, 'adding-removing-elements': 3, 'duplicate-elimination': 3, 'basic-set-operations': 4, 'traversal-edge-cases': 3 },
  },
  {
    name: 'Batch 9', slug: 'fundamentals/input-output-parsing/9', questions: fundamentalsInputOutputBatch9,
    topic: 'input-output-parsing', idPrefix: 'fund-io-', references: batch9References, protectedTests: batch9ProtectedTests,
    expectedCount: 15, expectedTypes: { implementation: 9, debugging: 3, reasoning: 3 }, expectedDifficulties: { very_easy: 5, easy: 10 },
    subtopics: { 'basic-input-output': 3, 'numeric-input-conversion': 3, 'multiple-values-structured-input': 3, 'parsing-text-delimiters': 3, 'input-validation-edge-cases': 3 },
  },
  {
    name: 'Batch 10', slug: 'fundamentals/error-handling-mixed/10', questions: fundamentalsErrorsMixedBatch10,
    topic: 'error-handling-mixed', idPrefix: 'fund-errors-', references: batch10References, protectedTests: batch10ProtectedTests,
    expectedCount: 19, expectedTypes: { implementation: 11, debugging: 4, reasoning: 4 }, expectedDifficulties: { very_easy: 4, easy: 11, medium: 4 },
    subtopics: { 'basic-error-handling-invalid-input': 4, 'defensive-programming-validation': 3, 'debugging-common-mistakes': 4, 'combining-multiple-fundamentals': 5, 'mixed-reasoning-practical-problems': 3 },
  },
];

function validatePython(question, reference, tests) {
  for (const [testIndex, test] of tests.entries()) {
    const source = [
      'import json', reference,
      `arguments = json.loads(${JSON.stringify(JSON.stringify(test.arguments))})`,
      `result = ${question.contract.functionName}(*arguments)`,
      "json.dumps(result, sort_keys=True, separators=(',', ':'))",
    ].join('\n');
    try {
      const output = pyodide.runPython(source);
      let actual;
      try { actual = JSON.parse(String(output).trim()); } catch { actual = String(output).trim(); }
      assert(JSON.stringify(actual) === JSON.stringify(test.expected), `${question.id} test ${testIndex + 1}: expected ${JSON.stringify(test.expected)}, received ${JSON.stringify(actual)}.`);
    } catch (error) {
      assert(false, `${question.id} test ${testIndex + 1}: Python execution failed: ${error.message}`);
    }
  }
}

function validateBatch(batch) {
  const expectedCount = batch.expectedCount ?? 20;
  const requiredTypes = batch.expectedTypes ?? expectedTypes;
  const requiredDifficulties = batch.expectedDifficulties ?? expectedDifficulties;
  assert(batch.questions.length === expectedCount, `${batch.name}: expected ${expectedCount} questions, found ${batch.questions.length}.`);
  assert(new Set(batch.questions.map(({ id }) => id)).size === expectedCount, `${batch.name}: question IDs must be unique.`);
  assert(JSON.stringify(countBy(batch.questions, 'subtopic')) === JSON.stringify(batch.subtopics), `${batch.name}: subtopic distribution is incorrect.`);
  const typeCounts = countBy(batch.questions, 'questionType');
  assert(Object.entries(requiredTypes).every(([type, count]) => typeCounts[type] === count), `${batch.name}: question type distribution is incorrect.`);
  const difficultyCounts = countBy(batch.questions, 'difficulty');
  assert(Object.entries(requiredDifficulties).every(([difficulty, count]) => difficultyCounts[difficulty] === count), `${batch.name}: difficulty distribution is incorrect.`);

  for (const [questionIndex, question] of batch.questions.entries()) {
    const expectedId = `${batch.idPrefix}${String(questionIndex + 1).padStart(3, '0')}`;
    assert(question.id === expectedId, `${batch.name}: expected ID ${expectedId}, found ${question.id}.`);
    assert(question.category === 'fundamentals', `${question.id}: invalid category.`);
    assert(question.topic === batch.topic, `${question.id}: invalid topic.`);
    assert(Object.hasOwn(requiredDifficulties, question.difficulty), `${question.id}: invalid difficulty.`);
    for (const field of ['contract', 'examples', 'constraints', 'concepts', 'skills', 'prerequisites', 'commonMistakes', 'expectedComplexity', 'publicTests', 'implementations']) {
      assert(question[field] !== undefined, `${question.id}: missing ${field}.`);
    }
    assert(question.publicTests.length === 2, `${question.id}: requires exactly two public tests.`);
    assert(batch.protectedTests[question.id]?.length === 2, `${question.id}: requires exactly two protected tests.`);
    assert(Boolean(batch.references[question.id]), `${question.id}: missing validator-only reference implementation.`);
    assert(question.blocks.filter(({ type }) => type === 'compiler').length === 1, `${question.id}: requires exactly one compiler block.`);
    assert(question.blocks.find(({ type }) => type === 'compiler')?.language === 'python', `${question.id}: compiler must use Python.`);
    assert(!JSON.stringify(question).includes('protectedTests'), `${question.id}: protected tests leaked into learner content.`);
    assert(!/\bpython\b|\bint\s*\(|\bfloat\s*\(|\belif\b/i.test(question.blocks[1]?.content ?? ''), `${question.id}: canonical statement is language-specific.`);

    const publicInputs = new Set(question.publicTests.map((test) => JSON.stringify(test.arguments)));
    for (const test of batch.protectedTests[question.id] ?? []) {
      assert(!publicInputs.has(JSON.stringify(test.arguments)), `${question.id}: protected test duplicates a public input.`);
    }
    validatePython(question, batch.references[question.id], [...question.publicTests, ...(batch.protectedTests[question.id] ?? [])]);

    if (batch.topic === 'sets') {
      const collectionTests = [...question.publicTests, ...(batch.protectedTests[question.id] ?? [])]
        .filter(({ expected }) => Array.isArray(expected));
      if (collectionTests.length) {
        assert(/alphabetical|ascending|ordered/i.test(question.contract.output), `${question.id}: collection output must declare deterministic ordering.`);
        for (const test of collectionTests) {
          const sortedExpected = [...test.expected].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
          assert(JSON.stringify(test.expected) === JSON.stringify(sortedExpected), `${question.id}: set-result tests must not depend on arbitrary iteration order.`);
        }
      }
    }

    if (batch.topic === 'input-output-parsing' && question.subtopic === 'parsing-text-delimiters') {
      const specification = `${question.blocks[1]?.content} ${question.contract.input} ${question.contract.output} ${question.constraints.join(' ')}`;
      assert(/delimiter|delimited|separated/i.test(specification), `${question.id}: parsing contract must define its delimiter.`);
      assert(/exactly|one or more/i.test(specification), `${question.id}: parsing contract must define its field shape.`);
      assert(/trim/i.test(specification), `${question.id}: parsing contract must define whitespace behavior.`);
      assert(/invalid|empty when/i.test(specification), `${question.id}: parsing contract must define invalid-input behavior.`);
    }

    if (batch.topic === 'error-handling-mixed') {
      if (question.questionType === 'debugging') {
        assert(/current implementation|current condition/i.test(question.blocks[1]?.content ?? ''), `${question.id}: debugging task must identify one current implementation defect.`);
      }
      if (question.subtopic === 'combining-multiple-fundamentals') {
        assert(question.concepts.length >= 3, `${question.id}: mixed task must combine at least three previously taught concepts.`);
      }
      if (question.difficulty === 'medium') {
        assert(question.subtopic === 'combining-multiple-fundamentals', `${question.id}: medium Fundamentals work must be multi-concept rather than algorithmic.`);
      }
    }
  }
}

for (const batch of batches) validateBatch(batch);

const canonicalQuestions = batches.flatMap(({ questions }) => questions);
const allIds = practiceQuestions.map(({ id }) => id);
const existingIdsInCatalogOrder = [
  ...fundamentalsVariablesBatch1.map(({ id }) => id),
  ...legacyIds,
  ...fundamentalsConditionalsBatch2.map(({ id }) => id),
  ...fundamentalsLoopsBatch3.map(({ id }) => id),
  ...fundamentalsFunctionsBatch4.map(({ id }) => id),
  ...fundamentalsStringsBatch5.map(({ id }) => id),
  ...fundamentalsArraysBatch6.map(({ id }) => id),
  ...fundamentalsDictionariesBatch7.map(({ id }) => id),
  ...fundamentalsSetsBatch8.map(({ id }) => id),
  ...fundamentalsInputOutputBatch9.map(({ id }) => id),
];
assert(practiceQuestions.length === 200, `Canonical catalog must contain 200 questions; found ${practiceQuestions.length}.`);
assert(new Set(allIds).size === allIds.length, 'Canonical catalog contains duplicate IDs.');
assert(JSON.stringify(allIds.slice(0, 181)) === JSON.stringify(existingIdsInCatalogOrder), 'Existing question order or IDs changed.');
assert(JSON.stringify(allIds.slice(181)) === JSON.stringify(fundamentalsErrorsMixedBatch10.map(({ id }) => id)), 'Batch 10 must occupy generated positions 182 through 200.');
assert(practiceQuestions.every(({ category }) => category !== 'dsa'), 'Final 200-question catalog must not contain DSA questions.');
const definitions = canonicalQuestions.map((question) => `${question.blocks[1]?.content}\n${question.contract.signature}`.toLowerCase());
assert(new Set(definitions).size === definitions.length, 'Duplicate canonical problem definitions found.');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({
  catalogQuestions: practiceQuestions.length,
  existingQuestionsPreserved: 181,
  batches: batches.map((batch) => ({
    batch: batch.slug, questions: batch.questions.length,
    subtopics: countBy(batch.questions, 'subtopic'), questionTypes: countBy(batch.questions, 'questionType'),
    difficulties: countBy(batch.questions, 'difficulty'),
    publicTests: batch.questions.reduce((total, question) => total + question.publicTests.length, 0),
    protectedTests: Object.values(batch.protectedTests).reduce((total, tests) => total + tests.length, 0),
  })),
  pythonExecution: 'passed', protectedContentIsolation: 'passed',
}, null, 2));
