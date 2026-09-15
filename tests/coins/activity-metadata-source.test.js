import { describe, expect, it, vi } from 'vitest';
import { FirestoreMvpActivityMetadataSource } from '../../functions/src/coins/FirestoreMvpActivityMetadataSource.js';
import { MvpCanonicalActivityResolver } from '../../functions/src/coins/MvpCanonicalActivityResolver.js';

function database(documents) {
  return {
    doc: vi.fn((path) => ({
      id: path.split('/').at(-1),
      get: vi.fn(async () => ({ exists: Object.hasOwn(documents, path), data: () => documents[path] })),
    })),
  };
}

describe('activity metadata document identity', () => {
  it.each([
    ['PRACTICE', 'practiceQuestions/question-v3', 'question-v3', { version: 'v3', published: true }],
    ['DAILY_CHALLENGE', 'dailyChallenges/2026-09-15', '2026-09-15', { date: '2026-09-15', version: 'v1', published: true }],
  ])('uses the authoritative Firestore ID for %s metadata that does not duplicate id in its fields', async (activityType, path, activityId, metadata) => {
    const db = database({ [path]: metadata });
    const source = new FirestoreMvpActivityMetadataSource({ db });
    const resolver = new MvpCanonicalActivityResolver({
      loadPracticeMetadata: source.loadPracticeMetadata.bind(source),
      loadDailyChallengeMetadata: source.loadDailyChallengeMetadata.bind(source),
    });

    await expect(resolver.resolve({ activityType, activityId })).resolves.toMatchObject({ activityType, activityId, activityVersion: metadata.version });
  });

  it('does not allow a stored id field to override the authoritative document ID', async () => {
    const source = new FirestoreMvpActivityMetadataSource({ db: database({ 'practiceQuestions/question-v3': { id: 'forged', version: 'v3', published: true } }) });
    await expect(source.loadPracticeMetadata('question-v3')).resolves.toMatchObject({ id: 'question-v3' });
  });
});
