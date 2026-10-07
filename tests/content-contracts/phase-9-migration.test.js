import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { migratePythonCourse, migratePracticeBank, assertEmulatorOnly, runMigration } from '../../scripts/content/migrationCore.mjs';
import { adaptCanonicalCourse, adaptCanonicalPractice } from '../../src/content/repositories/CanonicalPublishedRepository.js';
import { createPublishedFirstPracticeSource } from '../../src/practice/practiceContentSource.js';
import { practiceQuestions } from '../../src/practice/practiceData.js';
import { InMemoryContentPublicationStore, InMemoryArtifactStore } from '../../server/admin/content/InMemoryContentPublicationStore.js';
import { ContentPublicationService } from '../../server/admin/content/ContentPublicationService.js';
import { PublishedContentService } from '../../server/admin/content/PublishedContentService.js';

const actor = { uid: 'phase-9-test', role: 'SUPER_ADMIN' };
const documentOf = ({ documentId, ...document }) => document;

describe('Phase 9 source-preserving migration', () => {
  it('converts the full Python Course deterministically with all blocks and resolved images', () => {
    const first = migratePythonCourse(); const second = migratePythonCourse();
    expect(first.drafts).toEqual(second.drafts);
    expect(first.assets).toEqual(second.assets);
    expect(first.report).toMatchObject({ modules: 1, sections: 10, lessons: 109, blocks: 648, images: 17, quizzes: 20, compilerExercises: 63, validation: 'passed' });
    expect(first.assets).toHaveLength(17);
    expect(first.drafts[0].content.defaultLessonId).toBe('lesson-1-1-introduction-to-python');
    expect(first.drafts[0].content.modules[0].sections[0].lessons[0].blocks[0].id).toBe('page-1-1-paragraph-1');
    expect(first.report.moduleSizes[0].bytes).toBeLessThan(850_000);
    const source = JSON.parse(readFileSync('public/courses/python-course.json', 'utf8'));
    const original = source.modules.flatMap((module) => module.sections.flatMap((section) => section.lessons.flatMap((lesson) => lesson.blocks)));
    const migrated = first.drafts[0].content.modules.flatMap((module) => module.sections.flatMap((section) => section.lessons.flatMap((lesson) => lesson.blocks)));
    expect(migrated.map(({ assetId, ...block }) => block)).toEqual(original);
  });

  it('fails visibly on an unsupported Course block and unresolved asset', () => {
    const source = structuredClone(migratePythonCourse().drafts[0].content);
    const legacy = { id: 'python', slug: 'python', title: source.title, description: source.description, metadata: { tags: ['python'], estimatedMinutes: 1 }, navigation: { defaultLessonId: source.defaultLessonId }, modules: source.modules };
    legacy.modules[0].sections[0].lessons[0].blocks[0].type = 'unknown';
    expect(() => migratePythonCourse(legacy)).toThrow(/Unsupported Course blocks/);
    legacy.modules[0].sections[0].lessons[0].blocks[0].type = 'paragraph';
    expect(() => migratePythonCourse(legacy, () => false)).toThrow(/Unresolved image/);
  });

  it('converts all Practice questions deterministically without losing compiler or public-test data', () => {
    const first = migratePracticeBank(); const second = migratePracticeBank();
    expect(first.drafts).toEqual(second.drafts);
    expect(first.drafts).toHaveLength(200);
    expect(first.report).toMatchObject({ questions: 200, starterCodeCount: 200, expectedOutputCount: 200, validation: 'passed' });
    const source = practiceQuestions[0]; const document = documentOf(first.drafts[0]);
    const learner = adaptCanonicalPractice({ ...document, version: 1 });
    expect(learner.id).toBe(source.id);
    expect(learner.blocks).toEqual(source.blocks);
    expect(learner.publicTests).toEqual(source.publicTests);
    expect(learner.implementations).toEqual(source.implementations);
  });

  it('rejects malformed Practice content and prevents non-emulator writes', () => {
    const source = structuredClone(practiceQuestions[0]); source.extraField = 'silent loss';
    expect(() => migratePracticeBank([source])).toThrow(/unsupported fields/);
    delete source.extraField; source.blocks.push({ id: 'bad', type: 'unknown' });
    expect(() => migratePracticeBank([source])).toThrow(/unsupported block/);
    expect(() => assertEmulatorOnly({ FIREBASE_PROJECT_ID: 'production-project', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' })).toThrow(/demo-mitutora/);
    expect(() => assertEmulatorOnly({ FIREBASE_PROJECT_ID: 'demo-mitutora', FIRESTORE_EMULATOR_HOST: 'remote.example:8080' })).toThrow(/loopback/);
  });

  it('publishes real Course and representative Practice into isolated in-memory test storage', async () => {
    const store = new InMemoryContentPublicationStore(); const artifacts = new InMemoryArtifactStore();
    const assets = new Set(migratePythonCourse().assets.map(({ assetId }) => assetId));
    const service = new ContentPublicationService({ store, artifacts, assets: { exists: async (id) => assets.has(id) } });
    const delivery = new PublishedContentService({ store, artifacts });
    for (const draft of [migratePythonCourse().drafts[0], ...migratePracticeBank().drafts.slice(0, 2)]) {
      const document = documentOf(draft);
      await service.saveDraft({ actor, document });
      expect((await service.validateDraft({ actor, contentId: document.contentId, expectedRevision: 1 })).valid).toBe(true);
      await service.publish({ actor, contentId: document.contentId, expectedRevision: 1 });
      const loaded = (await delivery.resolveActive(document.contentId)).document;
      expect(loaded.contentId).toBe(document.contentId);
      if (document.contentType === 'COURSE') expect(adaptCanonicalCourse(loaded).modules[0].sections[0].lessons).toHaveLength(6);
      else expect(adaptCanonicalPractice(loaded).blocks.at(-1).id).toBe(practiceQuestions.find((item) => item.id === document.contentId).blocks.at(-1).id);
    }
    expect((await delivery.listActive('PRACTICE'))).toHaveLength(2);
  });

  it('shows one logical Practice question when canonical and legacy IDs match', async () => {
    const id = practiceQuestions[0].id;
    const migrated = adaptCanonicalPractice({ ...documentOf(migratePracticeBank().drafts[0]), version: 1 });
    const legacy = { ...practiceQuestions[0], version: 'v2' };
    const canonical = { listCatalog: async () => [migrated], loadQuestion: async () => migrated };
    const prior = { listCatalog: async () => [legacy], loadQuestion: async () => legacy };
    const source = createPublishedFirstPracticeSource({ canonical, legacy: prior });
    const catalog = await source.listCatalog();
    expect(catalog).toHaveLength(1);
    expect(catalog[0]).toMatchObject({ id, contentSource: 'canonical' });
  });

  it('defaults to dry-run and rejects unsupported/mixed CLI flags before seeding', async () => {
    const log = console.log; const output = []; console.log = (...args) => output.push(args.join(' '));
    try { await runMigration('course', []); } finally { console.log = log; }
    expect(JSON.parse(output[0]).mode).toBe('dry-run');
    await expect(runMigration('course', ['--overwrite'])).rejects.toThrow(/requires --seed-emulator/);
    await expect(runMigration('course', ['--dry-run', '--seed-emulator'])).rejects.toThrow(/Choose dry-run/);
  });
});
