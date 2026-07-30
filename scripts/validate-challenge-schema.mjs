import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { dailyChallenge } from '../src/challenges/challengeData.js';

const courseSchema = JSON.parse(
  await readFile(new URL('../schemas/learning-course.schema.json', import.meta.url)),
);
const challengeSchema = JSON.parse(
  await readFile(new URL('../schemas/daily-challenge.schema.json', import.meta.url)),
);
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  allowUnionTypes: true,
});
addFormats(ajv);
ajv.addSchema(courseSchema);
const validate = ajv.compile(challengeSchema);

if (!validate(dailyChallenge)) {
  console.error(ajv.errorsText(validate.errors, { separator: '\n' }));
  process.exit(1);
}

console.log(`Valid daily challenge: ${dailyChallenge.id}`);
