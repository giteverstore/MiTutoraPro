import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';

const PROJECT_ID = 'mi-tutora-pro';
const STORAGE_PATH = 'course-content/python/v2/module-1.json';
const LOCAL_PATH = 'firebase-content/course-content/python/v2/module-1.json';

if (process.env.FIREBASE_PROJECT_ID !== PROJECT_ID) {
  throw new Error(`FIREBASE_PROJECT_ID must be ${PROJECT_ID}.`);
}

initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID,
  storageBucket: `${PROJECT_ID}.firebasestorage.app`,
});

const productionFile = getStorage().bucket().file(STORAGE_PATH);
const [[productionMetadata], [productionBytes]] = await Promise.all([
  productionFile.getMetadata(),
  productionFile.download(),
]);
const localBytes = await readFile(LOCAL_PATH);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const production = JSON.parse(productionBytes.toString('utf8'));
const local = JSON.parse(localBytes.toString('utf8'));

const flattenLessons = (module) => (module.sections ?? [])
  .flatMap((section) => section.lessons ?? [])
  .concat(module.lessons ?? []);
const summarize = (module) => {
  const lessons = flattenLessons(module);
  const blocks = lessons.flatMap((lesson) => lesson.blocks ?? []);
  const types = Object.fromEntries([...new Set(blocks.map((block) => block.type))]
    .sort()
    .map((type) => [type, blocks.filter((block) => block.type === type).length]));
  return {
    id: module.id,
    title: module.title,
    sectionCount: module.sections?.length ?? 0,
    lessonCount: lessons.length,
    firstLessonId: lessons.at(0)?.id,
    lastLessonId: lessons.at(-1)?.id,
    blockCount: blocks.length,
    blockTypes: types,
  };
};

const blockText = (block) => block.content ?? block.text ?? block.question ?? block.code ?? '';
const positionalBlockChanges = [];
const localLessons = flattenLessons(local);
const productionLessons = flattenLessons(production);
for (let lessonIndex = 0; lessonIndex < Math.min(localLessons.length, productionLessons.length); lessonIndex += 1) {
  const localLesson = localLessons[lessonIndex];
  const productionLesson = productionLessons[lessonIndex];
  const localBlocks = localLesson.blocks ?? [];
  const productionBlocks = productionLesson.blocks ?? [];
  for (let blockIndex = 0; blockIndex < Math.min(localBlocks.length, productionBlocks.length); blockIndex += 1) {
    const localBlock = localBlocks[blockIndex];
    const productionBlock = productionBlocks[blockIndex];
    if (JSON.stringify(localBlock) === JSON.stringify(productionBlock)) continue;
    positionalBlockChanges.push({
      lessonId: localLesson.id,
      blockIndex,
      localType: localBlock.type,
      productionType: productionBlock.type,
      learnerTextMatches: blockText(localBlock) === blockText(productionBlock),
      localAddsNextStepTitle: localBlock.title === 'Next step' && productionBlock.title == null,
    });
  }
}

const differences = [];
const compare = (left, right, path = '$') => {
  if (Object.is(left, right)) return;
  if (typeof left !== typeof right || left == null || right == null) {
    differences.push({ path, localType: typeof left, productionType: typeof right });
    return;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) {
      differences.push({ path, localType: Array.isArray(left) ? 'array' : typeof left, productionType: Array.isArray(right) ? 'array' : typeof right });
      return;
    }
    if (left.length !== right.length) differences.push({ path: `${path}.length`, local: left.length, production: right.length });
    for (let index = 0; index < Math.min(left.length, right.length); index += 1) compare(left[index], right[index], `${path}[${index}]`);
    return;
  }
  if (typeof left === 'object') {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of [...keys].sort()) {
      if (!(key in left) || !(key in right)) {
        differences.push({ path: `${path}.${key}`, local: key in left ? 'present' : 'missing', production: key in right ? 'present' : 'missing' });
      } else compare(left[key], right[key], `${path}.${key}`);
    }
    return;
  }
  differences.push({ path, localValueLength: String(left).length, productionValueLength: String(right).length });
};

compare(local, production);
console.log(JSON.stringify({
  mode: 'READ_ONLY',
  mutationCount: 0,
  projectId: PROJECT_ID,
  storagePath: STORAGE_PATH,
  productionObject: {
    generation: productionMetadata.generation,
    updated: productionMetadata.updated,
    size: Number(productionMetadata.size),
    contentType: productionMetadata.contentType,
  },
  bytes: { local: localBytes.length, production: productionBytes.length },
  sha256: { local: digest(localBytes), production: digest(productionBytes) },
  summaries: { local: summarize(local), production: summarize(production) },
  positionalBlockChanges: {
    count: positionalBlockChanges.length,
    learnerTextMismatchCount: positionalBlockChanges.filter((change) => !change.learnerTextMatches).length,
    nextStepConversions: positionalBlockChanges.filter((change) => change.localAddsNextStepTitle).length,
    typeTransitions: Object.fromEntries([...new Set(positionalBlockChanges.map((change) => `${change.productionType}->${change.localType}`))]
      .sort()
      .map((transition) => [transition, positionalBlockChanges.filter((change) => `${change.productionType}->${change.localType}` === transition).length])),
    learnerTextMismatchLessonIds: positionalBlockChanges.filter((change) => !change.learnerTextMatches).map((change) => change.lessonId),
  },
  differenceCount: differences.length,
  differencePaths: differences.slice(0, 100),
  differencePathsTruncated: differences.length > 100,
}, null, 2));
