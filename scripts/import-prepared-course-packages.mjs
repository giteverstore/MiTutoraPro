import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { CONTENT_LIMITS, validateCourseComplexity } from '../src/content/validation/contentLimits.js';

const sourceRoot = resolve(process.argv[2] ?? '');
if (!process.argv[2]) throw new Error('Provide the extracted package root.');

const projectRoot = resolve(import.meta.dirname, '..');
const packages = [
  {
    directory: 'foundations', sourceId: 'python-foundations', id: 'python', version: 'v3',
    semanticVersion: '3.0.0', publicFile: 'python-course.json',
    thumbnail: '/assets/courses/python-foundations/image1.png',
  },
  {
    directory: 'basics', sourceId: 'python-basics-practice', id: 'python-basics-practice', version: 'v1',
    semanticVersion: '1.0.0', publicFile: 'python-basics-practice.json',
    thumbnail: '/assets/course-cards/python-basics-practice.png',
  },
  {
    directory: 'intermediate', sourceId: 'python-intermediate-practice', id: 'python-intermediate-practice', version: 'v1',
    semanticVersion: '1.0.0', publicFile: 'python-intermediate-practice.json',
    thumbnail: '/assets/course-cards/python-intermediate-practice.png',
  },
];

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const writeJson = async (path, value) => {
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
};

const schema = await readJson(resolve(projectRoot, 'schemas/learning-course.schema.json'));
const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv);
const validate = ajv.compile(schema);

function isoDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return `${value}T00:00:00.000Z`;
  return value;
}

function paragraph(block, content = block.content) {
  return { id: block.id, type: 'paragraph', content, format: 'plain' };
}

function transformBlocks(blocks) {
  if (blocks.length <= CONTENT_LIMITS.course.maxBlocksPerLesson) return blocks.map((block) => paragraph(block));
  const groupSize = Math.ceil(blocks.length / CONTENT_LIMITS.course.maxBlocksPerLesson);
  const grouped = [];
  for (let index = 0; index < blocks.length; index += groupSize) {
    const group = blocks.slice(index, index + groupSize);
    grouped.push(paragraph(group[0], group.map(({ content }) => content).join('\n\n')));
  }
  return grouped;
}

function transformCourse(source, config) {
  const modules = source.modules.map((module) => ({
    id: module.id,
    title: module.title,
    ...(module.description ? { description: module.description } : {}),
    initiallyExpanded: module.expanded ?? module.initiallyExpanded ?? false,
    lessons: module.lessons.map((lesson) => ({
      id: lesson.id,
      ...(lesson.number ? { number: String(lesson.number) } : {}),
      title: lesson.title,
      summary: lesson.summary ?? '',
      status: lesson.status === 'published' ? 'available' : lesson.status,
      estimatedMinutes: lesson.estimatedMinutes,
      blocks: lesson.blocks.length
        ? transformBlocks(lesson.blocks)
        : [{ id: `${lesson.id}-content`, type: 'paragraph', content: lesson.summary || lesson.title, format: 'plain' }],
    })),
  }));
  return {
    schemaVersion: '1.0.0',
    id: config.id,
    slug: config.id,
    title: source.title,
    description: source.description,
    locale: source.locale,
    status: 'published',
    metadata: {
      version: config.semanticVersion,
      authors: source.metadata.authors.map((author) => typeof author === 'string' ? { name: author } : author),
      level: source.metadata.level,
      estimatedMinutes: source.metadata.estimatedMinutes,
      tags: source.metadata.tags,
      ...(source.metadata.createdAt ? { createdAt: isoDate(source.metadata.createdAt) } : {}),
      updatedAt: isoDate(source.metadata.updatedAt),
    },
    navigation: {
      defaultLessonId: source.navigation.defaultLessonId,
      sequence: 'module-order',
      skipLockedLessons: source.navigation.skipLockedLessons ?? false,
      labels: {
        previous: source.navigation.labels?.previous ?? source.navigation.previousLabel ?? 'Previous lesson',
        next: source.navigation.labels?.next ?? source.navigation.nextLabel ?? 'Next lesson',
        progress: 'Course progress',
        currentLesson: 'Current lesson',
      },
    },
    modules,
  };
}

function lessonCount(course) {
  return course.modules.reduce((total, module) => total + module.lessons.length, 0);
}

const catalogPath = resolve(projectRoot, 'public/courses/course-metadata.json');
const catalog = await readJson(catalogPath);
const results = [];

for (const config of packages) {
  const packageRoot = resolve(sourceRoot, config.directory);
  const source = await readJson(resolve(packageRoot, 'public/courses', `${config.sourceId}.json`));
  const course = transformCourse(source, config);
  if (!validate(course)) throw new Error(`${config.id} schema validation failed:\n${ajv.errorsText(validate.errors, { separator: '\n' })}`);
  validateCourseComplexity(course);

  const publicPath = resolve(projectRoot, 'public/courses', config.publicFile);
  await writeJson(publicPath, course);

  const bundleRoot = resolve(projectRoot, 'firebase-content/course-content', config.id, config.version);
  await mkdir(bundleRoot, { recursive: true });
  const moduleFiles = [];
  for (let index = 0; index < course.modules.length; index += 1) {
    const fileName = `module-${index + 1}.json`;
    moduleFiles.push(fileName);
    await writeJson(resolve(bundleRoot, fileName), course.modules[index]);
  }
  const outline = {
    ...course,
    modules: course.modules.map((module) => ({
      ...module,
      lessons: module.lessons.map((lesson) => ({ ...lesson, blocks: [] })),
    })),
    moduleFiles,
  };
  await writeJson(resolve(bundleRoot, 'course.json'), outline);

  const metadata = {
    id: config.id,
    slug: config.id,
    title: course.title,
    description: course.description,
    thumbnail: config.thumbnail,
    language: 'python',
    domain: 'programming',
    difficulty: course.metadata.level,
    estimatedMinutes: course.metadata.estimatedMinutes,
    moduleCount: course.modules.length,
    lessonCount: lessonCount(course),
    published: true,
    version: config.version,
    storagePath: `course-content/${config.id}`,
  };
  await writeJson(resolve(projectRoot, 'firebase-content/firestore/courses', `${config.id}.json`), metadata);

  const entry = {
    id: config.id,
    title: course.title,
    description: course.description,
    version: config.semanticVersion,
    publishedVersion: config.version,
    source: `/courses/${config.publicFile}`,
  };
  catalog.courses = [...catalog.courses.filter(({ id }) => id !== config.id), entry];

  const assetRoot = resolve(packageRoot, 'public/assets/courses', config.sourceId);
  try {
    const assetNames = await readdir(assetRoot);
    const target = resolve(projectRoot, 'public/assets/courses', config.sourceId);
    await mkdir(target, { recursive: true });
    await Promise.all(assetNames.map((name) => copyFile(resolve(assetRoot, name), resolve(target, basename(name)))));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  results.push({
    id: config.id,
    version: config.version,
    modules: course.modules.length,
    lessons: metadata.lessonCount,
    blocks: course.modules.flatMap(({ lessons }) => lessons).flatMap(({ blocks }) => blocks).length,
    storagePath: `${metadata.storagePath}/${metadata.version}`,
  });
}

await writeJson(catalogPath, catalog);
console.log(JSON.stringify(results, null, 2));
