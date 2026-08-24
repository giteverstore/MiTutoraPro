import { readFile, readdir } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { contentDepth, utf8ByteLength } from '../src/content/validation/contentLimits.js';

const root = resolve(import.meta.dirname, '..');
const maximum = (current, value, label) => value > current.value ? { value, label } : current;
const modulesOf = (module) => (module.sections ?? [{ lessons: module.lessons ?? [] }]).flatMap((section) => section.lessons ?? []);
const allStrings = (value, result = []) => {
  if (typeof value === 'string') result.push(value);
  else if (Array.isArray(value)) value.forEach((item) => allStrings(item, result));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => allStrings(item, result));
  return result;
};

const course = {
  lessonsPerModule: { value: 0 }, blocksPerLesson: { value: 0 }, blockDepth: { value: 0 },
  textPerBlock: { value: 0 }, codePerBlock: { value: 0 }, lessonBytes: { value: 0 },
  moduleBytes: { value: 0 }, manifestBytes: { value: 0 }, courseBytes: { value: 0 },
};
const manifests = [];
for (const language of await readdir(resolve(root, 'firebase-content/course-content'))) {
  const languageRoot = resolve(root, 'firebase-content/course-content', language);
  for (const version of await readdir(languageRoot)) {
    const versionRoot = resolve(languageRoot, version);
    const manifestPath = resolve(versionRoot, 'course.json');
    let manifest;
    try { manifest = JSON.parse(await readFile(manifestPath, 'utf8')); } catch { continue; }
    const label = `${language}/${version}`;
    course.manifestBytes = maximum(course.manifestBytes, (await readFile(manifestPath)).byteLength, label);
    const modules = [];
    for (const file of manifest.moduleFiles ?? []) {
      const bytes = await readFile(resolve(versionRoot, file));
      const module = JSON.parse(bytes.toString('utf8'));
      modules.push(module);
      course.moduleBytes = maximum(course.moduleBytes, bytes.byteLength, `${label}/${file}`);
      const lessons = modulesOf(module);
      course.lessonsPerModule = maximum(course.lessonsPerModule, lessons.length, `${label}/${module.id}`);
      for (const lesson of lessons) {
        course.lessonBytes = maximum(course.lessonBytes, utf8ByteLength(lesson), `${label}/${lesson.id}`);
        course.blocksPerLesson = maximum(course.blocksPerLesson, lesson.blocks?.length ?? 0, `${label}/${lesson.id}`);
        course.blockDepth = maximum(course.blockDepth, contentDepth(lesson.blocks ?? []), `${label}/${lesson.id}`);
        for (const block of lesson.blocks ?? []) {
          const strings = allStrings(block);
          const largest = Math.max(0, ...strings.map((value) => value.length));
          course.textPerBlock = maximum(course.textPerBlock, largest, `${label}/${block.id}`);
          const code = Math.max(0, ...['code', 'starterCode'].map((key) => String(block[key] ?? '').length));
          course.codePerBlock = maximum(course.codePerBlock, code, `${label}/${block.id}`);
        }
      }
    }
    const { moduleFiles: _files, modules: _outline, ...fields } = manifest;
    course.courseBytes = maximum(course.courseBytes, utf8ByteLength({ ...fields, modules }), label);
    manifests.push(label);
  }
}

const practice = {
  statementCharacters: { value: 0 }, examples: { value: 0 }, options: { value: 0 },
  starterCodeCharacters: { value: 0 }, compilerBytes: { value: 0 }, questionBytes: { value: 0 },
  metadataBytes: { value: 0 }, depth: { value: 0 },
};
const metadata = JSON.parse(await readFile(resolve(root, 'firebase-content/firestore/practiceQuestions.json'), 'utf8'));
for (const record of metadata) {
  practice.metadataBytes = maximum(practice.metadataBytes, utf8ByteLength(record), record.id);
  const path = resolve(root, 'firebase-content', 'practice/python', record.version, basename(record.storagePath));
  const bytes = await readFile(path);
  const question = JSON.parse(bytes.toString('utf8'));
  practice.questionBytes = maximum(practice.questionBytes, bytes.byteLength, record.id);
  practice.statementCharacters = maximum(practice.statementCharacters, String(question.statement ?? question.problemStatement ?? '').length, record.id);
  practice.examples = maximum(practice.examples, question.examples?.length ?? 0, record.id);
  practice.options = maximum(practice.options, question.options?.length ?? 0, record.id);
  practice.starterCodeCharacters = maximum(practice.starterCodeCharacters, String(question.starterCode ?? '').length, record.id);
  practice.compilerBytes = maximum(practice.compilerBytes, utf8ByteLength(question.compiler ?? question.execution ?? {}), record.id);
  practice.depth = maximum(practice.depth, contentDepth(question), record.id);
}

console.log(JSON.stringify({ measuredAt: new Date().toISOString(), manifests, course, practice }, null, 2));
