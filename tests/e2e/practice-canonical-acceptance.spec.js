import { expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Timestamp } from 'firebase-admin/firestore';
import { ContentPublicationService } from '../../server/admin/content/ContentPublicationService.js';
import { PublishedContentService } from '../../server/admin/content/PublishedContentService.js';
import { InMemoryArtifactStore, InMemoryContentPublicationStore } from '../../server/admin/content/InMemoryContentPublicationStore.js';
import { MvpActivityCompletionService } from '../../functions/src/coins/MvpActivityCompletionService.js';
import { createPracticeFixture } from '../content-contracts/fixtures.js';
import { migratePracticeBank } from '../../scripts/content/migrationCore.mjs';
import { adminDb, provisionUser, signIn, test } from './fixtures/authenticated-projects.js';

const actor = { uid: 'practice-e2e-admin', role: 'SUPER_ADMIN' };
const questionId = 'print-greeting';

test('Phase 9 migrated Practice question filters, executes, verifies and persists a solve @runtime', async ({ page, projectLearner }) => {
  const state = harness();
  const { documentId, ...document } = migratePracticeBank().drafts.find((draft) => draft.contentId === 'practice-even-or-odd');
  await state.publish(document);
  await installTransport(page.context(), state, projectLearner.uid);
  await page.goto('/practice');
  await page.getByLabel('Search').fill('Even or Odd');
  const card = page.getByRole('button', { name: /Even or Odd/ });
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByRole('heading', { name: 'Even or Odd', level: 1 })).toBeVisible();
  const editor = page.locator('.compiler-panel .view-lines');
  await expect(editor).toContainText('number = int(input())');
  const setCode = async (code) => { await editor.click(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.insertText(code); };
  await setCode('print("Wrong")');
  await page.getByRole('button', { name: 'Run code' }).click();
  await expect(page.locator('#compiler-panel-output')).toContainText('Wrong', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Check Output' }).click();
  await expect(page.getByText(/Output does not match/)).toBeVisible();
  await setCode('n = int(input())\nprint("Even" if n % 2 == 0 else "Odd")');
  await page.getByRole('button', { name: 'Run code' }).click();
  await expect(page.locator('#compiler-panel-output')).toContainText('Even', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Check Output' }).click();
  await expect(page.getByText('Program output matches the expected result.')).toBeVisible();
  await page.getByRole('button', { name: 'Save Completion' }).click();
  await expect(page.getByRole('button', { name: 'Completed' })).toBeDisabled({ timeout: 15_000 });
  await expect.poll(async () => (await adminDb.collection(`users/${projectLearner.uid}/activityCompletions`).get()).docs.map((snapshot) => snapshot.data()).find((item) => item.activityId === 'practice-even-or-odd')?.activityVersion).toBe('v1');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Completed' })).toBeDisabled();
});

function harness() {
  const store = new InMemoryContentPublicationStore();
  const artifacts = new InMemoryArtifactStore();
  const publication = new ContentPublicationService({ store, artifacts });
  const delivery = new PublishedContentService({ store, artifacts });
  async function publish(document, expectedRevision = 0, expectedActiveRevision = null) {
    const saved = await publication.saveDraft({ actor, document, expectedRevision });
    return publication.publish({ actor, contentId: document.contentId, expectedRevision: saved.draftRevision, expectedActiveRevision });
  }
  const completion = new MvpActivityCompletionService({
    db: adminDb,
    timestamp: () => Timestamp.now(),
    resolver: { resolve: async ({ activityType, activityId }) => {
      if (activityType !== 'PRACTICE') return null;
      const pointer = await store.getPointer(activityId);
      return pointer?.publicationStatus === 'ACTIVE' && pointer.contentType === 'PRACTICE'
        ? { activityType, activityId, activityVersion: `v${pointer.activeVersion}`, occurrence: '' } : null;
    } },
    rewardService: { claimActivityReward: async () => ({ status: 'unavailable' }) },
  });
  return { store, artifacts, publication, delivery, publish, completion };
}

async function installTransport(context, state, uid, timings = {}) {
  const pyodideFiles = new Map([['pyodide.mjs', 'text/javascript'], ['pyodide.asm.mjs', 'text/javascript'], ['pyodide.asm.wasm', 'application/wasm'], ['python_stdlib.zip', 'application/zip'], ['pyodide-lock.json', 'application/json']]);
  await context.route('https://cdn.jsdelivr.net/pyodide/v314.0.3/full/**', async (route) => {
    timings.firstPyodideAssetAt ??= Date.now();
    const name = new URL(route.request().url()).pathname.split('/').at(-1);
    if (!pyodideFiles.has(name)) return route.abort();
    return route.fulfill({ status: 200, contentType: pyodideFiles.get(name), headers: { 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' }, body: await readFile(resolve(import.meta.dirname, '../../node_modules/pyodide', name)) });
  });
  await context.route('**/api/admin-content/public**', async (route) => {
    const url = new URL(route.request().url());
    const parts = url.pathname.replace(/^\/api\/admin-content\/public\/?/, '').split('/').filter(Boolean);
    try {
      const payload = !parts.length ? { items: await state.delivery.listActive(url.searchParams.get('contentType')) }
        : parts[1] ? await state.delivery.fetchVersion(parts[0], Number(parts[1])) : await state.delivery.resolveActive(parts[0]);
      return route.fulfill({ status: payload ? 200 : 404, contentType: 'application/json', body: JSON.stringify(payload ?? {}) });
    } catch (error) {
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: error.code ?? 'content/not-published' } }) });
    }
  });
  await context.route('**/api/activity/complete', async (route) => {
    if (!route.request().headers().authorization?.startsWith('Bearer ')) return route.fulfill({ status: 401, body: '{}' });
    try {
      const result = await state.completion.complete({ principal: { authenticated: true, uid }, request: route.request().postDataJSON() });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
    } catch (error) {
      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { code: error.code ?? 'completion/failed', message: error.message } }) });
    }
  });
}

async function openQuestion(page, title) {
  await page.goto('/practice');
  const card = page.getByRole('button', { name: new RegExp(title) });
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
}

test('published Practice runs, verifies, persists a versioned solve, rolls back, and archives @runtime', async ({ page, browser, request, projectLearner }, testInfo) => {
  const timings = {};
  page.on('pageerror', (error) => console.error('Learner Practice browser error:', error.message));
  page.on('requestfailed', (request) => { if (request.url().includes('pyodide')) console.error('Pyodide request failed:', request.url(), request.failure()); });
  page.on('worker', (worker) => { if (worker.url().includes('python.worker')) timings.pythonWorkerAt ??= Date.now(); });
  const state = harness();
  const first = createPracticeFixture();
  const secondQuestion = createPracticeFixture(1);
  await state.publish(first);
  await state.publish(secondQuestion);
  expect((await state.delivery.resolveActive(questionId)).metadata.status).toBe('READY');
  await installTransport(page.context(), state, projectLearner.uid, timings);

  await page.goto('/practice');
  await expect(page.getByRole('button', { name: /Print a greeting/ })).toBeVisible();
  await page.getByLabel('Search').fill('Sum two values');
  await expect(page.getByRole('button', { name: /Sum two values/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Print a greeting/ })).toHaveCount(0);
  await page.getByLabel('Search').fill('');
  await page.getByLabel('Difficulty').selectOption('easy');
  await expect(page.getByRole('button', { name: /Print a greeting/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Sum two values/ })).toHaveCount(0);
  await page.getByLabel('Difficulty').selectOption('all');
  await page.getByLabel('Language').selectOption('python');
  await page.locator('.practice-filter select').nth(2).selectOption('Output');
  const detailStartAt = Date.now();
  await page.getByRole('button', { name: /Print a greeting/ }).click();
  await expect(page.locator('.compiler-panel .view-lines')).toContainText('print("Hello")');
  const detailReadyAt = Date.now();
  const editor = page.locator('.compiler-panel .view-lines');
  await expect.poll(async () => (await page.locator('.compiler-panel').boundingBox())?.height ?? 0).toBeGreaterThan(300);
  await editor.click({ timeout: 10000 });
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText('print("Wrong")');
  const firstRunAt = Date.now();
  await page.getByRole('button', { name: 'Run code' }).click();
  await expect(page.locator('#compiler-panel-output')).toContainText('Wrong', { timeout: 60000 });
  const firstOutputAt = Date.now();
  await page.getByRole('button', { name: 'Check Output' }).click();
  await expect(page.getByText(/Output does not match/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save Completion' })).toBeDisabled();
  await editor.click({ timeout: 10000 });
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText('print("Hello")');
  const secondRunAt = Date.now();
  await page.getByRole('button', { name: 'Run code' }).click();
  await expect(page.locator('#compiler-panel-output')).toContainText('Hello', { timeout: 60000 });
  const secondOutputAt = Date.now();
  await page.getByRole('button', { name: 'Check Output' }).click();
  await expect(page.getByText('Program output matches the expected result.')).toBeVisible();
  console.log(`Learner Practice timings: detail=${detailReadyAt - detailStartAt}ms worker-start-after-run=${timings.pythonWorkerAt == null ? 'unobserved' : `${timings.pythonWorkerAt - firstRunAt}ms`} first-asset-after-run=${timings.firstPyodideAssetAt == null ? 'unobserved' : `${timings.firstPyodideAssetAt - firstRunAt}ms`} cold-run=${firstOutputAt - firstRunAt}ms warm-run=${secondOutputAt - secondRunAt}ms`);
  await page.getByRole('button', { name: 'Save Completion' }).click();
  await expect(page.getByRole('button', { name: 'Completed' })).toBeDisabled({ timeout: 15000 });
  await expect.poll(async () => (await adminDb.collection(`users/${projectLearner.uid}/activityCompletions`).get()).docs.map((doc) => doc.data()).find((item) => item.activityId === questionId)?.activityVersion).toBe('v1');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Completed' })).toBeDisabled();

  const revised = createPracticeFixture();
  revised.content.title = 'Print a greeting v2';
  await state.publish(revised, 1, 1);
  const other = await provisionUser(request, testInfo);
  const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  try {
    await installTransport(context, state, other.uid);
    const newPage = await context.newPage();
    await signIn(newPage, other);
    await openQuestion(newPage, revised.content.title);
    expect((await state.delivery.resolveActive(questionId)).document.version).toBe(2);
    await state.publication.activate({ actor, contentId: questionId, version: 1, expectedActiveRevision: 2 });
    await newPage.goto('/practice');
    await expect(newPage.getByRole('button', { name: /Print a greeting v2/ })).toHaveCount(0);
    await expect(newPage.getByRole('button', { name: /Print a greeting/ })).toBeVisible();
    expect((await state.delivery.fetchVersion(questionId, 2)).document.version).toBe(2);
    await state.publication.archive({ actor, contentId: questionId, expectedActiveRevision: 3 });
    await newPage.reload();
    await expect(newPage.getByRole('button', { name: /Print a greeting/ })).toHaveCount(0);
    expect((await state.delivery.fetchVersion(questionId, 1)).document.version).toBe(1);
    expect((await adminDb.collection(`users/${projectLearner.uid}/activityCompletions`).get()).docs.map((doc) => doc.data()).find((item) => item.activityId === questionId)?.activityVersion).toBe('v1');
  } finally { await context.close(); }
});
