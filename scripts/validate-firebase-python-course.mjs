import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parseJson } from './utils/parseJson.mjs';

const bundleRoot = resolve('firebase-content/course-content/python/v1');
const manifest = parseJson(await readFile(resolve(bundleRoot, 'course.json'), 'utf8'), import.meta.url);
const modules = await Promise.all(manifest.moduleFiles.map(async (file) =>
  parseJson(await readFile(resolve(bundleRoot, file), 'utf8'), import.meta.url)));
const { moduleFiles: _moduleFiles, ...courseFields } = manifest;
const mergedCourse = { ...courseFields, modules };
const localCourse = parseJson(await readFile(resolve('public/courses/python-course.json'), 'utf8'), import.meta.url);

const schema = parseJson(await readFile(resolve('schemas/learning-course.schema.json'), 'utf8'), import.meta.url);
const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv);
const validate = ajv.compile(schema);
assert.equal(validate(mergedCourse), true, ajv.errorsText(validate.errors));
const normalizeGeneratedTimestamp = (course) => ({
  ...course,
  metadata: { ...course.metadata, updatedAt: '<generated-at-conversion>' },
});
assert.deepEqual(
  normalizeGeneratedTimestamp(mergedCourse),
  normalizeGeneratedTimestamp(localCourse),
  'The Firebase bundle must reconstruct the existing Python course exactly apart from its generated timestamp.',
);

const lessons = modules.flatMap((module) => module.lessons);
const blocks = lessons.flatMap((lesson) => lesson.blocks);
assert.equal(lessons.length, 68, 'The Firebase bundle must contain all 68 lessons.');
assert.ok(blocks.some((block) => block.type === 'quiz'), 'The Firebase bundle must preserve quizzes.');
assert.ok(blocks.some((block) => block.type === 'exercise'), 'The Firebase bundle must preserve exercises.');
assert.ok(blocks.some((block) => block.type === 'compiler'), 'The Firebase bundle must preserve compiler blocks.');

console.log(JSON.stringify({
  modules: modules.length,
  lessons: lessons.length,
  blocks: blocks.length,
  quizzes: blocks.filter((block) => block.type === 'quiz').length,
  exercises: blocks.filter((block) => block.type === 'exercise').length,
  compilers: blocks.filter((block) => block.type === 'compiler').length,
  schema: 'passed',
  localParity: 'passed',
}, null, 2));
