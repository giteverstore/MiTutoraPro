import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const moduleLessons = (module) => module.sections?.flatMap((section) => section.lessons) ?? module.lessons ?? [];
const publishingMetadata = JSON.parse(await readFile(resolve('firebase-content/firestore/courses/python.json'), 'utf8'));
const bundleRoot = resolve('firebase-content/course-content/python', publishingMetadata.version);
const manifest = JSON.parse(await readFile(resolve(bundleRoot, 'course.json'), 'utf8'));
const modules = await Promise.all(manifest.moduleFiles.map(async (file) =>
  JSON.parse(await readFile(resolve(bundleRoot, file), 'utf8'))));

assert.deepEqual(
  manifest.moduleFiles,
  Array.from({ length: publishingMetadata.moduleCount }, (_, index) => `module-${index + 1}.json`),
);
assert.equal(manifest.modules.length, publishingMetadata.moduleCount);
assert.equal(manifest.modules.every((module) => moduleLessons(module)
  .every((lesson) => Array.isArray(lesson.blocks) && lesson.blocks.length === 0)), true);

const { moduleFiles: _moduleFiles, modules: _outlineModules, ...courseFields } = manifest;
const mergedCourse = { ...courseFields, modules };
const localCourse = JSON.parse(await readFile(resolve('public/courses/python-course.json'), 'utf8'));
const schema = JSON.parse(await readFile(resolve('schemas/learning-course.schema.json'), 'utf8'));
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
  'The Firebase bundle must reconstruct the canonical local course.',
);

const lessons = modules.flatMap(moduleLessons);
const blocks = lessons.flatMap((lesson) => lesson.blocks);
assert.equal(lessons.length, publishingMetadata.lessonCount);

console.log(JSON.stringify({
  modules: modules.length,
  sections: modules.reduce((total, module) => total + (module.sections?.length ?? 0), 0),
  lessons: lessons.length,
  blocks: blocks.length,
  quizzes: blocks.filter((block) => block.type === 'quiz').length,
  exercises: blocks.filter((block) => block.type === 'exercise').length,
  compilers: blocks.filter((block) => block.type === 'compiler').length,
  schema: 'passed',
  localParity: 'passed',
}, null, 2));
