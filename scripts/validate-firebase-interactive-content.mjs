import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { practiceQuestions } from '../src/practice/practiceData.js';
import { dailyChallenge } from '../src/challenges/challengeData.js';
import { NormalizedOutputValidator } from '../src/compiler/validators/NormalizedOutputValidator.js';

const readJson = (path) => readFile(resolve(path), 'utf8').then(JSON.parse);
const courseSchema = await readJson('schemas/learning-course.schema.json');
const practiceSchema = await readJson('schemas/practice-question.schema.json');
const challengeSchema = await readJson('schemas/daily-challenge.schema.json');
const practiceMetadata = await readJson('firebase-content/firestore/practiceQuestions.json');
const challengeMetadata = await readJson('firebase-content/firestore/dailyChallenges.json');

const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv);
ajv.addSchema(courseSchema);
const validatePractice = ajv.compile(practiceSchema);
const validateChallenge = ajv.compile(challengeSchema);

const versionedPath = ({ storagePath, version }) => {
  const segments = storagePath.split('/');
  const fileName = segments.pop();
  return `firebase-content/${segments.join('/')}/${version}/${fileName}`;
};
const firebaseQuestions = await Promise.all(practiceMetadata.map((metadata) => readJson(versionedPath(metadata))));
const firebaseChallenge = await readJson(
  `firebase-content/daily-challenges/python/${challengeMetadata[0].version}/${dailyChallenge.date}.json`,
);

for (const question of firebaseQuestions) {
  assert.equal(validatePractice(question), true, ajv.errorsText(validatePractice.errors));
}
assert.equal(validateChallenge(firebaseChallenge), true, ajv.errorsText(validateChallenge.errors));
assert.deepEqual(firebaseQuestions, practiceQuestions, 'Firebase practice content must match the existing six questions.');
assert.deepEqual(firebaseChallenge, dailyChallenge, 'Firebase challenge content must match the existing challenge.');
assert.equal(firebaseQuestions.length, 6);

const validator = new NormalizedOutputValidator();
for (const content of [...firebaseQuestions, firebaseChallenge]) {
  const compiler = content.blocks.find((block) => block.type === 'compiler');
  assert.ok(compiler?.starterCode, `${content.id} must preserve starter code.`);
  assert.ok(compiler?.expectedOutput, `${content.id} must preserve expected output.`);
  assert.equal(validator.validate(compiler.expectedOutput, `  ${compiler.expectedOutput}\r\n`), true);
}

console.log(JSON.stringify({
  practiceQuestions: firebaseQuestions.length,
  challenges: 1,
  compilerDefinitions: firebaseQuestions.length + 1,
  schemas: 'passed',
  localParity: 'passed',
  normalizedValidator: 'passed',
}, null, 2));
