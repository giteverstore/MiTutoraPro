import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { dailyChallenge } from '../src/challenges/challengeData.js';
import { practiceQuestions } from '../src/practice/practiceData.js';
import { generateDailyChallengeAssignments } from '../src/challenges/dailyChallengeRotation.js';

const courseSchema = JSON.parse(
  await readFile(new URL('../schemas/learning-course.schema.json', import.meta.url)),
);
const challengeSchema = JSON.parse(
  await readFile(new URL('../schemas/daily-challenge.schema.json', import.meta.url)),
);
const assignmentSchema = JSON.parse(
  await readFile(new URL('../schemas/daily-challenge-assignment.schema.json', import.meta.url)),
);
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  allowUnionTypes: true,
});
addFormats(ajv);
ajv.addSchema(courseSchema);
const validate = ajv.compile(challengeSchema);
const validateAssignment = ajv.compile(assignmentSchema);

if (!validate(dailyChallenge)) {
  console.error(ajv.errorsText(validate.errors, { separator: '\n' }));
  process.exit(1);
}

const catalog = practiceQuestions.map((content) => ({ metadata: { id: content.id, published: true, difficulty: content.difficulty }, content }));
const [assignment] = generateDailyChallengeAssignments({ startDate: '2026-09-13', catalog });
if (!validateAssignment(assignment)) {
  console.error(ajv.errorsText(validateAssignment.errors, { separator: '\n' }));
  process.exit(1);
}

console.log(`Valid legacy daily challenge and Practice-reference assignment: ${dailyChallenge.id}`);
