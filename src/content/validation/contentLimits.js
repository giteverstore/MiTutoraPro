export const CONTENT_LIMITS = Object.freeze({
  course: Object.freeze({
    maxManifestBytes: 1024 * 1024,
    maxCourseBytes: 8 * 1024 * 1024,
    maxModuleBytes: 2 * 1024 * 1024,
    maxLessonBytes: 256 * 1024,
    maxLessonsPerModule: 500,
    maxBlocksPerLesson: 100,
    maxBlockDepth: 12,
    maxTextCharacters: 50_000,
    maxCodeCharacters: 100_000,
    maxQuizOptions: 20,
    maxExamples: 20,
  }),
  practice: Object.freeze({
    maxQuestionBytes: 256 * 1024,
    maxMetadataBytes: 16 * 1024,
    maxStatementCharacters: 50_000,
    maxStarterCodeCharacters: 100_000,
    maxCompilerConfigurationBytes: 192 * 1024,
    maxExamples: 20,
    maxOptions: 20,
    maxTests: 100,
    maxDepth: 12,
  }),
  runtime: Object.freeze({
    maxCourseDownloadBytes: 8 * 1024 * 1024,
    maxPracticeDownloadBytes: 512 * 1024,
    maxChallengeDownloadBytes: 512 * 1024,
  }),
});

export const utf8ByteLength = (value) => new TextEncoder().encode(
  typeof value === 'string' ? value : JSON.stringify(value),
).byteLength;

export function contentDepth(value, depth = 0) {
  if (value === null || typeof value !== 'object') return depth;
  const children = Array.isArray(value) ? value : Object.values(value);
  return children.reduce((maximum, child) => Math.max(maximum, contentDepth(child, depth + 1)), depth);
}

export function assertLimit(actual, limit, label) {
  if (actual > limit) throw new Error(`${label} exceeds the limit (${actual} > ${limit}).`);
}

const lessonBlocks = (module) => (module.sections ?? [{ lessons: module.lessons ?? [] }])
  .flatMap((section) => section.lessons ?? []);

function inspectStrings(value, visit, key = '') {
  if (typeof value === 'string') visit(value, key);
  else if (Array.isArray(value)) value.forEach((item) => inspectStrings(item, visit, key));
  else if (value && typeof value === 'object') Object.entries(value)
    .forEach(([childKey, child]) => inspectStrings(child, visit, childKey));
}

function valuesForKey(value, expectedKey, result = []) {
  if (!value || typeof value !== 'object') return result;
  for (const [key, child] of Object.entries(value)) {
    if (key === expectedKey) result.push(child);
    valuesForKey(child, expectedKey, result);
  }
  return result;
}

export function validateCourseComplexity(course, limits = CONTENT_LIMITS.course) {
  assertLimit(utf8ByteLength(course), limits.maxCourseBytes, 'Course JSON');
  for (const module of course.modules ?? []) {
    const lessons = lessonBlocks(module);
    assertLimit(utf8ByteLength(module), limits.maxModuleBytes, `Module ${module.id ?? '(unknown)'}`);
    assertLimit(lessons.length, limits.maxLessonsPerModule, `Module ${module.id ?? '(unknown)'} lesson count`);
    for (const lesson of lessons) {
      assertLimit(utf8ByteLength(lesson), limits.maxLessonBytes, `Lesson ${lesson.id ?? '(unknown)'}`);
      assertLimit(lesson.blocks?.length ?? 0, limits.maxBlocksPerLesson, `Lesson ${lesson.id ?? '(unknown)'} block count`);
      assertLimit(contentDepth(lesson.blocks ?? []), limits.maxBlockDepth, `Lesson ${lesson.id ?? '(unknown)'} block depth`);
      inspectStrings(lesson.blocks ?? [], (text, key) => {
        const isCode = /code|starterCode|expectedOutput|stdin|content/i.test(key) && /code|starter/i.test(key);
        assertLimit(text.length, isCode ? limits.maxCodeCharacters : limits.maxTextCharacters,
          `Lesson ${lesson.id ?? '(unknown)'} ${isCode ? 'code' : 'text'} field`);
      });
      for (const block of lesson.blocks ?? []) {
        if (block.type === 'quiz') assertLimit(block.options?.length ?? 0, limits.maxQuizOptions, `Quiz ${block.id} option count`);
        if (Array.isArray(block.examples)) assertLimit(block.examples.length, limits.maxExamples, `Block ${block.id} example count`);
      }
    }
  }
  return course;
}

export function validatePracticeComplexity(question, limits = CONTENT_LIMITS.practice) {
  assertLimit(utf8ByteLength(question), limits.maxQuestionBytes, `Practice question ${question.id ?? '(unknown)'}`);
  assertLimit(contentDepth(question), limits.maxDepth, `Practice question ${question.id ?? '(unknown)'} depth`);
  inspectStrings(question.blocks ?? question, (text, key) => {
    assertLimit(text.length, /code|source/i.test(key) ? limits.maxStarterCodeCharacters : limits.maxStatementCharacters,
      `Practice question ${question.id ?? '(unknown)'} ${/code|source/i.test(key) ? 'code' : 'text'} field`);
  });
  valuesForKey(question, 'examples').forEach((items) => assertLimit(items?.length ?? 0, limits.maxExamples, `Practice question ${question.id ?? '(unknown)'} example count`));
  valuesForKey(question, 'options').forEach((items) => assertLimit(items?.length ?? 0, limits.maxOptions, `Practice question ${question.id ?? '(unknown)'} option count`));
  [...valuesForKey(question, 'publicTests'), ...valuesForKey(question, 'testCases')]
    .forEach((items) => assertLimit(items?.length ?? 0, limits.maxTests, `Practice question ${question.id ?? '(unknown)'} test count`));
  valuesForKey(question, 'compiler').forEach((compiler) => assertLimit(utf8ByteLength(compiler), limits.maxCompilerConfigurationBytes, `Practice question ${question.id ?? '(unknown)'} compiler configuration`));
  return question;
}
