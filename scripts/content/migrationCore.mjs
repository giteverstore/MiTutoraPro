import { readFileSync, existsSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { adaptLegacyCourse } from '../../apps/admin/src/content-studio/courses/courseAuthoring.js';
import { adaptLegacyPracticeQuestion } from '../../apps/admin/src/content-studio/practice/practiceAuthoring.js';
import { practiceQuestions } from '../../src/practice/practiceData.js';
import { cliTaskManagerProject } from '../../src/projects/catalog/cliTaskManagerProject.js';
import { PROJECT_RUNTIME_DEFAULTS } from '../../src/projects/runtime/projectRuntimeDefaults.js';
import { MAX_ARTIFACT_BYTES, MAX_DRAFT_BYTES, assertContentSize, validateContent } from '../../shared/content/index.js';
import { normalizeLegacyProject } from '../../shared/content/legacyProjectAdapter.js';
import { courseBlockSchema } from '../../shared/content/schemas.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const coursePath = join(root, 'public/courses/python-course.json');
const courseTypes = new Set(['paragraph', 'heading', 'callout', 'code', 'compiler', 'image', 'quiz', 'exercise', 'solution', 'note', 'table', 'list', 'warning', 'expected-output', 'divider']);
const practiceTypes = new Set(['heading', 'paragraph', 'note', 'code', 'compiler']);
const practiceFields = new Set(['schemaVersion', 'id', 'title', 'summary', 'language', 'difficulty', 'topic', 'category', 'subtopic', 'questionType', 'estimatedMinutes', 'xp', 'contract', 'examples', 'constraints', 'hints', 'concepts', 'skills', 'prerequisites', 'commonMistakes', 'expectedComplexity', 'publicTests', 'implementations', 'blocks']);
const lessonsOf = (course) => course.modules.flatMap((module) => (module.sections ?? [module]).flatMap((section) => section.lessons));
const bytes = (value) => Buffer.byteLength(JSON.stringify(value));
// Firestore rejects undefined nested fields even when JSON validation ignores them.
const canonical = ({ documentId, ...document }) => JSON.parse(JSON.stringify(document));
const insist = (condition, message) => { if (!condition) throw new Error(message); };
const counts = (items, field) => Object.fromEntries([...new Set(items.map((item) => item[field]))].sort().map((value) => [value, items.filter((item) => item[field] === value).length]));

function validate(draft) {
  const result = validateContent(canonical(draft));
  insist(result.valid, `${draft.contentId}: ${JSON.stringify(result.errors.slice(0, 8))}`);
  assertContentSize(canonical(draft), draft.contentType === 'COURSE' ? MAX_ARTIFACT_BYTES : MAX_DRAFT_BYTES, draft.contentId);
}

export function migratePythonCourse(source = JSON.parse(readFileSync(coursePath, 'utf8')), assetExists = existsSync) {
  const start = performance.now();
  insist(source.id === 'python' && source.slug === 'python', 'Unexpected Python Course identity.');
  const lessons = lessonsOf(source); const blocks = lessons.flatMap((lesson) => lesson.blocks);
  const sourceFields = new Set(['$schema', 'schemaVersion', 'id', 'slug', 'title', 'description', 'locale', 'status', 'metadata', 'navigation', 'modules']);
  insist(Object.keys(source).every((key) => sourceFields.has(key)), 'Unknown Course root field; migration would be lossy.');
  const unsupported = [...new Set(blocks.map((block) => block.type).filter((type) => !courseTypes.has(type)))];
  insist(!unsupported.length, `Unsupported Course blocks: ${unsupported.join(', ')}`);
  for (const block of blocks) insist(Object.keys(block).every((key) => Object.hasOwn(courseBlockSchema.properties, key)), `Unsupported field in Course block ${block.id}.`);
  const draft = adaptLegacyCourse(source);
  draft.metadata = { ...draft.metadata, migration: { source: 'public/courses/python-course.json', sourceSchemaUri: source.$schema, sourceSchemaVersion: source.schemaVersion, sourceLocale: source.locale, sourceStatus: source.status, sourceMetadata: source.metadata, sourceNavigation: source.navigation } };
  const assets = new Map();
  for (const block of lessonsOf(draft.content).flatMap((lesson) => lesson.blocks)) {
    if (block.type !== 'image') continue;
    insist(/^\/assets\/[a-zA-Z0-9/_-]+\.(png|jpe?g|webp|svg)$/.test(block.src ?? ''), `Unsafe image path: ${block.src}`);
    const path = resolve(root, `public${block.src}`);
    insist(path.startsWith(join(root, 'public', 'assets') + sep) && assetExists(path), `Unresolved image: ${block.src}`);
    block.assetId = `python-${basename(block.src).replace(/\.[^.]+$/, '')}`;
    assets.set(block.assetId, { assetId: block.assetId, path: block.src, source: 'python-course-migration' });
  }
  const converted = lessonsOf(draft.content);
  insist(converted.length === lessons.length && converted.every((lesson, index) => lesson.id === lessons[index].id && lesson.blocks.length === lessons[index].blocks.length), 'Course lesson/block parity failed.');
  validate(draft);
  const moduleSizes = draft.content.modules.map((module) => ({ id: module.id, bytes: bytes(module) }));
  moduleSizes.forEach(({ id, bytes: size }) => insist(size < MAX_DRAFT_BYTES, `Module ${id} exceeds segmented limit.`));
  return { drafts: [draft], assets: [...assets.values()], report: { source: 'public/courses/python-course.json', contentId: draft.contentId, modules: source.modules.length, sections: source.modules.reduce((n, module) => n + (module.sections?.length ?? 0), 0), lessons: lessons.length, blocks: blocks.length, blockTypes: counts(blocks, 'type'), images: blocks.filter((block) => block.type === 'image').length, quizzes: blocks.filter((block) => block.type === 'quiz').length, compilerExercises: blocks.filter((block) => block.type === 'compiler').length, exercises: blocks.filter((block) => block.type === 'exercise').length, expectedOutputBlocks: blocks.filter((block) => block.type === 'expected-output').length, assetCount: assets.size, metadataBytes: bytes({ ...draft, content: { ...draft.content, modules: [] } }), moduleSizes, totalDraftBytes: bytes(canonical(draft)), artifactEstimateBytes: bytes(canonical(draft)), conversionAndValidationMs: Math.round(performance.now() - start), validation: 'passed' } };
}

export function migratePracticeBank(source = practiceQuestions) {
  const start = performance.now(); const ids = new Set();
  insist(Array.isArray(source) && source.length > 0, 'Practice source must be a non-empty array.');
  const drafts = source.map((question, position) => {
    insist(!ids.has(question.id), `Duplicate Practice ID: ${question.id}`); ids.add(question.id);
    const unknown = Object.keys(question).filter((key) => !practiceFields.has(key));
    insist(!unknown.length, `${question.id}: unsupported fields ${unknown.join(', ')}`);
    insist(question.blocks.every((block) => practiceTypes.has(block.type)), `${question.id}: unsupported block type.`);
    const compilers = question.blocks.filter((block) => block.type === 'compiler');
    insist(compilers.length === 1 && compilers[0].validator === 'normalized', `${question.id}: expected one normalized-output compiler.`);
    const draft = adaptLegacyPracticeQuestion(question, position);
    draft.metadata = { ...draft.metadata, migration: { source: 'src/practice/practiceData.js', sourceSchemaVersion: question.schemaVersion, implementations: question.implementations ?? null, compiler: { id: compilers[0].id, runLabel: compilers[0].runLabel, resetLabel: compilers[0].resetLabel, validator: compilers[0].validator } } };
    const sourceProblemBlocks = question.blocks.filter((block) => block.type !== 'compiler');
    insist(JSON.stringify(draft.content.blocks) === JSON.stringify(sourceProblemBlocks), `${question.id}: problem-block parity failed.`);
    insist(draft.content.starterCode === compilers[0].starterCode && draft.content.stdin === compilers[0].stdin && draft.content.verification.expectedOutput === compilers[0].expectedOutput, `${question.id}: compiler parity failed.`);
    validate(draft); return draft;
  });
  const blocks = source.flatMap((question) => question.blocks);
  return { drafts, assets: [], report: { source: 'src/practice/practiceData.js', questions: source.length, languages: counts(source, 'language'), difficulties: counts(source, 'difficulty'), topics: counts(source, 'topic'), blockTypes: counts(blocks, 'type'), starterCodeCount: blocks.filter((block) => block.type === 'compiler' && block.starterCode).length, expectedOutputCount: blocks.filter((block) => block.type === 'compiler' && block.expectedOutput !== undefined).length, totalDraftBytes: drafts.reduce((sum, draft) => sum + bytes(canonical(draft)), 0), largestDraftBytes: Math.max(...drafts.map((draft) => bytes(canonical(draft)))), conversionAndValidationMs: Math.round(performance.now() - start), validation: 'passed' } };
}

export function migrateCliTaskManager(source = cliTaskManagerProject) {
  const start = performance.now();
  const knownFields = (value, names, label) => insist(Object.keys(value).every((key) => names.includes(key)), `Unknown ${label} field; migration would be lossy.`);
  insist(source.id === 'cli-task-manager' && source.slug === 'cli-task-manager', 'Unexpected Project identity.');
  const supportedFields = new Set(['id', 'slug', 'title', 'difficulty', 'category', 'estimatedMinutes', 'artwork', 'description', 'supportedLanguages', 'whatYouWillBuild', 'learningObjectives', 'prerequisites', 'skills', 'guide', 'languageContent', 'languageOverrides', 'checkpoints', 'finalValidation', 'export']);
  insist(Object.keys(source).every((key) => supportedFields.has(key)), 'Unknown Project root field; migration would be lossy.');
  insist(source.checkpoints.length === 5 && source.supportedLanguages.length === 4, 'CLI Task Manager source structure changed; review the migration.');
  const guideFields = ['type', 'text', 'items', 'key', 'codeKey', 'code', 'command'];
  const checkFields = ['id', 'name', 'type', 'patternsByLanguage', 'visible', 'outputIncludes', 'stdin', 'filePathByLanguage', 'requiresFilesystem'];
  for (const block of source.guide) knownFields(block, guideFields, 'global guide block');
  for (const checkpoint of source.checkpoints) {
    knownFields(checkpoint, ['id', 'title', 'objective', 'executionMode', 'expectedOutput', 'validation', 'requirements', 'completionMessage', 'guide'], 'checkpoint');
    for (const block of checkpoint.guide) knownFields(block, guideFields, 'checkpoint guide block');
    insist(checkpoint.validation?.type === 'project-checks', 'Unsupported checkpoint validation mechanism.');
    for (const check of checkpoint.validation.checks) knownFields(check, checkFields, 'checkpoint check');
  }
  insist(source.finalValidation?.type === 'project-checks', 'Unsupported final validation mechanism.');
  for (const check of source.finalValidation.checks) knownFields(check, checkFields, 'final check');
  const resolver = (project, language) => {
    const defaults = PROJECT_RUNTIME_DEFAULTS[language];
    insist(defaults?.defaultFiles?.length, `No bundled starter workspace for ${language}.`);
    const override = project.languageOverrides?.[language] ?? {};
    return { id: language, ...defaults, ...override, entrypoint: override.entrypoint ?? defaults.defaultFiles[0].path, defaultFiles: override.defaultFiles ?? defaults.defaultFiles };
  };
  const draft = JSON.parse(JSON.stringify(normalizeLegacyProject(source, { resolveRuntime: resolver })));
  draft.documentId = source.id;
  draft.metadata = { ...draft.metadata, migration: {
    source: 'src/projects/catalog/cliTaskManagerProject.js', artwork: source.artwork,
    whatYouWillBuild: source.whatYouWillBuild, export: source.export,
    languageContent: source.languageContent, languageOverrides: source.languageOverrides,
    checkpointModes: Object.fromEntries(source.checkpoints.map(({ id, executionMode }) => [id, executionMode])),
    globalGuide: source.guide,
  } };
  // The original Project has a two-block global guide. The canonical model stores
  // guides per checkpoint, so put it before the first checkpoint's existing guide.
  insist(source.guide.every((block) => ['paragraph', 'runtime-command'].includes(block.type)), 'Unsupported global Project guide block.');
  draft.content.checkpoints[0].blocks.unshift(...source.guide.map((block, index) => block.type === 'paragraph'
    ? { blockId: `project-guide-${index + 1}`, type: 'paragraph', text: block.text }
    : { blockId: `project-guide-${index + 1}`, type: 'terminal-command', commandId: block.command, display: { variants: Object.fromEntries(source.supportedLanguages.map((language) => [language, resolver(source, language).runCommand])), requiredLanguages: source.supportedLanguages } }));
  const sourceChecks = source.checkpoints.map((checkpoint) => checkpoint.validation.checks.length);
  const converted = draft.content.checkpoints;
  insist(converted.every((checkpoint, index) => checkpoint.checkpointId === source.checkpoints[index].id && checkpoint.tasks.length === 1 && checkpoint.tasks[0].validators.length === sourceChecks[index]), 'Project checkpoint/task/validator parity failed.');
  insist(converted.every((checkpoint, index) => checkpoint.blocks.length === source.checkpoints[index].guide.length + (index === 0 ? source.guide.length : 0)), 'Project guide parity failed.');
  insist(Object.keys(draft.content.starterWorkspaces).length === source.supportedLanguages.length, 'Project starter workspace parity failed.');
  validate(draft);
  const blockCount = source.guide.length + source.checkpoints.reduce((sum, checkpoint) => sum + checkpoint.guide.length, 0);
  return { drafts: [draft], assets: [], report: { source: 'src/projects/catalog/cliTaskManagerProject.js', contentId: draft.contentId, languages: source.supportedLanguages, checkpoints: converted.length, adapterDerivedTasks: converted.flatMap((checkpoint) => checkpoint.tasks).length, guideBlocks: blockCount, starterFiles: Object.fromEntries(source.supportedLanguages.map((language) => [language, resolver(source, language).defaultFiles.length])), checkpointValidators: sourceChecks, finalValidators: source.finalValidation.checks.length, canonicalBytes: bytes(canonical(draft)), conversionAndValidationMs: Math.round(performance.now() - start), validation: 'passed' } };
}

export function assertEmulatorOnly(env = process.env) {
  insist(/^(127\.0\.0\.1|localhost):\d+$/.test(String(env.FIRESTORE_EMULATOR_HOST ?? '')), 'Seeding requires a loopback Firestore emulator.');
  insist(env.FIREBASE_PROJECT_ID === 'demo-mitutora', 'Seeding requires FIREBASE_PROJECT_ID=demo-mitutora.');
}

export async function seedEmulator({ drafts, assets = [] }, { overwrite = false, env = process.env } = {}) {
  assertEmulatorOnly(env);
  const { initializeApp, deleteApp } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  const app = initializeApp({ projectId: 'demo-mitutora' }, `migration-${Date.now()}`);
  try {
    const db = getFirestore(app);
    const { FirebaseContentPublicationStore } = await import('../../server/admin/content/FirebaseContentPublicationStore.js');
    const { ContentPublicationService } = await import('../../server/admin/content/ContentPublicationService.js');
    const store = new FirebaseContentPublicationStore(db);
    const service = new ContentPublicationService({ store, artifacts: null });
    const entries = await Promise.all(drafts.map(async (draft) => ({ draft, previous: await store.getDraft(draft.contentId) })));
    for (const { draft, previous } of entries) insist(!previous || overwrite || JSON.stringify(previous.document) === JSON.stringify(canonical(draft)), `Draft ${draft.contentId} differs; --overwrite required.`);
    for (const asset of assets) {
      const ref = db.collection('adminContentAssets').doc(asset.assetId); const previous = await ref.get();
      insist(!previous.exists || previous.data().path === asset.path, `Asset conflict: ${asset.assetId}`);
      if (!previous.exists) await ref.create(asset);
    }
    let seeded = 0; let skipped = 0;
    for (const { draft, previous } of entries) {
      const document = canonical(draft);
      if (previous && JSON.stringify(previous.document) === JSON.stringify(document)) { skipped++; continue; }
      try { await service.saveDraft({ actor: { uid: 'local-content-migration', role: 'SUPER_ADMIN' }, document, expectedRevision: previous?.draftRevision ?? 0 }); }
      catch (error) { throw new Error(`Could not seed ${draft.contentId}: ${error.message}`, { cause: error }); }
      seeded++;
    }
    return { seeded, skipped, assetCount: assets.length };
  } finally { await deleteApp(app); }
}

export async function runMigration(kind, args = process.argv.slice(2)) {
  const flags = new Set(['--dry-run', '--seed-emulator', '--overwrite']);
  insist(args.every((arg) => flags.has(arg)), 'Supported flags: --dry-run, --seed-emulator, --overwrite.');
  insist(!(args.includes('--dry-run') && args.includes('--seed-emulator')), 'Choose dry-run or emulator seed.');
  insist(!args.includes('--overwrite') || args.includes('--seed-emulator'), '--overwrite requires --seed-emulator.');
  const result = kind === 'course' ? migratePythonCourse() : kind === 'practice' ? migratePracticeBank() : kind === 'project' ? migrateCliTaskManager() : null;
  insist(result, 'Unknown migration kind.');
  const seed = args.includes('--seed-emulator') ? await seedEmulator(result, { overwrite: args.includes('--overwrite') }) : null;
  console.log(JSON.stringify({ kind, mode: seed ? 'emulator-seed' : 'dry-run', ...result.report, ...(seed ? { seed } : {}) }, null, 2));
}
