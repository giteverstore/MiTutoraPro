import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import mammoth from 'mammoth';
import { load } from 'cheerio';
import { createCourseModel } from '../src/course/createCourseModel.js';
import { createCourseNavigation } from '../src/course/courseNavigation.js';
import { createCourseOverviewModel } from '../src/course/createCourseOverviewModel.js';
import { CourseCompletionEngine } from '../functions/src/certification/CourseCompletionEngine.js';

const course = JSON.parse(await readFile(resolve('public/courses/python-course.json'), 'utf8'));
const metadata = JSON.parse(await readFile(resolve('public/courses/course-metadata.json'), 'utf8'));
const schema = JSON.parse(await readFile(resolve('schemas/learning-course.schema.json'), 'utf8'));
const manifest = JSON.parse(await readFile(resolve('firebase-content/course-content/python/v1/course.json'), 'utf8'));
const registry = await readFile(resolve('src/components/blockRegistry.js'), 'utf8');
const solutionRenderer = await readFile(resolve('src/components/blocks/SolutionBlock.jsx'), 'utf8');
const moduleItemSource = await readFile(resolve('src/components/ModuleItem.jsx'), 'utf8');
const certificationDefinitions = await readFile(resolve('functions/src/certification/trustedExamDefinitions.js'), 'utf8');
const expectedChapterLessonCounts = [6, 12, 5, 19, 14, 20, 9, 9, 7, 8];
const expectedChapterTitles = [
  '1.1 Get Started', '1.2 Numbers and Strings', '1.3 Comments', '1.4 Variables',
  '1.5 Output', '1.6 Arithmetic Operators', '1.7 Data Conversion',
  '1.8 Get User Input', '1.9 Introduction Examples', '1.10 Recall',
];
const expectedExerciseNumbers = [
  '1.5', '2.10', '2.12', '4.9', '4.12', '4.19', '5.5', '5.8', '5.12',
  '6.7', '6.13', '6.16', '6.18', '7.6', '8.4', '8.9', '9.3', '9.5',
];

const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv);
const validate = ajv.compile(schema);
assert.equal(validate(course), true, ajv.errorsText(validate.errors));
assert.equal(course.id, 'python');
assert.equal(course.slug, 'python');
assert.equal(course.title, 'Python Foundations');
assert.equal(course.metadata.level, 'beginner');
assert.equal(course.status, 'published');
assert.equal(course.modules.length, 1, 'Python Foundations must contain one top-level chapter module.');
const [foundationsModule] = course.modules;
assert.equal(foundationsModule.id, 'module-1-getting-started-with-python');
assert.equal(foundationsModule.title, 'CH 1: Getting Started with Python');
assert.equal(foundationsModule.sections.length, 10);
assert.deepEqual(foundationsModule.sections.map(({ title }) => title), expectedChapterTitles);
assert.deepEqual(foundationsModule.sections.map(({ lessons }) => lessons.length), expectedChapterLessonCounts);

const sourceConversion = await mammoth.convertToHtml({ path: resolve('Python Module 1.docx') });
const $ = load(sourceConversion.value);
const sourcePageNumbers = $('body').children().toArray()
  .map((element) => $(element).text().replace(/\u00a0/g, ' ').trim().match(/^PAGE\s+(\d+\.\d+)$/i)?.[1])
  .filter(Boolean);
assert.equal(sourcePageNumbers.length, 101, 'Every numbered DOCX page must be discoverable.');

const metadataEntries = metadata.courses.filter(({ id }) => id === course.id);
assert.equal(metadataEntries.length, 1, 'The canonical Python course must be registered exactly once.');
assert.equal(metadataEntries[0].source, '/courses/python-course.json');
assert.equal(metadataEntries[0].title, course.title);
assert.equal(metadataEntries[0].version, course.metadata.version);

const lessons = foundationsModule.sections.flatMap((section) => section.lessons);
const blocks = lessons.flatMap((lesson) => lesson.blocks);
const codeBlocks = blocks.filter(({ type }) => type === 'code');
const runnableExamples = codeBlocks.filter(({ mode }) => mode === 'runnable');
const lessonNumbers = new Set(lessons.map(({ number }) => number));
sourcePageNumbers.forEach((number) => assert.ok(lessonNumbers.has(number), `Source page ${number} must be represented.`));
const ids = [course.id, foundationsModule.id, ...foundationsModule.sections.map(({ id }) => id), ...lessons.map(({ id }) => id), ...blocks.map(({ id }) => id)];
assert.equal(new Set(ids).size, ids.length, 'Every course, module, lesson, and block ID must be unique.');
assert.equal(lessons.length, 109);
assert.equal(blocks.filter(({ type }) => type === 'quiz').length, 20);
assert.ok(codeBlocks.every(({ mode }) => ['display', 'runnable'].includes(mode)), 'Every Python example requires an explicit mode.');
assert.equal(runnableExamples.length, 62);
assert.equal(codeBlocks.find(({ code }) => code === '"This is a string."')?.mode, 'display');
assert.equal(codeBlocks.find(({ code }) => code.includes('print("This is a string.")'))?.mode, 'runnable');
assert.ok(runnableExamples.filter(({ stdin }) => stdin).length === 4, 'Runnable input examples require source-derived stdin.');
assert.deepEqual(
  lessons.filter(({ blocks: lessonBlocks }) => lessonBlocks.some(({ type }) => type === 'exercise')).map(({ number }) => number),
  expectedExerciseNumbers,
);

for (const lesson of lessons) {
  assert.ok(lesson.blocks.length, `${lesson.number} must contain renderable blocks.`);
  assert.equal(lesson.status, 'available', `${lesson.number} must remain freely navigable.`);
  for (const block of lesson.blocks) {
    assert.match(registry, new RegExp(`\\b${block.type}:`), `${block.type} must have a registered renderer.`);
    if (block.type === 'code') assert.ok(block.code.trim(), `${block.id} must not be empty.`);
    if (block.type === 'image') {
      assert.ok(block.alt.trim(), `${block.id} requires source-derived alternative text.`);
      const file = await stat(resolve('public', block.src.replace(/^\//, '')));
      assert.ok(file.size, `${block.src} must contain image data.`);
    }
    if (block.type === 'quiz') {
      assert.equal(block.options.length, 4, `${block.id} must preserve all four source options.`);
      assert.equal(block.correctOptionIds.length, 1);
      assert.ok(block.options.some(({ id }) => block.correctOptionIds.includes(id)));
    }
  }
}

for (const lesson of lessons.filter(({ number }) => expectedExerciseNumbers.includes(number))) {
  const exercise = lesson.blocks.find(({ type }) => type === 'exercise');
  const compiler = lesson.blocks.find(({ type }) => type === 'compiler');
  const solution = lesson.blocks.find(({ type }) => type === 'solution');
  const starterCode = compiler?.starterCode ?? compiler?.files?.find(({ name }) => name === compiler.activeFile)?.content ?? '';
  assert.ok(exercise?.instructions.content.trim(), `${lesson.number} requires exercise instructions.`);
  assert.equal(compiler?.language, 'python');
  assert.ok(starterCode.trim(), `${lesson.number} requires starter code.`);
  assert.ok(compiler?.expectedOutput.trim(), `${lesson.number} requires expected output.`);
  assert.equal(compiler?.validation.type, 'normalized_output');
  assert.ok(solution?.code.trim(), `${lesson.number} requires a revealable source solution.`);
  assert.ok(!starterCode.includes(solution.code), `${lesson.number} must not leak its solution into starter code.`);
}

assert.equal(manifest.id, course.id);
assert.deepEqual(manifest.moduleFiles, ['module-1.json']);
assert.equal(manifest.modules.length, 1);
assert.equal(manifest.modules[0].sections.length, 10);
const moduleFile = JSON.parse(await readFile(resolve('firebase-content/course-content/python/v1/module-1.json'), 'utf8'));
assert.deepEqual(moduleFile, foundationsModule);
assert.ok(manifest.modules[0].sections.every((section) =>
  section.lessons.every(({ blocks: outlineBlocks }) => outlineBlocks.length === 0)));
const generatedModuleFiles = (await readdir(resolve('firebase-content/course-content/python/v1')))
  .filter((file) => /^module-\d+\.json$/.test(file));
assert.deepEqual(generatedModuleFiles, ['module-1.json'], 'The generated bundle must contain exactly one module file.');

const model = createCourseModel(course);
assert.equal(model.modules.length, 1);
assert.equal(model.modules[0].sections.length, 10);
assert.deepEqual(model.modules[0].sections.map(({ lessons: chapterLessons }) => chapterLessons.length), expectedChapterLessonCounts);
assert.equal(model.modules[0].lessons.length, 109);
const overview = createCourseOverviewModel(model, {
  completedLessons: [],
  sequentialCompletedLessons: 0,
});
assert.equal(overview.moduleCount, 1);
assert.equal(overview.lessonCount, 109);
assert.equal(overview.quizCount, 20);
assert.equal(overview.exerciseCount, 18);
assert.equal(overview.estimatedDuration, '12 hr 32 min');
assert.equal(overview.modules[0].sections.length, 10);
assert.deepEqual(overview.modules[0].sections.map(({ lessonCount }) => lessonCount), expectedChapterLessonCounts);
const navigation = createCourseNavigation(model);
const visited = [];
let state = navigation.getState(model.navigation.defaultLessonId);
while (state.currentLesson) {
  assert.ok(!visited.includes(state.currentLesson.id), `Navigation loop at ${state.currentLesson.id}.`);
  visited.push(state.currentLesson.id);
  if (!state.nextLesson) break;
  state = navigation.getState(state.nextLesson.id);
}
assert.equal(visited.length, lessons.length, 'Navigation must reach every lesson and the completion boundary.');
assert.equal(state.nextLesson, null);
assert.ok(blocks.some(({ type, stdin }) => type === 'compiler' && stdin), 'Input exercises must preserve test input.');
assert.ok(blocks.some(({ type }) => type === 'compiler'), 'Runnable examples must use the existing compiler block.');
assert.ok(blocks.some(({ type }) => type === 'solution'), 'Solutions must use the collapsed solution renderer.');
assert.match(solutionRenderer, /<details\b/, 'Solutions must remain collapsed until the learner reveals them.');
assert.match(moduleItemSource, /function ChapterGroup/, 'Chapter groups require a reusable sidebar component.');
assert.match(moduleItemSource, /aria-expanded=\{isExpanded\}/, 'Chapter groups must expose their independent expanded state accessibly.');
assert.match(certificationDefinitions, /courseId:\s*'python'/, 'Certification must remain attached to canonical course ID python.');
const trustedRequirements = new CourseCompletionEngine().requirements(course);
assert.equal(trustedRequirements.courseId, 'python');
assert.equal(trustedRequirements.moduleCount, 1);
assert.equal(trustedRequirements.requiredLessonIds.length, 109, 'Trusted completion must derive all 109 lessons.');
assert.ok(JSON.stringify(course).includes('https://programiz.pro/resources/python-printing-basics/'), 'Source hyperlinks must be preserved.');
const referencedAssets = new Set(blocks.flatMap((block) => [
  ...(block.type === 'image' ? [block.src] : []),
  ...(block.type === 'note' && block.iconSrc ? [block.iconSrc] : []),
]));
const extractedAssets = await readdir(resolve('public/assets/courses/python-foundations'));
assert.equal(extractedAssets.length, 18);
assert.equal(referencedAssets.size, 18, 'All 18 extracted assets must be referenced by course content.');
for (const asset of extractedAssets) {
  assert.ok(referencedAssets.has(`/assets/courses/python-foundations/${asset}`), `${asset} must be referenced.`);
}

console.log(JSON.stringify({
  course: course.id,
  runtimeHierarchy: {
    module: model.modules[0].title,
    sections: model.modules[0].sections.map((section) => ({
      id: section.id,
      title: section.title,
      lessons: section.lessons.map((lesson) => lesson.id),
    })),
  },
  modules: course.modules.length,
  sections: foundationsModule.sections.length,
  lessons: lessons.length,
  quizzes: blocks.filter(({ type }) => type === 'quiz').length,
  exercises: blocks.filter(({ type }) => type === 'exercise').length,
  runnableExamples: runnableExamples.length,
  solutions: blocks.filter(({ type }) => type === 'solution').length,
  extractedAssets: extractedAssets.length,
  navigationLessonsReached: visited.length,
  validation: 'passed',
}, null, 2));
