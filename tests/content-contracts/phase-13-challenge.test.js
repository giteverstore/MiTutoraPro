import { describe, expect, it, vi } from 'vitest';
import { normalizeContent, validateContent } from '../../shared/content/index.js';
import { ContentPublicationService } from '../../server/admin/content/ContentPublicationService.js';
import { PublishedContentService } from '../../server/admin/content/PublishedContentService.js';
import { InMemoryArtifactStore, InMemoryContentPublicationStore } from '../../server/admin/content/InMemoryContentPublicationStore.js';
import { adaptCanonicalChallenge, CanonicalPublishedRepository } from '../../src/content/repositories/CanonicalPublishedRepository.js';
import { createChallengeMetadata } from '../../src/content/models/challengeMetadata.js';
import { ChallengeService } from '../../src/content/services/ChallengeService.js';
import { ChallengeAssignmentService } from '../../server/admin/content/ChallengeAssignmentService.js';
import { createAdminContentApiRouter } from '../../server/admin/content/adminContentApiRouter.js';
import { ADMIN_PERMISSIONS } from '../../shared/admin/adminAuthorization.js';
import { adaptLegacyChallenge, createChallengeDraft } from '../../apps/admin/src/content-studio/challenges/challengeAuthoring.js';
import legacyChallenge from '../../firebase-content/daily-challenges/python/v1/2026-08-01.json';

const fixture = () => { const { documentId, ...document } = createChallengeDraft('phase-13-test'); document.content.date = '2026-10-07'; return document; };
const actor = { uid: 'test-admin', role: 'SUPER_ADMIN' };
const setup = () => { const store = new InMemoryContentPublicationStore(); const artifacts = new InMemoryArtifactStore(); return { store, service: new ContentPublicationService({ store, artifacts }), delivery: new PublishedContentService({ store, artifacts }) }; };

describe('Phase 13 Challenge contract', () => {
  it('validates a date-bound, declarative challenge and rejects unsafe blocks and type forgery', () => {
    expect(validateContent(fixture()).valid).toBe(true);
    expect(normalizeContent(fixture()).content.challengeId).toBe('phase-13-test');
    const forged = fixture(); forged.contentType = 'PRACTICE';
    expect(validateContent(forged).valid).toBe(false);
    const unsafe = fixture(); unsafe.content.blocks.push({ id: 'solution', type: 'solution', code: 'secret' });
    expect(validateContent(unsafe).errors.map(({ code }) => code)).toContain('challenge.hidden_solution');
    const executable = fixture(); executable.content.verification = { type: 'javascript', expectedOutput: 'ok', script: 'return true' };
    expect(validateContent(executable).valid).toBe(false);
  });

  it('adapts the checked-in legacy Challenge without losing its problem and compiler fields', () => {
    const migrated = adaptLegacyChallenge(legacyChallenge);
    expect(migrated.content).toMatchObject({ challengeId: legacyChallenge.id, date: legacyChallenge.date, title: legacyChallenge.title, summary: legacyChallenge.summary, motivation: legacyChallenge.motivation, language: 'python', difficulty: 'medium', topic: legacyChallenge.topic, estimatedMinutes: 18, reward: legacyChallenge.reward });
    expect(migrated.content.blocks).toHaveLength(legacyChallenge.blocks.length - 1);
    expect(migrated.content.verification.expectedOutput).toBe('Balanced');
    expect(migrated.content.stdin).toBe('{[()]}');
    expect(validateContent((({ documentId, ...canonical }) => canonical)(migrated)).valid).toBe(true);
  });

  it('preserves both Practice-backed and Storage-backed legacy delivery when no canonical assignment exists', async () => {
    const loadChallenge = vi.fn(async () => legacyChallenge);
    const getQuestion = vi.fn(async () => ({ content: { id: 'legacy-practice', blocks: [{ type: 'compiler' }] } }));
    const service = new ChallengeService({ loadChallenge }, { getQuestion });
    const practice = await service.getChallengeFromMetadata({ id: 'practice-day', date: '2026-08-02', practiceQuestionId: 'legacy-practice', rewardCoins: 20, version: 'v1' });
    expect(practice.content).toMatchObject({ id: 'legacy-practice', date: '2026-08-02', reward: { coins: 20, streakIncrement: 1 } });
    expect(getQuestion).toHaveBeenCalledOnce();
    const storage = await service.getChallengeFromMetadata({ id: legacyChallenge.id, date: legacyChallenge.date, storagePath: 'daily-challenges/python/v1/2026-08-01.json', version: 'v1' });
    expect(storage.content).toBe(legacyChallenge);
    expect(loadChallenge).toHaveBeenCalledOnce();
  });

  it('publishes immutable versions and retains exact history through rollback and archive', async () => {
    const { service, delivery } = setup();
    const original = fixture();
    await service.saveDraft({ actor, document: original });
    await service.publish({ actor, contentId: original.contentId, expectedRevision: 1 });
    const revised = fixture(); revised.content.title = 'Revised Challenge';
    await service.saveDraft({ actor, document: revised, expectedRevision: 1 });
    await service.publish({ actor, contentId: original.contentId, expectedRevision: 2, expectedActiveRevision: 1 });
    expect((await delivery.resolveActive(original.contentId)).document.version).toBe(2);
    expect((await delivery.fetchVersion(original.contentId, 1)).document.content.title).toBe(original.content.title);
    expect(await delivery.listActive('CHALLENGE')).toHaveLength(1);
    await service.activate({ actor, contentId: original.contentId, version: 1, expectedActiveRevision: 2 });
    expect((await delivery.resolveActive(original.contentId)).document.version).toBe(1);
    await service.archive({ actor, contentId: original.contentId, expectedActiveRevision: 3 });
    expect(await delivery.listActive('CHALLENGE')).toEqual([]);
    expect((await delivery.fetchVersion(original.contentId, 2)).document.version).toBe(2);
  });

  it('keeps daily assignment version/reward separate from artifact version/reward', () => {
    const document = { ...fixture(), version: 2 };
    const adapted = adaptCanonicalChallenge(document);
    expect(adapted.contentVersion).toBe(2);
    expect(adapted.blocks.at(-1)).toMatchObject({ type: 'compiler', expectedOutput: 'Hello, World!' });
    const assignment = createChallengeMetadata({ id: '2026-10-07', date: '2026-10-07', canonicalContentId: document.contentId, canonicalVersion: 2, difficulty: 'easy', rewardCoins: 20, rewardXp: 0, published: true, version: 'v1' });
    expect(assignment).toMatchObject({ sourceType: 'canonical-reference', version: 'v1', canonicalVersion: 2, rewardCoins: 20 });
    expect(() => new CanonicalPublishedRepository({ contentType: 'CHALLENGE', fetcher: async () => ({}) })).not.toThrow();
  });

  it('assigns an ACTIVE artifact once, pins its version, and rejects occupied dates', async () => {
    const document = { ...fixture(), status: 'published', version: 2 };
    const records = new Map([[`publishedContent/${document.contentId}`, { contentType: 'CHALLENGE', publicationStatus: 'ACTIVE', activeVersion: 2 }]]);
    const db = {
      doc: (path) => ({ path }),
      collection: (path) => ({ where: (_field, _operator, date) => ({ queryPath: path, date }) }),
      runTransaction: async (work) => work({
        get: async (ref) => ref.queryPath ? { empty: ![...records.values()].some((value) => value?.date === ref.date) } : ({ exists: records.has(ref.path), data: () => records.get(ref.path) }),
        create: (ref, value) => { records.set(ref.path, value); },
      }),
    };
    const service = new ChallengeAssignmentService({ db, delivery: { resolveActive: async () => ({ document }) }, now: () => new Date('2026-10-07T00:00:00Z') });
    const result = await service.assign({ contentId: document.contentId, actor });
    expect(result).toMatchObject({ id: '2026-10-07', canonicalContentId: document.contentId, canonicalVersion: 2, version: 'v1', rewardCoins: 20 });
    await expect(service.assign({ contentId: document.contentId, actor })).rejects.toMatchObject({ code: 'challenge/date-occupied' });
    expect(records.get('dailyChallenges/2026-10-07')).not.toHaveProperty('storagePath');
  });

  it('requires server publish permission for assignment and rejects browser reward fields', async () => {
    const authorize = vi.fn(async () => actor);
    const assign = vi.fn(async () => ({ id: '2026-10-07' }));
    const router = createAdminContentApiRouter({
      authorize,
      dependencies: async () => ({ service: {}, delivery: {}, assetService: {}, challengeAssignments: { assign } }),
    });
    const response = () => ({ statusCode: 0, status(code) { this.statusCode = code; return this; }, json(value) { this.value = value; return this; }, setHeader() {} });
    const request = (body) => ({ method: 'POST', url: '/api/admin-content/assign-challenge', query: { path: ['assign-challenge'] }, body });
    const valid = response(); await router(request({ contentId: 'phase-13-test' }), valid);
    expect(valid.statusCode).toBe(200);
    expect(authorize).toHaveBeenCalledWith(expect.anything(), ADMIN_PERMISSIONS.CONTENT_PUBLISH);
    const forged = response(); await router(request({ contentId: 'phase-13-test', rewardCoins: 100000 }), forged);
    expect(forged.statusCode).toBe(400);
    expect(assign).toHaveBeenCalledTimes(1);
  });
});
