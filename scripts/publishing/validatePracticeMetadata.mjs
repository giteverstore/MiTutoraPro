import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createPracticeMetadata } from '../../src/content/models/practiceMetadata.js';

const readJson = (url) => readFile(url, 'utf8').then(JSON.parse);
const courseSchema = await readJson(resolve('schemas/learning-course.schema.json'));
const practiceSchema = await readJson(resolve('schemas/practice-question.schema.json'));
const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv);
ajv.addSchema(courseSchema);
ajv.addSchema(practiceSchema);
const validateSchema = ajv.getSchema(`${practiceSchema.$id}#/$defs/firestoreMetadata`);

export function validatePracticeMetadataRecord(record) {
  if (!validateSchema(record)) {
    throw new Error(`Practice metadata is invalid: ${ajv.errorsText(validateSchema.errors)}`);
  }
  return createPracticeMetadata(record);
}
