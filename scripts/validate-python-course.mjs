import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { createCourseModel } from '../src/course/createCourseModel.js';
import { createCourseNavigation } from '../src/course/courseNavigation.js';
import { parseJson } from './utils/parseJson.mjs';

const coursePath = resolve('public/courses/python-course.json');
const metadataPath = resolve('public/courses/course-metadata.json');
const schemaPath = resolve('schemas/learning-course.schema.json');
const registryPath = resolve('src/components/blockRegistry.js');
const course = parseJson(await readFile(coursePath, 'utf8'), import.meta.url);
const metadata = parseJson(await readFile(metadataPath, 'utf8'), import.meta.url);
const schema = parseJson(await readFile(schemaPath, 'utf8'), import.meta.url);
const registrySource = await readFile(registryPath, 'utf8');
const failures = [];

const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv);
const validate = ajv.compile(schema);
if (!validate(course)) {
  failures.push(ajv.errorsText(validate.errors, { separator: '\n' }));
}

const metadataEntry = metadata.courses.find((entry) => entry.id === course.id);
if (!metadataEntry || metadataEntry.source !== '/courses/python-course.json') {
  failures.push('Course metadata does not point to /courses/python-course.json.');
}

const registeredTypes = new Set(
  [...registrySource.matchAll(/^\s{2}([a-z_]+):\s*\w+/gm)].map((match) => match[1]),
);
const lessons = course.modules.flatMap((module) =>
  module.lessons.map((lesson) => ({ module, lesson })),
);
const blocks = lessons.flatMap(({ module, lesson }) =>
  lesson.blocks.map((block) => ({ module, lesson, block })),
);
const allIds = [
  course.id,
  ...course.modules.map((module) => module.id),
  ...lessons.map(({ lesson }) => lesson.id),
  ...blocks.map(({ block }) => block.id),
];
const duplicateIds = allIds.filter((id, index) => allIds.indexOf(id) !== index);
if (duplicateIds.length) failures.push(`Duplicate IDs: ${[...new Set(duplicateIds)].join(', ')}`);

for (const { module, lesson } of lessons) {
  if (!lesson.number?.startsWith(`${course.modules.indexOf(module) + 1}.`)) {
    failures.push(`Lesson number ${lesson.number} does not match module ${module.id}.`);
  }
  if (!lesson.blocks.length) failures.push(`Lesson ${lesson.id} has no blocks.`);
}

for (const { lesson, block } of blocks) {
  if (!registeredTypes.has(block.type)) {
    failures.push(`Block ${block.id} uses unregistered type "${block.type}".`);
  }
  if (block.type === 'code' && !block.code.trim()) {
    failures.push(`Code block ${block.id} in ${lesson.id} is empty.`);
  }
  if (block.type === 'image') {
    try {
      const asset = await stat(resolve('public', block.src.replace(/^\//, '')));
      if (!asset.size) failures.push(`Image ${block.src} is empty.`);
    } catch {
      failures.push(`Image ${block.src} does not exist.`);
    }
  }
  if (block.type === 'quiz') {
    const optionIds = new Set(block.options.map((option) => option.id));
    if (block.options.length < 2) failures.push(`Quiz ${block.id} has fewer than two options.`);
    if (block.correctOptionIds.some((id) => !optionIds.has(id))) {
      failures.push(`Quiz ${block.id} references an unknown correct option.`);
    }
  }
  if (block.type === 'exercise') {
    if (!block.instructions.content.trim() || !block.objectives.length) {
      failures.push(`Exercise ${block.id} is missing instructions or objectives.`);
    }
  }
}

const serializedCourse = JSON.stringify(course);
if (/\b(?:placeholder|lorem ipsum|todo|tbd)\b/i.test(serializedCourse)) {
  failures.push('Course contains placeholder content.');
}

const model = createCourseModel(course);
const navigation = createCourseNavigation(model);
const visited = [];
let state = navigation.getState(model.navigation.defaultLessonId);

while (state.currentLesson) {
  if (visited.includes(state.currentLesson.id)) {
    failures.push(`Navigation loop detected at ${state.currentLesson.id}.`);
    break;
  }
  visited.push(state.currentLesson.id);
  if (!state.nextLesson) break;
  state = navigation.getState(state.nextLesson.id);
}

if (visited.length !== lessons.length) {
  failures.push(`Navigation reached ${visited.length} of ${lessons.length} lessons.`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({
  course: course.id,
  modules: course.modules.length,
  lessons: lessons.length,
  blocks: blocks.length,
  blockTypes: [...new Set(blocks.map(({ block }) => block.type))].sort(),
  images: blocks.filter(({ block }) => block.type === 'image').length,
  quizzes: blocks.filter(({ block }) => block.type === 'quiz').length,
  exercises: blocks.filter(({ block }) => block.type === 'exercise').length,
  navigationLessonsReached: visited.length,
  validation: 'passed',
}, null, 2));
