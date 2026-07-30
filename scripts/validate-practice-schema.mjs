import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { practiceQuestions } from '../src/practice/practiceData.js';

const courseSchema = JSON.parse(
  await readFile(new URL('../schemas/learning-course.schema.json', import.meta.url)),
);
const practiceSchema = JSON.parse(
  await readFile(new URL('../schemas/practice-question.schema.json', import.meta.url)),
);
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  allowUnionTypes: true,
});
addFormats(ajv);
ajv.addSchema(courseSchema);
const validate = ajv.compile(practiceSchema);
const failures = practiceQuestions.flatMap((question) => {
  if (validate(question)) return [];
  return [`${question.id}:\n${ajv.errorsText(validate.errors, { separator: '\n' })}`];
});

if (failures.length) {
  console.error(failures.join('\n\n'));
  process.exit(1);
}

console.log(`Valid practice questions: ${practiceQuestions.length}`);
