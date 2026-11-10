import assert from 'node:assert/strict';
import { practiceQuestions } from '../src/practice/practiceData.js';

const expectedCategories = {
  'Arrays & Hashing': 22, 'Two Pointers': 13, 'Sliding Window': 9, Stack: 14,
  'Binary Search': 14, 'Linked List': 14, Trees: 23, 'Heap / Priority Queue': 12,
  Backtracking: 17, Tries: 4, Graphs: 21, 'Advanced Graphs': 10,
  '1-D Dynamic Programming': 17, '2-D Dynamic Programming': 16, Greedy: 14,
  Intervals: 7, 'Math & Geometry': 13, 'Bit Manipulation': 10,
};
const languages = ['python', 'java', 'javascript', 'typescript', 'c', 'cpp', 'csharp', 'php', 'r'];
const countBy = (field) => Object.fromEntries([...new Set(practiceQuestions.map((question) => question[field]))]
  .map((value) => [value, practiceQuestions.filter((question) => question[field] === value).length]));

assert.equal(practiceQuestions.length, 250);
assert.equal(new Set(practiceQuestions.map(({ id }) => id)).size, 250);
assert.deepEqual(countBy('topic'), expectedCategories);
assert.deepEqual(countBy('difficulty'), { easy: 60, medium: 155, hard: 35 });
assert.equal(practiceQuestions.reduce((sum, question) => sum + question.examples.length, 0), 750);
assert.equal(practiceQuestions.reduce((sum, question) => sum + question.publicTests.length, 0), 750);
assert.equal(practiceQuestions.reduce((sum, question) => sum + question.hints.length, 0), 750);
assert.equal(practiceQuestions.reduce((sum, question) => sum + Object.keys(question.starterTemplates).length, 0), 2250);
for (const question of practiceQuestions) {
  assert.deepEqual(Object.keys(question.starterTemplates), languages, `${question.id} starter languages differ.`);
  assert.ok(question.constraints.length, `${question.id} has no constraints.`);
  assert.ok(question.expectedComplexity.time && question.expectedComplexity.space, `${question.id} has incomplete complexity metadata.`);
}
const learnerPayload = JSON.stringify(practiceQuestions);
for (const forbidden of ['referenceImplementation', 'reference_solution', 'hiddenFixtures', 'internalFixtures', 'semanticOracle', 'preservationHash', 'validationLog', 'checkpointReport']) {
  assert.ok(!learnerPayload.includes(forbidden), `Learner payload exposes internal marker: ${forbidden}`);
}

console.log(JSON.stringify({
  questions: 250, uniqueIds: 250, categories: 18,
  difficulty: { easy: 60, medium: 155, hard: 35 },
  examples: 750, publicFixtures: 750, hints: 750, starterTemplates: 2250,
  internalArtifactsExposed: 0,
}, null, 2));
