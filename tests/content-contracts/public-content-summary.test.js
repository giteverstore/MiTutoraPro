import { describe, expect, it, vi } from 'vitest';
import { ContentPublicationService } from '../../server/admin/content/ContentPublicationService.js';
import { InMemoryArtifactStore, InMemoryContentPublicationStore } from '../../server/admin/content/InMemoryContentPublicationStore.js';
import { PublicationSummaryBackfillService } from '../../server/admin/content/PublicationSummaryBackfillService.js';
import { PublishedContentService } from '../../server/admin/content/PublishedContentService.js';
import { createBingoContractFixture, createMiniCourseFixture } from './fixtures.js';

const actor = { uid: 'summary-test-admin', role: 'SUPER_ADMIN' };
const setup = () => {
  const store = new InMemoryContentPublicationStore();
  const artifacts = new InMemoryArtifactStore();
  const publication = new ContentPublicationService({ store, artifacts });
  const delivery = new PublishedContentService({ store, artifacts });
  return { store, artifacts, publication, delivery };
};
const publish = async (publication, document, expectedRevision = 0, expectedActiveRevision = null) => {
  const draft = await publication.saveDraft({ actor, document, expectedRevision });
  return publication.publish({ actor, contentId: document.contentId, expectedRevision: draft.draftRevision, expectedActiveRevision });
};

describe('bounded public catalog summaries', () => {
  it('persists a bounded Project summary and lists it without artifact reads', async () => {
    const { artifacts, publication, delivery } = setup();
    const project = createBingoContractFixture();
    project.metadata.migration = { artwork: '/assets/projects/bingo.webp' };
    for (let index = 0; index < 30; index += 1) {
      const item = structuredClone(project);
      item.contentId = `summary-project-${index + 1}`;
      item.content.projectId = item.contentId;
      await publish(publication, item);
    }
    const read = vi.spyOn(artifacts, 'read'); read.mockClear();
    const items = await delivery.listActive('PROJECT');
    expect(read).not.toHaveBeenCalled();
    expect(items).toHaveLength(30);
    const [item] = items;
    expect(item).toMatchObject({ contentId: 'summary-project-1', activeVersion: 1, metadata: {
      summaryVersion: 1, title: project.content.title, supportedLanguages: ['python', 'java', 'cpp'],
      language: 'python', checkpointCount: 8, artwork: '/assets/projects/bingo.webp',
      comingSoon: false, available: true,
    } });
    expect(item.metadata).not.toHaveProperty('checkpoints');
    expect(JSON.stringify(item.metadata)).not.toMatch(/starterWorkspaces|validators|Guide|files/);
  });

  it('persists a bounded Course summary with availability and no lesson bodies', async () => {
    const { artifacts, publication, delivery } = setup();
    const course = createMiniCourseFixture(); course.content.comingSoon = true;
    await publish(publication, course);
    const read = vi.spyOn(artifacts, 'read'); read.mockClear();
    const [item] = await delivery.listActive('COURSE');
    expect(read).not.toHaveBeenCalled();
    expect(item).toMatchObject({ activeVersion: 1, metadata: {
      summaryVersion: 1, title: course.content.title, language: 'python', difficulty: 'Beginner',
      estimatedMinutes: 20, lessonCount: 3, moduleCount: 2, comingSoon: true, available: false,
    } });
    expect(item.metadata).not.toHaveProperty('modules');
    expect(JSON.stringify(item.metadata)).not.toMatch(/hello-code|quiz-one|starterCode/);
  });

  it('serves immutable v1 and v2 summaries without reading either artifact', async () => {
    const { artifacts, publication, delivery } = setup();
    const v1 = createMiniCourseFixture();
    await publish(publication, v1);
    const v2 = structuredClone(v1); v2.content.title = 'Python Mini Revised';
    await publish(publication, v2, 1, 1);
    const read = vi.spyOn(artifacts, 'read'); read.mockClear();
    await expect(delivery.fetchVersionSummary(v1.contentId, 1)).resolves.toMatchObject({ version: 1, metadata: { title: v1.content.title } });
    await expect(delivery.fetchVersionSummary(v1.contentId, 2)).resolves.toMatchObject({ version: 2, metadata: { title: 'Python Mini Revised' } });
    expect(read).not.toHaveBeenCalled();
  });
});

describe('publication summary backfill', () => {
  it('is dry-run safe, fills missing summaries, and is idempotent without changing ACTIVE', async () => {
    const { store, publication, delivery } = setup();
    const course = createMiniCourseFixture();
    await publish(publication, course);
    await store.updateVersionSummary(course.contentId, 1, {});
    const before = await store.getPointer(course.contentId);
    const backfill = new PublicationSummaryBackfillService({ store, delivery });
    await expect(backfill.run({ dryRun: true })).resolves.toMatchObject({ inspected: 1, missing: 1, changed: 1 });
    expect((await store.getVersion(course.contentId, 1)).metadataSnapshot).toEqual({});
    await expect(backfill.run({ dryRun: false })).resolves.toMatchObject({ changed: 1 });
    await expect(backfill.run({ dryRun: false })).resolves.toMatchObject({ changed: 0, unchanged: 1 });
    const after = await store.getPointer(course.contentId);
    expect(after.activeVersion).toBe(before.activeVersion);
    expect(after.activeRevision).toBe(before.activeRevision);
    expect((await delivery.fetchVersionSummary(course.contentId, 1)).metadata.summaryVersion).toBe(1);
  });
});
