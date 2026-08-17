import { readFile, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const projectRoot = resolve(import.meta.dirname, '../..');
const requiredMetadataFields = [
  'id', 'slug', 'title', 'description', 'thumbnail', 'language', 'domain',
  'difficulty', 'estimatedMinutes', 'moduleCount', 'lessonCount', 'published',
  'version', 'storagePath',
];

const moduleLessons = (module) => Array.isArray(module.sections)
  ? module.sections.flatMap((section) => section.lessons ?? [])
  : module.lessons ?? [];

async function readJson(path, label) {
  let source;
  try {
    source = await readFile(path, 'utf8');
  } catch (error) {
    throw new Error(`Unable to read ${label} at ${path}.`, { cause: error });
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`${label} contains malformed JSON.`, { cause: error });
  }
}

function validateMetadata(metadata, courseKey) {
  const missing = requiredMetadataFields.filter((field) => metadata[field] === undefined);
  if (missing.length) throw new Error(`Course metadata is missing: ${missing.join(', ')}.`);
  if (!metadata.published) throw new Error('Course metadata must be published before it can be deployed.');
  if (metadata.storagePath !== `course-content/${courseKey}`) {
    throw new Error(`storagePath must be "course-content/${courseKey}".`);
  }
  if (!/^v[1-9]\d*$/.test(metadata.version)) {
    throw new Error('Course metadata version must use a version folder such as v1 or v2.');
  }
}

export async function loadAndValidateCourseBundle(courseKey) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(courseKey ?? '')) {
    throw new Error('Provide a course key such as "python".');
  }

  const metadataPath = resolve(projectRoot, 'firebase-content/firestore/courses', `${courseKey}.json`);
  const metadata = await readJson(metadataPath, 'Firestore course metadata');
  validateMetadata(metadata, courseKey);

  const bundleDirectory = resolve(projectRoot, 'firebase-content', metadata.storagePath, metadata.version);
  const manifestPath = resolve(bundleDirectory, 'course.json');
  const manifest = await readJson(manifestPath, 'course manifest');
  if (!Array.isArray(manifest.moduleFiles) || !manifest.moduleFiles.length) {
    throw new Error('course.json must contain a non-empty moduleFiles array.');
  }
  if (manifest.moduleFiles.some((file) => basename(file) !== file || !/^module-[1-9]\d*\.json$/.test(file))) {
    throw new Error('course.json contains an invalid module filename.');
  }
  if (!Array.isArray(manifest.modules) || manifest.modules.length !== manifest.moduleFiles.length) {
    throw new Error('course.json must contain one outline module for every module file.');
  }
  if (manifest.modules.some((module) =>
    !moduleLessons(module).length
    || moduleLessons(module).some((lesson) => !Array.isArray(lesson.blocks) || lesson.blocks.length))) {
    throw new Error('course.json outline lessons must contain empty blocks arrays.');
  }

  const moduleEntries = await Promise.all(manifest.moduleFiles.map(async (fileName) => {
    const localPath = resolve(bundleDirectory, fileName);
    return { fileName, localPath, content: await readJson(localPath, fileName) };
  }));
  const { moduleFiles: _moduleFiles, modules: _outlineModules, ...courseFields } = manifest;
  const course = { ...courseFields, modules: moduleEntries.map(({ content }) => content) };

  const schema = await readJson(resolve(projectRoot, 'schemas/learning-course.schema.json'), 'course schema');
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(course)) throw new Error(`Course schema validation failed:\n${ajv.errorsText(validate.errors, { separator: '\n' })}`);

  const lessonCount = course.modules.reduce((total, module) => total + moduleLessons(module).length, 0);
  if (metadata.id !== course.id || metadata.title !== course.title) {
    throw new Error('Firestore metadata identity does not match course.json.');
  }
  if (metadata.moduleCount !== course.modules.length || metadata.lessonCount !== lessonCount) {
    throw new Error('Firestore moduleCount or lessonCount does not match the generated bundle.');
  }

  const files = [
    ...moduleEntries.map(({ fileName, localPath }) => ({
      localPath,
      remotePath: `${metadata.storagePath}/${metadata.version}/${fileName}`,
    })),
    { localPath: manifestPath, remotePath: `${metadata.storagePath}/${metadata.version}/course.json` },
  ];
  const filesWithSize = await Promise.all(files.map(async (file) => ({
    ...file,
    size: (await stat(file.localPath)).size,
  })));

  return {
    courseKey,
    metadata,
    metadataPath,
    bundleDirectory,
    files: filesWithSize,
    metrics: {
      modules: course.modules.length,
      lessons: lessonCount,
      blocks: course.modules.flatMap(moduleLessons).flatMap((lesson) => lesson.blocks).length,
    },
  };
}
