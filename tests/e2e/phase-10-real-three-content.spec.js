import { expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Timestamp } from 'firebase-admin/firestore';
import { migrateCliTaskManager, migratePythonCourse, migratePracticeBank } from '../../scripts/content/migrationCore.mjs';
import { InMemoryArtifactStore, InMemoryContentPublicationStore } from '../../server/admin/content/InMemoryContentPublicationStore.js';
import { ContentPublicationService } from '../../server/admin/content/ContentPublicationService.js';
import { PublishedContentService } from '../../server/admin/content/PublishedContentService.js';
import { CourseCompletionService } from '../../functions/src/certification/CourseCompletionService.js';
import { MvpActivityCompletionService } from '../../functions/src/coins/MvpActivityCompletionService.js';
import { adminDb, openTaskManager, projectCloudState, test } from './fixtures/authenticated-projects.js';

const actor = { uid: 'phase-10-browser-admin', role: 'SUPER_ADMIN' };
const documentOf = ({ documentId, ...document }) => document;

test('real CLI Task Manager, Python Course and Practice coexist for one learner @runtime', async ({ page, projectLearner }) => {
  test.setTimeout(180_000);
  const store = new InMemoryContentPublicationStore();
  const artifacts = new InMemoryArtifactStore();
  const assets = new Set(migratePythonCourse().assets.map(({ assetId }) => assetId));
  const publication = new ContentPublicationService({ store, artifacts, assets: { exists: async (id) => assets.has(id) } });
  const delivery = new PublishedContentService({ store, artifacts });
  const drafts = [migrateCliTaskManager().drafts[0], migratePythonCourse().drafts[0], ...migratePracticeBank().drafts.filter(({ contentId }) => ['practice-even-or-odd', 'fund-variables-008'].includes(contentId))];
  for (const draft of drafts) {
    const document = documentOf(draft);
    const saved = await publication.saveDraft({ actor, document });
    await publication.publish({ actor, contentId: document.contentId, expectedRevision: saved.draftRevision });
  }
  const projectDocument = (await delivery.resolveActive('cli-task-manager')).document;
  await page.addInitScript((document) => {
    globalThis.__YCODERS_PROJECT_E2E_PUBLISHED_FETCH__ = async (input) => {
      const parts = new URL(input, location.origin).pathname.split('/').filter(Boolean).slice(3);
      if (!parts.length) return { ok: true, json: async () => ({ projects: [{ contentId: document.contentId, activeVersion: 1, metadata: { title: document.content.title } }] }) };
      return parts[0] === document.contentId ? { ok: true, json: async () => ({ document, metadata: { status: 'READY' } }) } : { ok: false, json: async () => ({ error: { code: 'content/not-published' } }) };
    };
  }, projectDocument);
  await installTransport(page.context(), { store, artifacts, delivery }, projectLearner.uid);

  let openedAt = Date.now();
  await page.goto('/projects');
  const projectCard = page.getByRole('article').filter({ hasText: 'CLI Task Manager' });
  await expect(projectCard).toHaveCount(1);
  await expect(page.getByText('Python Foundations')).toHaveCount(0);
  await openTaskManager(page);
  await expect(page.getByRole('heading', { name: 'Project Setup' })).toBeVisible();
  console.log(`Phase 10 learner Project open: ${Date.now() - openedAt}ms`);
  await page.getByRole('button', { name: 'Verify Task' }).click();
  await expect(page.getByRole('button', { name: 'Validate Checkpoint' })).toBeVisible({ timeout: 60_000 });
  await expect.poll(async () => (await projectCloudState(projectLearner.uid)).metadata?.contentVersion).toBe(1);
  await page.reload();
  await openTaskManager(page);
  await expect(page.getByRole('button', { name: 'Validate Checkpoint' })).toBeVisible();

  openedAt = Date.now();
  await page.goto('/library');
  await expect(page.getByRole('link', { name: 'Python Foundations' })).toHaveCount(1);
  await expect(page.getByText('CLI Task Manager')).toHaveCount(0);
  await page.getByRole('link', { name: 'Python Foundations' }).click();
  await expect(page.getByRole('button', { name: 'Start this Course' })).toBeVisible();
  console.log(`Phase 10 learner Course overview: ${Date.now() - openedAt}ms`);
  await page.getByRole('button', { name: 'Start this Course' }).click();
  await expect(page.getByRole('heading', { name: 'Introduction to Python' })).toBeVisible();
  await page.locator('[data-lesson-end]').first().scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Complete Lesson' }).click();
  await page.getByRole('button', { name: 'Next Lesson' }).click();
  await expect(page.getByRole('heading', { name: 'Run Your First Python Program' })).toBeVisible();
  await page.getByRole('complementary', { name: 'python practice compiler' }).getByRole('button', { name: 'Run code' }).click();
  await expect(page.locator('#compiler-panel-output')).toContainText('Hii , World!', { timeout: 60_000 });
  await page.locator('[data-lesson-end]').first().scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Complete Lesson' }).click();
  await page.getByRole('button', { name: 'Next Lesson' }).click();
  await page.locator('[data-lesson-end]').first().scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Complete Lesson' }).click();
  await page.getByRole('button', { name: 'Next Lesson' }).click();
  await page.getByRole('radio', { name: 'print("Welcome to Go Coder")', exact: true }).check();
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.getByText(/Correct/)).toBeVisible();
  await page.getByRole('button', { name: 'Complete Lesson' }).click();
  await expect.poll(async () => (await adminDb.doc(`users/${projectLearner.uid}/progress/python`).get()).data()?.contentVersion).toBe(1);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: /Quiz: Which of the following/ })).toBeVisible();

  openedAt = Date.now();
  await page.goto('/practice');
  await expect(page.getByRole('button', { name: /Even or Odd/ })).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Reason About Four Values/ })).toBeVisible();
  await expect(page.getByText('Python Foundations')).toHaveCount(0);
  await page.getByRole('button', { name: /Even or Odd/ }).click();
  await expect(page.getByRole('heading', { name: 'Even or Odd', level: 1 })).toBeVisible();
  console.log(`Phase 10 learner Practice detail: ${Date.now() - openedAt}ms`);
  const editor = page.locator('.compiler-panel .view-lines');
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
  await expect(page.getByRole('button', { name: 'Completed' })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Completed' })).toBeDisabled();
});

async function installTransport(context, state, uid) {
  const pyodideFiles = new Map([['pyodide.mjs', 'text/javascript'], ['pyodide.asm.mjs', 'text/javascript'], ['pyodide.asm.wasm', 'application/wasm'], ['python_stdlib.zip', 'application/zip'], ['pyodide-lock.json', 'application/json']]);
  await context.route('https://cdn.jsdelivr.net/pyodide/v314.0.3/full/**', async (route) => {
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
    } catch (error) { return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: error.code ?? 'content/not-published' } }) }); }
  });
  const db = { doc(path) {
    if (!path.startsWith('publishedContent/')) return adminDb.doc(path);
    const [, id, , version] = path.split('/');
    return { get: async () => { const data = version ? await state.store.getVersion(id, Number(version)) : await state.store.getPointer(id); return { exists: data != null, data: () => data ?? undefined }; } };
  }, runTransaction: (operation) => adminDb.runTransaction(operation) };
  const bucket = { file: (path) => ({ download: async () => [await state.artifacts.read(path)] }) };
  const course = new CourseCompletionService({ db, bucket, readingMinimumMs: 0, timestampFromMillis: Timestamp.fromMillis });
  for (const name of ['beginTrustedLessonEvidence', 'recordTrustedLessonCompletion']) await context.route(`**/${name}`, async (route) => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, content-type, x-firebase-appcheck' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    try { const payload = name === 'beginTrustedLessonEvidence' ? await course.beginLessonEvidence(uid, route.request().postDataJSON().data) : await course.recordLessonCompletion(uid, route.request().postDataJSON().data); return route.fulfill({ status: 200, contentType: 'application/json', headers, body: JSON.stringify({ result: payload }) }); }
    catch (error) { return route.fulfill({ status: 400, contentType: 'application/json', headers, body: JSON.stringify({ error: { status: 'FAILED_PRECONDITION', message: error.message } }) }); }
  });
  const practice = new MvpActivityCompletionService({ db: adminDb, timestamp: () => Timestamp.now(), resolver: { resolve: async ({ activityType, activityId }) => { const pointer = await state.store.getPointer(activityId); return activityType === 'PRACTICE' && pointer?.publicationStatus === 'ACTIVE' && pointer.contentType === 'PRACTICE' ? { activityType, activityId, activityVersion: `v${pointer.activeVersion}`, occurrence: '' } : null; } }, rewardService: { claimActivityReward: async () => ({ status: 'unavailable' }) } });
  await context.route('**/api/activity/complete', async (route) => {
    if (!route.request().headers().authorization?.startsWith('Bearer ')) return route.fulfill({ status: 401, body: '{}' });
    try { return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(await practice.complete({ principal: { authenticated: true, uid }, request: route.request().postDataJSON() })) }); }
    catch (error) { return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { code: error.code ?? 'completion/failed', message: error.message } }) }); }
  });
}
