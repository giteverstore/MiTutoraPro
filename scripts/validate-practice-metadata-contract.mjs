import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { practiceQuestions } from '../src/practice/practiceData.js';
import { loadPracticeBundle } from './publishing/loadPracticeBundle.mjs';

const metadata = JSON.parse(await readFile('firebase-content/firestore/practiceQuestions.json', 'utf8'));

const bundle = await loadPracticeBundle();
assert.equal(practiceQuestions.length, 250);
assert.equal(metadata.length, 250);
assert.deepEqual(metadata.map(({ id }) => id), practiceQuestions.map(({ id }) => id));
assert.equal(bundle.files.length, 250);

console.log(JSON.stringify({
  canonicalQuestions: practiceQuestions.length,
  metadataRecords: metadata.length,
  artifacts: bundle.files.length,
  publicationVersion: bundle.version,
  validation: 'passed',
}, null, 2));
