import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { migrateCliTaskManager, migratePracticeBank, migratePythonCourse } from '../../../../scripts/content/migrationCore.mjs';

const draft = (type, id, title) => ({ contentId: id, contentType: type, title, draftRevision: 2, lifecycleState: 'DRAFT', updatedAt: '2026-10-07T00:00:00Z', updatedBy: 'editor', validationSummary: { valid: true, validatedAt: '2026-10-07T00:00:00Z' } });
const canonical = [migrateCliTaskManager().drafts[0], migratePythonCourse().drafts[0], migratePracticeBank().drafts[0]];
const drafts = canonical.map((document) => draft(document.contentType, document.contentId, document.content.title));
const catalog = drafts.map((item) => ({ contentId: item.contentId, contentType: item.contentType, metadataSnapshot: { title: item.title }, activeVersion: 2, latestVersion: 2, activeRevision: 2, publicationStatus: 'ACTIVE', publishedAt: '2026-10-07T00:00:00Z', publishedBy: 'publisher', sourceDraftRevision: 2, updatedAt: '2026-10-07T00:00:00Z', updatedBy: 'publisher' }));
const versions = (item) => [2, 1].map((version) => ({ contentId: item.contentId, contentType: item.contentType, version, status: 'READY', sourceDraftRevision: version, schemaVersion: '1.0.0', artifactSize: 321, artifactHash: 'a'.repeat(64), artifactPath: `published-content/${item.contentType.toLowerCase()}s/${item.contentId}/v${version}.json`, publishedAt: '2026-10-07T00:00:00Z', publishedBy: 'publisher', locale: 'en', metadataSnapshot: { title: item.title } }));
const assets = migratePythonCourse().assets;

async function fixture(page) {
  const currentCatalog = structuredClone(catalog);
  const currentDrafts = structuredClone(drafts);
  const currentAssets = [...assets];
  let deletedRequests = 0;
  await page.route('**/assets/courses/python-foundations/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    await route.fulfill({ path: resolve(import.meta.dirname, '../../../../public', pathname.slice(1)) });
  });
  await page.route('**/api/admin-content/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/admin-content/', '');
    let result = { error: { message: 'Unknown fixture route.' } }; let status = 404;
    if (path === 'draft-summaries') { result = { items: currentDrafts, nextCursor: null }; status = 200; }
    else if (path.startsWith('drafts/') && route.request().method() === 'DELETE') { const id = path.slice('drafts/'.length); const index = currentDrafts.findIndex((item) => item.contentId === id); if (index >= 0) currentDrafts.splice(index, 1); deletedRequests++; result = { contentId: id, deleted: true }; status = 200; }
    else if (path === 'catalog') { result = { items: currentCatalog, nextCursor: null }; status = 200; }
    else if (path === 'assets' && route.request().method() === 'POST') { const input = route.request().postDataJSON(); const asset = { assetId: `asset-upload-${currentAssets.length}`, name: input.name, mediaType: input.mediaType, path: `admin-content-assets/asset-upload-${currentAssets.length}.png`, status: 'ACTIVE' }; currentAssets.push(asset); result = { asset }; status = 201; }
    else if (path === 'assets') { result = { items: currentAssets, nextCursor: null }; status = 200; }
    else if (path.startsWith('history/')) { const item = drafts.find((candidate) => candidate.contentId === path.slice(8)); result = { versions: versions(item), active: currentCatalog.find((candidate) => candidate.contentId === item.contentId) }; status = 200; }
    else if (path === 'validate') { result = { validation: { valid: true, errors: [] } }; status = 200; }
    else if (path === 'publish') { const body = route.request().postDataJSON(); const item = currentCatalog.find((candidate) => candidate.contentId === body.contentId); item.latestVersion++; item.activeVersion = item.latestVersion; item.activeRevision++; item.sourceDraftRevision = body.expectedRevision; result = { active: item, version: { version: item.activeVersion } }; status = 201; }
    else if (path === 'archive') { const body = route.request().postDataJSON(); const item = currentCatalog.find((candidate) => candidate.contentId === body.contentId); item.publicationStatus = 'ARCHIVED'; item.activeRevision++; result = { active: item }; status = 200; }
    else if (path === 'rollback') { const body = route.request().postDataJSON(); const item = currentCatalog.find((candidate) => candidate.contentId === body.contentId); item.publicationStatus = 'ACTIVE'; item.activeVersion = body.version; item.activeRevision++; result = { active: item }; status = 200; }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(result) });
  });
  await page.goto('/tests/browser/publishing.html');
  return { deletedRequests: () => deletedRequests };
}

test('draft deletion is confirmed and leaves the published catalog intact', async ({ page }) => {
  const state = await fixture(page);
  const row = page.locator('.publishing-row').filter({ hasText: 'CLI Task Manager' });
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Delete draft?' })).toContainText('Published versions are not affected');
  await page.getByRole('button', { name: 'Cancel' }).click();
  expect(state.deletedRequests()).toBe(0);
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Delete draft' }).click();
  await expect(row).toHaveCount(0);
  expect(state.deletedRequests()).toBe(1);
  await page.getByRole('link', { name: 'Published' }).click();
  await expect(page.getByRole('heading', { name: 'CLI Task Manager' })).toBeVisible();
});

test('Drafts filter and search real content types; reviewer cannot publish', async ({ page }) => {
  await fixture(page);
  await expect(page.getByRole('heading', { name: 'CLI Task Manager' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Python Foundations' })).toBeVisible();
  await expect(page.getByText('Up to date').first()).toBeVisible();
  await page.getByLabel('Content type').selectOption('COURSE');
  await expect(page.getByRole('heading', { name: 'Python Foundations' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'CLI Task Manager' })).toHaveCount(0);
  await page.getByLabel('Search').fill('missing');
  await expect(page.getByText('No drafts match these filters.')).toBeVisible();
  await page.goto('/tests/browser/publishing.html?role=reviewer');
  await expect(page.getByRole('heading', { name: 'CLI Task Manager' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish' })).toHaveCount(0);
});

test('Challenge appears in Drafts, Published, and Version History filters', async ({ page }) => {
  await fixture(page);
  const challenge = draft('CHALLENGE', 'challenge-one', 'Double a Number');
  const pointer = { contentId: challenge.contentId, contentType: 'CHALLENGE', metadataSnapshot: { title: challenge.title }, activeVersion: 1, latestVersion: 1, activeRevision: 1, publicationStatus: 'ACTIVE', publishedAt: '2026-10-07T00:00:00Z' };
  await page.route('**/api/admin-content/draft-summaries?*', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [challenge], nextCursor: null }) }));
  await page.route('**/api/admin-content/catalog?*', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ items: [pointer], nextCursor: null }) }));
  await page.route('**/api/admin-content/history/challenge-one', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ versions: versions(challenge).slice(0, 1), active: pointer }) }));
  await page.reload();
  await page.getByLabel('Content type').selectOption('CHALLENGE');
  await expect(page.getByRole('heading', { name: 'Double a Number' })).toBeVisible();
  await page.getByRole('link', { name: 'Published' }).click();
  await page.getByLabel('Content type').selectOption('CHALLENGE');
  await expect(page.getByRole('heading', { name: 'Double a Number' })).toBeVisible();
  await page.getByRole('link', { name: 'Version History' }).click();
  await page.getByLabel('Content type').selectOption('CHALLENGE');
  await expect(page.getByRole('heading', { name: /v2.*Double a Number/ })).toBeVisible();
});

test('Published archive and version rollback retain immutable history', async ({ page }) => {
  await fixture(page);
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('link', { name: 'Published' }).click();
  const project = page.locator('.publishing-row').filter({ hasText: 'CLI Task Manager' });
  await project.getByRole('button', { name: 'Archive' }).click();
  await expect(project.getByText('ARCHIVED', { exact: true })).toBeVisible();
  await project.getByRole('button', { name: 'View versions' }).click();
  await expect(page.getByRole('heading', { name: 'v1 · CLI Task Manager' })).toBeVisible();
  await page.getByRole('button', { name: 'Make active' }).last().click();
  await expect(page.getByText('ACTIVE', { exact: true }).first()).toBeVisible();
  await expect(page.locator('.publishing-row')).toHaveCount(2);
});

test('authorized Admin can publish a draft through the existing action', async ({ page }) => {
  await fixture(page);
  page.on('dialog', (dialog) => dialog.accept());
  const project = page.locator('.publishing-row').filter({ hasText: 'CLI Task Manager' });
  await project.getByRole('button', { name: 'Publish' }).click();
  await expect(project).toContainText('Published v3');
});

test('200 migrated Practice drafts stay paged in the UI and searchable', async ({ page }) => {
  await fixture(page);
  const practice = migratePracticeBank().drafts.map((document) => draft(document.contentType, document.contentId, document.content.title));
  await page.route('**/api/admin-content/draft-summaries*', async (route) => {
    const cursor = new URL(route.request().url()).searchParams.get('cursor');
    const start = cursor ? practice.findIndex((item) => item.contentId === cursor) + 1 : 0;
    const items = practice.slice(start, start + 50);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items, nextCursor: start + 50 < practice.length ? items.at(-1).contentId : null }) });
  });
  await page.reload();
  await expect(page.locator('.publishing-row')).toHaveCount(20);
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(page.locator('.publishing-row')).toHaveCount(40);
  await page.getByLabel('Search').fill(practice.at(-1).contentId);
  await expect(page.locator('.publishing-row')).toHaveCount(1);
});

test('Assets lists the 17 migrated image references and remains responsive', async ({ page }) => {
  await fixture(page);
  await page.getByRole('link', { name: 'Assets' }).click();
  await expect(page.locator('.publishing-assets article')).toHaveCount(17);
  await expect.poll(() => page.locator('.publishing-assets article img').first().evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  await page.getByLabel('Search').fill(assets[11].assetId);
  await expect(page.locator('.publishing-assets article')).toHaveCount(1);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 760, height: 820 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  }
});

test('Assets accepts a raster upload and rejects an invalid file before transport', async ({ page }) => {
  await fixture(page);
  await page.getByRole('link', { name: 'Assets' }).click();
  const input = page.locator('input[type=file]');
  await input.setInputFiles({ name: 'diagram.png', mimeType: 'image/png', buffer: Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex') });
  await expect(page.getByText('diagram.png uploaded.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'diagram.png' })).toBeVisible();
  await input.setInputFiles({ name: 'payload.txt', mimeType: 'text/plain', buffer: Buffer.from('not an image') });
  await expect(page.getByText('Choose a PNG, JPEG, or WebP image no larger than 2 MiB.')).toBeVisible();
});

test('Image block can select a registered asset without typing its ID', async ({ page }) => {
  await fixture(page);
  await page.goto('/tests/browser/publishing.html?initialPath=/content/editor');
  await page.getByRole('button', { name: 'Add Image block' }).click();
  await page.getByRole('button', { name: 'Select asset' }).click();
  const picker = page.getByRole('dialog', { name: 'Select asset' });
  await picker.getByLabel('Search assets').fill(assets[16].assetId);
  await picker.getByRole('button', { name: 'Select' }).click();
  await expect(page.getByLabel('Asset ID')).toHaveValue(assets[16].assetId);
});

test('all four Admin destinations fit desktop, tablet, and mobile', async ({ page }) => {
  await fixture(page);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 760, height: 820 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const destination of ['Drafts', 'Published', 'Version History', 'Assets']) {
      if (viewport.width < 901) await page.getByRole('button', { name: 'Open navigation' }).click();
      await page.getByRole('complementary', { name: 'Admin navigation' }).getByRole('link', { name: destination }).click();
      await expect(page.getByRole('main').getByRole('heading', { name: destination, level: 1 })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    }
  }
});
