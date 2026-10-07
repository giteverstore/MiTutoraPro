import { describe, expect, it } from 'vitest';
import { FirestoreMvpActivityMetadataSource } from '../../functions/src/coins/FirestoreMvpActivityMetadataSource.js';
import { MvpCanonicalActivityResolver } from '../../functions/src/coins/MvpCanonicalActivityResolver.js';
import { adaptCanonicalPractice } from '../../src/content/repositories/CanonicalPublishedRepository.js';
import { createPracticeFixture } from './fixtures.js';

function source(documents) {
  return new FirestoreMvpActivityMetadataSource({ db: { doc: (path) => ({
    id: path.split('/').at(-1),
    get: async () => ({ exists: Object.hasOwn(documents, path), data: () => documents[path] }),
  }) } });
}

describe('canonical Practice completion versions', () => {
  it('adapts the publication version to the completion API version without changing artifact lookup version', () => {
    const question = adaptCanonicalPractice(createPracticeFixture(0, { version: 2 }));
    expect(question).toMatchObject({ version: 2, activityVersion: 'v2' });
  });

  it('prefers the ACTIVE Practice pointer over legacy metadata and rejects archived or wrong-type pointers', async () => {
    const id = 'print-greeting';
    const legacy = { published: true, version: 'v2' };
    const pointer = { contentType: 'PRACTICE', publicationStatus: 'ACTIVE', activeVersion: 1 };
    const metadata = source({ [`publishedContent/${id}`]: pointer, [`practiceQuestions/${id}`]: legacy });
    expect(await metadata.loadPracticeMetadata(id)).toMatchObject({ id, published: true, version: 'v1' });
    const resolver = new MvpCanonicalActivityResolver({ loadPracticeMetadata: metadata.loadPracticeMetadata.bind(metadata), loadDailyChallengeMetadata: async () => null });
    expect(await resolver.resolve({ activityType: 'PRACTICE', activityId: id })).toMatchObject({ activityVersion: 'v1' });
    expect(await source({ [`publishedContent/${id}`]: { ...pointer, publicationStatus: 'ARCHIVED' }, [`practiceQuestions/${id}`]: legacy }).loadPracticeMetadata(id)).toBeNull();
    expect(await source({ [`publishedContent/${id}`]: { ...pointer, contentType: 'COURSE' } }).loadPracticeMetadata(id)).toBeNull();
    expect(await source({ [`practiceQuestions/${id}`]: legacy }).loadPracticeMetadata(id)).toMatchObject({ id, version: 'v2' });
  });
});
