import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { practiceQuestions } from '../src/practice/practiceData.js';

const readJson = (path) => readFile(path, 'utf8').then(JSON.parse);
const practiceMetadata = await readJson('firebase-content/firestore/practiceQuestions.json');
const challengeMetadata = await readJson('firebase-content/firestore/dailyChallenges.json');

assert.equal(practiceQuestions.length, 250);
assert.equal(practiceMetadata.length, 250);
assert.deepEqual(practiceMetadata.map(({ id }) => id), practiceQuestions.map(({ id }) => id));
assert.deepEqual(challengeMetadata, []);

console.log(JSON.stringify({
  practiceQuestions: practiceQuestions.length,
  practiceMetadata: practiceMetadata.length,
  challenges: 0,
  q250PublicationPayload: 'prepared-not-published',
}, null, 2));
