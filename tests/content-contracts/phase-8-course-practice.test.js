import { describe, expect, it } from 'vitest';
import { normalizeContent, validateContent } from '../../shared/content/index.js';
import { ContentPublicationService } from '../../server/admin/content/ContentPublicationService.js';
import { PublishedContentService } from '../../server/admin/content/PublishedContentService.js';
import { InMemoryArtifactStore, InMemoryContentPublicationStore } from '../../server/admin/content/InMemoryContentPublicationStore.js';
import { adaptCanonicalCourse, adaptCanonicalPractice, CanonicalPublishedRepository } from '../../src/content/repositories/CanonicalPublishedRepository.js';
import { createMiniCourseFixture, createPracticeFixture } from './fixtures.js';
import { loadActiveCourseCatalog, loadPinnedCourseCatalog, mergeCourseCatalog } from '../../src/home/canonicalCourseCatalog.js';
import { createHomeLearningModel } from '../../src/home/homeLearningModel.js';
import { createCompilerManager } from '../../src/compiler/createCompilerManager.js';

const actor = { uid: 'phase-8-admin', role: 'SUPER_ADMIN' };
const setup = () => { const store = new InMemoryContentPublicationStore(); const artifacts = new InMemoryArtifactStore(); return { store, artifacts, service: new ContentPublicationService({ store, artifacts, clock: () => new Date('2026-10-05T00:00:00.000Z') }), delivery: new PublishedContentService({ store, artifacts }) }; };

describe('Phase 8 canonical Course contract', () => {
  it('normalizes deterministic hierarchy, quiz answers, and compiler configuration', () => {
    const course = normalizeContent(createMiniCourseFixture());
    expect(course.content.modules.map(({ order }) => order)).toEqual([1, 2]);
    expect(course.content.modules.flatMap(({ lessons }) => lessons)).toHaveLength(3);
    expect(validateContent(course)).toMatchObject({ valid: true });
  });
  it('rejects duplicate IDs, unreachable defaults, invalid quiz answers, and executable compiler configuration', () => {
    const fixture = createMiniCourseFixture();
    fixture.content.defaultLessonId = 'missing';
    fixture.content.modules[1].id = fixture.content.modules[0].id;
    fixture.content.modules[0].lessons[1].blocks[1].correctOptionIds = ['missing'];
    fixture.content.modules[1].lessons[0].blocks[1].validation = { script: 'process.exit()' };
    expect(validateContent(fixture).errors.map(({ code }) => code).sort()).toEqual(expect.arrayContaining(['identity.duplicate', 'quiz.answer_missing', 'reference.lesson_missing', 'security.executable_configuration']));
  });
  it('passes authored Course compiler output through the shared validator contract', () => {
    const course = normalizeContent(createMiniCourseFixture());
    const compiler = course.content.modules.flatMap(({ lessons }) => lessons).flatMap(({ blocks }) => blocks).find(({ type }) => type === 'compiler');
    const manager = createCompilerManager();
    expect(compiler).toMatchObject({ language: 'python', starterCode: expect.any(String), expectedOutput: expect.any(String) });
    expect(manager.validateOutput({ expectedOutput: compiler.expectedOutput, programOutput: `${compiler.expectedOutput}\n`, validatorType: compiler.validation?.comparison ?? 'normalized-lines' })).toBe(true);
    expect(manager.validateOutput({ expectedOutput: compiler.expectedOutput, programOutput: 'incorrect output', validatorType: compiler.validation?.comparison ?? 'normalized-lines' })).toBe(false);
  });
});

describe('Phase 8 canonical Practice contract', () => {
  it.each([0, 1, 2])('validates acceptance question %s', (index) => expect(validateContent(createPracticeFixture(index)).valid).toBe(true));
  it('rejects a forged content type and arbitrary validator payload', () => {
    const fixture = createPracticeFixture(); fixture.contentType = 'COURSE';
    expect(validateContent(fixture).valid).toBe(false);
    const unsafe = createPracticeFixture(); unsafe.content.verification = { type: 'javascript', expectedOutput: '', script: 'return true' };
    expect(validateContent(unsafe).valid).toBe(false);
  });
});

describe('Phase 8 draft type safety', () => {
  it('rejects changing an existing Course draft into Practice', async () => {
    const { service } = setup();
    const course = createMiniCourseFixture();
    await service.saveDraft({ actor, document: course });
    await expect(service.saveDraft({ actor, document: { ...createPracticeFixture(), contentId: course.contentId }, expectedRevision: 1 })).rejects.toMatchObject({ code: 'content/type-conflict' });
  });
});

describe('shared publication and learner delivery', () => {
  it('publishes Course and Practice through the same immutable lifecycle and supports rollback/archive', async () => {
    const { service, delivery } = setup();
    for (const document of [createMiniCourseFixture(), createPracticeFixture()]) {
      const first = await service.saveDraft({ actor, document });
      await service.publish({ actor, contentId: document.contentId, expectedRevision: first.draftRevision });
      const nextDocument = structuredClone(document); nextDocument.metadata.release = 2;
      const second = await service.saveDraft({ actor, document: nextDocument, expectedRevision: 1 });
      await service.publish({ actor, contentId: document.contentId, expectedRevision: second.draftRevision, expectedActiveRevision: 1 });
      expect((await delivery.resolveActive(document.contentId)).document.version).toBe(2);
      await service.activate({ actor, contentId: document.contentId, version: 1, expectedActiveRevision: 2 });
      expect((await delivery.resolveActive(document.contentId)).document.version).toBe(1);
      await service.archive({ actor, contentId: document.contentId, expectedActiveRevision: 3 });
      expect(await delivery.resolveActive(document.contentId)).toBeNull();
      expect((await delivery.fetchVersion(document.contentId, 2)).document.version).toBe(2);
    }
  });

  it('lists by content type and keeps exact-version retrieval pinned', async () => {
    const { service, delivery } = setup();
    for (const document of [createMiniCourseFixture(), createPracticeFixture()]) { const draft = await service.saveDraft({ actor, document }); await service.publish({ actor, contentId: document.contentId, expectedRevision: draft.draftRevision }); }
    expect((await delivery.listActive('COURSE')).map(({ contentId }) => contentId)).toEqual(['python-mini-fundamentals']);
    const fetcher = async (url) => { const parsed = new URL(url, 'https://example.test'); if (parsed.searchParams.has('contentType')) return { ok: true, json: async () => ({ items: await delivery.listActive(parsed.searchParams.get('contentType')) }) }; const [, id, version] = parsed.pathname.match(/public\/([^/]+)(?:\/(\d+))?$/) ?? []; try { return { ok: true, json: async () => await (version ? delivery.fetchVersion(id, Number(version)) : delivery.resolveActive(id)) }; } catch { return { ok: false, json: async () => ({}) }; } };
    const courses = new CanonicalPublishedRepository({ contentType: 'COURSE', fetcher });
    const practice = new CanonicalPublishedRepository({ contentType: 'PRACTICE', fetcher });
    expect(adaptCanonicalCourse((await courses.exact('python-mini-fundamentals', 1)).document).publishedVersion).toBe(1);
    expect(adaptCanonicalPractice((await practice.active('print-greeting')).document).id).toBe('print-greeting');
    const adapted = adaptCanonicalPractice((await practice.active('print-greeting')).document);
    const compiler = adapted.blocks.find((block) => block.type === 'compiler');
    const manager = createCompilerManager();
    expect(manager.validateOutput({ expectedOutput: compiler.expectedOutput, programOutput: `${compiler.expectedOutput} \n`, validatorType: compiler.validator })).toBe(true);
    expect(manager.validateOutput({ expectedOutput: 'one\ntwo', programOutput: 'one two', validatorType: 'normalized-lines' })).toBe(false);
    expect(manager.validateOutput({ expectedOutput: 'one\n', programOutput: 'one', validatorType: 'exact' })).toBe(false);
  });

  it('exposes Course metadata for learner discovery and restores it on rollback', async () => {
    const { service, delivery } = setup();
    const first = createMiniCourseFixture();
    const saved = await service.saveDraft({ actor, document: first });
    await service.publish({ actor, contentId: first.contentId, expectedRevision: saved.draftRevision });
    const second = structuredClone(first); second.content.title = 'Python Mini Revised';
    const changed = await service.saveDraft({ actor, document: second, expectedRevision: 1 });
    await service.publish({ actor, contentId: first.contentId, expectedRevision: changed.draftRevision, expectedActiveRevision: 1 });
    const current = await loadActiveCourseCatalog({ list: () => delivery.listActive('COURSE') });
    expect(current).toMatchObject([{ title: 'Python Mini Revised', available: true, lessonCount: 3, publishedVersion: 2 }]);
    expect(mergeCourseCatalog([{ id: first.contentId, title: 'Legacy' }], current)).toHaveLength(1);
    await service.activate({ actor, contentId: first.contentId, version: 1, expectedActiveRevision: 2 });
    expect((await loadActiveCourseCatalog({ list: () => delivery.listActive('COURSE') }))[0].title).toBe(first.content.title);
    await service.archive({ actor, contentId: first.contentId, expectedActiveRevision: 3 });
    expect(await loadActiveCourseCatalog({ list: () => delivery.listActive('COURSE') })).toEqual([]);
    const pinned = await loadPinnedCourseCatalog([{ courseId: first.contentId, contentVersion: 2 }], { exact: (id, version) => delivery.fetchVersion(id, version) });
    expect(createHomeLearningModel({ progressRecords: [{ courseId: first.contentId, contentVersion: 2 }], pinnedCourses: pinned }).enrollments[0].title).toBe('Python Mini Revised');
  });
});
