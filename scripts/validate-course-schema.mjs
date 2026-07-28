import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const coursePath = process.argv[2] ?? '../examples/course.example.json';
const schema = JSON.parse(
  await readFile(new URL('../schemas/learning-course.schema.json', import.meta.url)),
);
const example = JSON.parse(
  await readFile(new URL(coursePath, import.meta.url)),
);

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  allowUnionTypes: true,
});
addFormats(ajv);

const validate = ajv.compile(schema);

if (!validate(example)) {
  console.error(ajv.errorsText(validate.errors, { separator: '\n' }));
  process.exitCode = 1;
} else {
  console.log(`Valid course: ${example.id}`);
}
