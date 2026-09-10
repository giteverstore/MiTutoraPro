import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createPracticeMetadata } from '../src/content/models/practiceMetadata.js';
import { practiceQuestions } from '../src/practice/practiceData.js';
import { validatePracticeMetadataRecord } from './publishing/validatePracticeMetadata.mjs';

const repairedIds = [
  'practice-even-or-odd', 'practice-sum-range', 'practice-reverse-text',
  'practice-largest-number', 'practice-word-frequency', 'practice-palindrome',
];
const metadata = JSON.parse(await readFile('firebase-content/firestore/practiceQuestions.json', 'utf8'));

assert.equal(practiceQuestions.length, 200);
assert.equal(metadata.length, 200);
metadata.forEach(validatePracticeMetadataRecord);

for (const id of repairedIds) {
  const question = practiceQuestions.find((item) => item.id === id);
  assert.equal(question.category, 'fundamentals', `${id} category is invalid.`);
  assert.equal(question.questionType, 'implementation', `${id} questionType is invalid.`);
  assert.ok(question.subtopic, `${id} subtopic is missing.`);
  assert.ok(Array.isArray(question.skills) && question.skills.length > 0, `${id} skills are missing.`);
}

assert.deepEqual(
  metadata.filter(({ position }) => position >= 21 && position <= 26).map(createPracticeMetadata).map(({ id }) => id),
  repairedIds,
);

for (const [field, value] of [['category', undefined], ['subtopic', undefined], ['questionType', undefined], ['skills', 'invalid']]) {
  const invalid = { ...metadata[0], [field]: value };
  assert.throws(() => validatePracticeMetadataRecord(invalid), /Practice metadata is invalid/);
  assert.throws(
    () => createPracticeMetadata(invalid),
    (error) => error.code === 'content/invalid-metadata' && error.details?.field === field,
    `Runtime metadata validation did not reject ${field}.`,
  );
}

const artifacts = await Promise.all(metadata.map(({ position, version }) => (
  readFile(`firebase-content/practice/python/${version}/question-${position}.json`, 'utf8')
)));
assert.equal(artifacts.some((text) => text.includes('protectedTests') || text.includes('referenceImplementations')), false);

console.log(JSON.stringify({
  canonicalQuestions: practiceQuestions.length,
  metadataRecords: metadata.length,
  repairedLegacyRecords: repairedIds.length,
  catalogPositionsNormalized: '21-26',
  invalidFixturesRejected: 4,
  protectedContent: 'excluded',
  validation: 'passed',
}, null, 2));
