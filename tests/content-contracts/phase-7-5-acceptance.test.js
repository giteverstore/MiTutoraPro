import { describe, expect, it } from 'vitest';
import { validateContent } from '../../shared/content/index.js';
import { ContentPublicationService } from '../../server/admin/content/ContentPublicationService.js';
import { PublishedContentService } from '../../server/admin/content/PublishedContentService.js';
import { InMemoryArtifactStore, InMemoryContentPublicationStore } from '../../server/admin/content/InMemoryContentPublicationStore.js';
import { PublishedContentRepository } from '../../src/projects/repositories/PublishedContentRepository.js';
import { createTaskProgressionFixture } from './fixtures.js';

const actor = { uid: 'phase-7-5-admin', role: 'SUPER_ADMIN' };
const response = (value, ok = true) => ({ ok, json: async () => value });

describe('Phase 7.5 canonical publication-to-catalog acceptance', () => {
  it('uses the real canonical schema and Phase 6 publication lifecycle', async () => {
    const store = new InMemoryContentPublicationStore();
    const artifacts = new InMemoryArtifactStore();
    const publication = new ContentPublicationService({ store, artifacts });
    const delivery = new PublishedContentService({ store, artifacts });
    const fixture = createTaskProgressionFixture();
    expect(validateContent(fixture)).toMatchObject({ valid: true });
    const draft = await publication.saveDraft({ actor, document: fixture, expectedRevision: 0 });
    await expect(publication.validateDraft({ actor, contentId: fixture.contentId, expectedRevision: draft.draftRevision })).resolves.toMatchObject({ valid: true });
    const published = await publication.publish({ actor, contentId: fixture.contentId, expectedRevision: draft.draftRevision });
    expect(published).toMatchObject({ version: { version: 1, status: 'READY', artifactHash: expect.stringMatching(/^[a-f0-9]{64}$/) }, active: { activeVersion: 1, publicationStatus: 'ACTIVE' } });
    expect(await delivery.listActiveProjects()).toEqual([expect.objectContaining({ contentId: fixture.contentId, activeVersion: 1 })]);

    const fetcher = async (url) => {
      const parts = new URL(url, 'http://local').pathname.split('/').filter(Boolean);
      if (parts.at(-1) === 'public') return response({ projects: await delivery.listActiveProjects() });
      const version = Number(parts.at(-1));
      const exact = Number.isInteger(version) && String(version) === parts.at(-1);
      const result = exact ? await delivery.fetchVersion(fixture.contentId, version) : await delivery.resolveActive(fixture.contentId);
      return response(result);
    };
    const repository = new PublishedContentRepository({ fetcher });
    const [discovered] = await repository.listProjects();
    expect(discovered).toMatchObject({ id: fixture.contentId, contentVersion: 1, supportedLanguages: ['python', 'javascript'] });

    const v2draft = await publication.saveDraft({ actor, document: { ...fixture, metadata: { ...fixture.metadata, release: 2 } }, expectedRevision: 1 });
    await publication.publish({ actor, contentId: fixture.contentId, expectedRevision: v2draft.draftRevision, expectedActiveRevision: 1 });
    expect((await repository.resumeProject(fixture.contentId, 1)).contentVersion).toBe(1);
    expect((await repository.resolveProject(fixture.contentId)).contentVersion).toBe(2);
    await publication.archive({ actor, contentId: fixture.contentId, expectedActiveRevision: 2 });
    expect(await delivery.listActiveProjects()).toEqual([]);
    expect((await repository.resumeProject(fixture.contentId, 1)).contentVersion).toBe(1);
  });
});
