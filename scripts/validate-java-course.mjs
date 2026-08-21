import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import mammoth from 'mammoth';
import { load } from 'cheerio';
import { createCourseModel } from '../src/course/createCourseModel.js';
import { createCourseNavigation } from '../src/course/courseNavigation.js';
import { resolveLessonModuleNumber } from '../src/course/courseStructure.js';

const readJson = async (path) => JSON.parse(await readFile(resolve(path), 'utf8'));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const course = await readJson('public/courses/java-course.json');
const localMetadata = await readJson('public/courses/course-metadata.json');
const firebaseMetadata = await readJson('firebase-content/firestore/courses/java.json');
const manifest = await readJson('firebase-content/course-content/java/v1/course.json');
const schema = await readJson('schemas/learning-course.schema.json');
const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true }); addFormats(ajv);
const validate = ajv.compile(schema); assert(validate(course), ajv.errorsText(validate.errors, { separator: '\n' }));
const lessons = course.modules.flatMap((module) => module.sections.flatMap((section) => section.lessons));
const blocks = lessons.flatMap((lesson) => lesson.blocks);
const sourceHtml = await mammoth.convertToHtml({ path: resolve('JAVA BASICS UPDATED.docx') });
const $ = load(sourceHtml.value);
const sourceLessons = $('body').children().toArray().map((node) => $(node).text().replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()).map((text) => text.match(/^(\d+\.\d+\.\d+)\s*:\s*(.+)$/)).filter(Boolean).map((match) => ({ number: match[1], title: match[2].trim() }));
const ids = [course.id, ...course.modules.map((m) => m.id), ...course.modules.flatMap((m) => m.sections.map((s) => s.id)), ...lessons.map((l) => l.id), ...blocks.map((b) => b.id)];
assert(course.id === 'java' && course.slug === 'java', 'Java course identity must be canonical.');
assert(course.modules.length === 5, `Expected 5 chapters; found ${course.modules.length}.`);
assert(course.modules.reduce((n, m) => n + m.sections.length, 0) === 34, 'Expected 34 source sections.');
assert(lessons.length === 363, `Expected 363 lessons; found ${lessons.length}.`);
assert(JSON.stringify(lessons.map(({ number, title }) => ({ number, title }))) === JSON.stringify(sourceLessons), 'Generated lesson order, numbering, or titles differ from the DOCX source.');
const courseModel = createCourseModel(course);
const navigation = createCourseNavigation(courseModel);
assert(courseModel.compiler.language === 'java' && courseModel.compiler.editor.fileName === 'Main.java', 'The shared compiler dock must derive Java defaults from course metadata.');
course.modules.forEach((module, moduleIndex) => {
  module.sections.flatMap((section) => section.lessons).forEach((lesson) => {
    assert(resolveLessonModuleNumber(lesson.id, course.modules) === moduleIndex + 1, `Lazy loading resolves ${lesson.id} to the wrong module.`);
  });
});
let navigationLesson = navigation.getState(course.navigation.defaultLessonId).currentLesson;
const reachedLessonIds = [];
while (navigationLesson) {
  reachedLessonIds.push(navigationLesson.id);
  navigationLesson = navigation.getState(navigationLesson.id).nextLesson;
}
assert(JSON.stringify(reachedLessonIds) === JSON.stringify(lessons.map(({ id }) => id)), 'Linear navigation does not reach all Java lessons in source order.');
assert(new Set(ids).size === ids.length, 'Course IDs must be unique.');
assert(lessons.every((lesson) => lesson.blocks.length), 'Every lesson must contain content.');
assert(localMetadata.courses.some(({ id, source }) => id === 'java' && source === '/courses/java-course.json'), 'Local course registry is missing Java.');
assert(firebaseMetadata.moduleCount === 5 && firebaseMetadata.lessonCount === 363, 'Firebase metadata counts differ from the course.');
assert(manifest.moduleFiles.length === 5 && manifest.modules.every((module) => module.sections.every((section) => section.lessons.every((lesson) => lesson.blocks.length === 0))), 'Firebase manifest outline is invalid.');
for (let index = 0; index < course.modules.length; index += 1) {
  const bundledModule = await readJson(`firebase-content/course-content/java/v1/module-${index + 1}.json`);
  assert(JSON.stringify(bundledModule) === JSON.stringify(course.modules[index]), `Firebase module-${index + 1}.json differs from the canonical course.`);
}
const compilerBlocks = blocks.filter((block) => block.type === 'compiler');
assert(compilerBlocks.length === 57, 'Every Java exercise must have one compiler block.');
assert(compilerBlocks.every((block) => block.language === 'java' && block.activeFile === 'Main.java' && block.expectedOutput), 'Every Java compiler block must use Main.java and preserve expected output.');
assert(blocks.filter((block) => block.type === 'quiz').length === 43, 'Expected 43 graded quizzes with source answer keys.');
assert(lessons.filter((lesson) => /quiz/i.test(lesson.title)).length === 46, 'All 46 source quiz lessons must be represented.');
assert(blocks.filter((block) => block.type === 'exercise').length === 57, 'Expected 57 programming problems.');
assert(blocks.filter((block) => block.type === 'solution').length === 57, 'Expected 57 source solutions.');
const exercisesWithoutSolutions = lessons.filter((lesson) => lesson.blocks.some((block) => block.type === 'exercise') && !lesson.blocks.some((block) => block.type === 'solution'));
assert(exercisesWithoutSolutions.length === 0, 'Every programming problem must preserve its source solution.');
const imageBlocks = blocks.filter((block) => block.type === 'image');
assert(imageBlocks.length === 41 && new Set(imageBlocks.map(({ src }) => src)).size === 41, 'All 41 embedded source images must be represented exactly once.');
await Promise.all(imageBlocks.map(({ src }) => access(resolve('public', src.replace(/^\//, '')))));
console.log(JSON.stringify({ course: course.id, modules: 5, sections: 34, lessons: 363, gradedQuizzes: 43, sourceQuizLessons: 46, exercises: 57, compilers: 57, solutions: 57, assets: 41, schema: 'passed', ids: 'unique', runtime: 'teavm' }, null, 2));
