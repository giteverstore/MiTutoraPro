import { expect } from '@playwright/test';
import { ContentPublicationService } from '../../server/admin/content/ContentPublicationService.js';
import { PublishedContentService } from '../../server/admin/content/PublishedContentService.js';
import { InMemoryArtifactStore, InMemoryContentPublicationStore } from '../../server/admin/content/InMemoryContentPublicationStore.js';
import { createMiniCourseFixture, createPracticeFixture, createTaskProgressionFixture } from '../content-contracts/fixtures.js';
import { test } from './fixtures/authenticated-projects.js';

test('all three published content types coexist in their learner catalogs', async ({ page, projectLearner }) => {
  expect(projectLearner.uid).toBeTruthy();
  const store = new InMemoryContentPublicationStore();
  const artifacts = new InMemoryArtifactStore();
  const publication = new ContentPublicationService({ store, artifacts });
  const delivery = new PublishedContentService({ store, artifacts });
  const actor = { uid: 'cross-content-admin', role: 'SUPER_ADMIN' };
  const fixtures = [createTaskProgressionFixture(), createMiniCourseFixture(), createPracticeFixture()];
  for (const document of fixtures) {
    const draft = await publication.saveDraft({ actor, document });
    await publication.publish({ actor, contentId: document.contentId, expectedRevision: draft.draftRevision });
  }
  const project = (await delivery.resolveActive(fixtures[0].contentId)).document;
  await page.addInitScript((document) => {
    globalThis.__YCODERS_PROJECT_E2E_PUBLISHED_FETCH__ = async (input) => {
      const parts = new URL(input, location.origin).pathname.split('/').filter(Boolean).slice(3);
      return { ok: true, json: async () => parts.length ? { document, metadata: { status: 'READY' } } : { projects: [{ contentId: document.contentId, activeVersion: 1, metadata: { testOnly: true } }] } };
    };
  }, project);
  await page.context().route('**/api/admin-content/public**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/api\/admin-content\/public\/?/, '').split('/').filter(Boolean);
    const payload = path.length ? await delivery.resolveActive(path[0]) : { items: await delivery.listActive(url.searchParams.get('contentType')) };
    await route.fulfill({ status: payload ? 200 : 404, contentType: 'application/json', body: JSON.stringify(payload ?? {}) });
  });
  await page.goto('/projects');
  await expect(page.getByRole('article').filter({ hasText: 'Task Progression Acceptance Fixture' })).toBeVisible();
  await expect(page.getByText('Python Mini Fundamentals')).toHaveCount(0);
  await page.goto('/library');
  await expect(page.getByRole('link', { name: 'Python Mini Fundamentals' })).toBeVisible();
  await expect(page.getByText('Task Progression Acceptance Fixture')).toHaveCount(0);
  await page.goto('/practice');
  await expect(page.getByRole('button', { name: /Print a greeting/ })).toBeVisible();
  await expect(page.getByText('Python Mini Fundamentals')).toHaveCount(0);
});
