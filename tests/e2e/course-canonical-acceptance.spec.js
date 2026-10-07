import { expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Timestamp } from 'firebase-admin/firestore';
import { ContentPublicationService } from '../../server/admin/content/ContentPublicationService.js';
import { PublishedContentService } from '../../server/admin/content/PublishedContentService.js';
import { InMemoryArtifactStore, InMemoryContentPublicationStore } from '../../server/admin/content/InMemoryContentPublicationStore.js';
import { FirebaseContentPublicationStore } from '../../server/admin/content/FirebaseContentPublicationStore.js';
import { CourseCompletionService } from '../../functions/src/certification/CourseCompletionService.js';
import { createMiniCourseFixture } from '../content-contracts/fixtures.js';
import { migratePythonCourse } from '../../scripts/content/migrationCore.mjs';
import { adminDb, provisionUser, signIn, test } from './fixtures/authenticated-projects.js';

const courseId = 'python-mini-fundamentals';
const actor = { uid: 'course-e2e-admin', role: 'SUPER_ADMIN' };

test('Phase 9 migrated Python Course discovers, runs code, answers a quiz and resumes', async ({ page, projectLearner }) => {
  const harness = createPublishedCourseHarness();
  const { documentId, ...document } = migratePythonCourse().drafts[0];
  await harness.publish(document);
  await installCourseTransport(page.context(), harness, projectLearner.uid);
  await page.goto('/library');
  const card = page.getByRole('link', { name: 'Python Foundations' });
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByRole('heading', { name: 'Getting started with Python', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Start this Course' }).click();
  await expect(page.getByRole('heading', { name: 'Introduction to Python' })).toBeVisible();
  await page.locator('[data-lesson-end]').first().scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Complete Lesson' })).toBeEnabled();
  await page.getByRole('button', { name: 'Complete Lesson' }).click();
  await expect(page.getByText('Lesson completion verified.')).toBeVisible();
  await expect.poll(async () => (await adminDb.doc(`users/${projectLearner.uid}/progress/python`).get()).data()?.contentVersion).toBe(1);
  await page.getByRole('button', { name: 'Next Lesson' }).click();
  await expect(page.getByRole('heading', { name: 'Run Your First Python Program' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Run Your First Python Program' })).toBeVisible();
  await page.getByRole('complementary', { name: 'python practice compiler' }).getByRole('button', { name: 'Run code' }).click();
  await expect(page.locator('#compiler-panel-output')).toContainText('Hii , World!', { timeout: 60_000 });
  await page.locator('[data-lesson-end]').first().scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Complete Lesson' }).click();
  await expect(page.getByText('Lesson completion verified.')).toBeVisible();
  await page.getByRole('button', { name: 'Next Lesson' }).click();
  await expect(page.getByRole('heading', { name: 'Working of the Program' })).toBeVisible();
  await page.locator('[data-lesson-end]').first().scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Complete Lesson' }).click();
  await expect(page.getByText('Lesson completion verified.')).toBeVisible();
  await page.getByRole('button', { name: 'Next Lesson' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Quiz: Which of the following is the correct way to display Welcome to Go Coder/ })).toBeVisible();
  await page.getByRole('radio', { name: 'print("Welcome to Go Coder")', exact: true }).check();
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.getByText(/Correct/)).toBeVisible();
  await page.getByRole('button', { name: 'Complete Lesson' }).click();
  await expect(page.getByText('Lesson completion verified.')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: /Quiz: Which of the following is the correct way to display Welcome to Go Coder/ })).toBeVisible();
});

function createPublishedCourseHarness() {
  const store = new InMemoryContentPublicationStore();
  const artifacts = new InMemoryArtifactStore();
  const publication = new ContentPublicationService({ store, artifacts });
  const delivery = new PublishedContentService({ store, artifacts });
  const db = {
    doc(path) {
      if (!path.startsWith('publishedContent/')) return adminDb.doc(path);
      const [, id, , version] = path.split('/');
      return { get: async () => {
        const data = version ? await store.getVersion(id, Number(version)) : await store.getPointer(id);
        return { exists: data != null, data: () => data ?? undefined };
      } };
    },
    runTransaction: (operation) => adminDb.runTransaction(operation),
  };
  const bucket = { file: (path) => ({ download: async () => [await artifacts.read(path)] }) };
  const completion = new CourseCompletionService({ db, bucket, readingMinimumMs: 0, timestampFromMillis: Timestamp.fromMillis });
  async function publish(document, expectedRevision = 0, expectedActiveRevision = null) {
    const draft = await publication.saveDraft({ actor, document, expectedRevision });
    return publication.publish({ actor, contentId: document.contentId, expectedRevision: draft.draftRevision, expectedActiveRevision });
  }
  return { publication, delivery, completion, publish };
}

async function installCourseTransport(context, harness, uid) {
  const pyodideFiles = new Map([['pyodide.mjs', 'text/javascript'], ['pyodide.asm.mjs', 'text/javascript'], ['pyodide.asm.wasm', 'application/wasm'], ['python_stdlib.zip', 'application/zip'], ['pyodide-lock.json', 'application/json']]);
  await context.route('https://cdn.jsdelivr.net/pyodide/v314.0.3/full/**', async (route) => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1);
    if (!pyodideFiles.has(name)) return route.abort();
    return route.fulfill({ status: 200, contentType: pyodideFiles.get(name), headers: { 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' }, body: await readFile(resolve(import.meta.dirname, '../../node_modules/pyodide', name)) });
  });
  await context.route('**/api/admin-content/public**', async (route) => {
    const url = new URL(route.request().url());
    const rest = url.pathname.replace(/^\/api\/admin-content\/public\/?/, '').split('/').filter(Boolean);
    try {
      const payload = rest.length === 0 ? { items: await harness.delivery.listActive(url.searchParams.get('contentType')) }
        : rest[1] ? await harness.delivery.fetchVersion(rest[0], Number(rest[1])) : await harness.delivery.resolveActive(rest[0]);
      await route.fulfill({ status: payload ? 200 : 404, contentType: 'application/json', body: JSON.stringify(payload ?? { error: { code: 'content/not-published' } }) });
    } catch (error) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: error.code ?? 'content/not-published', message: error.message } }) });
    }
  });
  for (const name of ['beginTrustedLessonEvidence', 'recordTrustedLessonCompletion']) {
    await context.route(`**/${name}`, async (route) => {
      const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, content-type, x-firebase-appcheck' };
      if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      try {
        const request = route.request().postDataJSON();
        const result = name === 'beginTrustedLessonEvidence'
          ? await harness.completion.beginLessonEvidence(uid, request.data)
          : await harness.completion.recordLessonCompletion(uid, request.data);
        return route.fulfill({ status: 200, contentType: 'application/json', headers, body: JSON.stringify({ result }) });
      } catch (error) {
        return route.fulfill({ status: 400, contentType: 'application/json', headers, body: JSON.stringify({ error: { status: 'FAILED_PRECONDITION', message: error.message } }) });
      }
    });
  }
}

async function openCourseFromLibrary(page, title) {
  await page.goto('/library');
  const catalog = await page.evaluate(async () => (await fetch('/api/admin-content/public?contentType=COURSE')).json());
  expect(catalog.items).toEqual(expect.arrayContaining([expect.objectContaining({ contentId: courseId })]));
  const card = page.getByRole('link', { name: title });
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
}

async function storedProgress(uid) {
  return (await adminDb.doc(`users/${uid}/progress/${courseId}`).get()).data();
}

test('canonical Course publishes, completes, pins, rolls back, and archives in the learner browser', async ({ page, browser, request, projectLearner }, testInfo) => {
  const harness = createPublishedCourseHarness();
  const first = createMiniCourseFixture();
  await harness.publish(first);
  expect((await harness.delivery.resolveActive(courseId)).metadata.status).toBe('READY');
  await installCourseTransport(page.context(), harness, projectLearner.uid);

  await openCourseFromLibrary(page, first.content.title);
  await page.getByRole('button', { name: /Start Course/ }).first().click();
  await expect(page.getByText('Print a greeting.')).toBeVisible();
  await page.locator('[data-lesson-end="hello"]').scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'Complete Lesson' })).toBeEnabled();
  await page.getByRole('button', { name: 'Complete Lesson' }).click();
  await expect(page.getByText('Lesson completion verified.')).toBeVisible();
  await page.getByRole('button', { name: 'Next Lesson' }).click();
  await expect(page.getByRole('heading', { name: 'Which function prints output?' })).toBeVisible();
  await page.getByLabel('print()').check();
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.getByText(/Correct/)).toBeVisible();
  await page.getByRole('button', { name: 'Complete Lesson' }).click();
  await expect(page.getByText('Lesson completion verified.')).toBeVisible();
  await expect.poll(async () => (await storedProgress(projectLearner.uid))?.contentVersion).toBe(1);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Which function prints output?' })).toBeVisible();
  expect((await storedProgress(projectLearner.uid)).completedLessons).toEqual(expect.arrayContaining(['hello', 'quiz']));

  const second = createMiniCourseFixture();
  second.content.title = 'Python Mini Fundamentals v2';
  second.content.modules[0].lessons[0].blocks[0].content = 'Version two lesson content.';
  await harness.publish(second, 1, 1);
  await page.goto(`/courses/${courseId}`);
  await expect(page.getByRole('heading', { name: first.content.title, level: 1 })).toBeVisible();
  const newIdentity = await provisionUser(request, testInfo);
  const secondContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  try {
    await installCourseTransport(secondContext, harness, newIdentity.uid);
    const newPage = await secondContext.newPage();
    await signIn(newPage, newIdentity);
    await openCourseFromLibrary(newPage, second.content.title);
    await newPage.getByRole('button', { name: /Start Course/ }).first().click();
    await expect(newPage.getByText('Version two lesson content.')).toBeVisible();
    await expect.poll(async () => (await storedProgress(newIdentity.uid))?.contentVersion).toBe(2);
    await harness.publication.activate({ actor, contentId: courseId, version: 1, expectedActiveRevision: 2 });
    await newPage.reload();
    await expect(newPage.getByText('Version two lesson content.')).toBeVisible();
    const rollbackIdentity = await provisionUser(request, testInfo);
    const rollbackContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
    try {
      await installCourseTransport(rollbackContext, harness, rollbackIdentity.uid);
      const rollbackPage = await rollbackContext.newPage();
      await signIn(rollbackPage, rollbackIdentity);
      await openCourseFromLibrary(rollbackPage, first.content.title);
      await rollbackPage.getByRole('button', { name: /Start Course/ }).first().click();
      await expect(rollbackPage.getByText('Print a greeting.')).toBeVisible();
      await expect.poll(async () => (await storedProgress(rollbackIdentity.uid))?.contentVersion).toBe(1);
    } finally { await rollbackContext.close(); }
    await page.goto('/library');
    await expect(page.getByRole('link', { name: first.content.title })).toBeVisible();
    await harness.publication.archive({ actor, contentId: courseId, expectedActiveRevision: 3 });
    await page.reload();
    await expect(page.getByRole('link', { name: first.content.title })).toHaveCount(0);
    await newPage.goto(`/courses/${courseId}`);
    await expect(newPage.getByRole('heading', { name: second.content.title, level: 1 })).toBeVisible();
    await page.goto(`/courses/${courseId}`);
    await expect(page.getByRole('heading', { name: first.content.title, level: 1 })).toBeVisible();
  } finally { await secondContext.close(); }
});

test('segmented Course drafts retain reordered modules and lessons with optimistic concurrency', async () => {
  const store = new FirebaseContentPublicationStore(adminDb);
  const service = new ContentPublicationService({ store, artifacts: new InMemoryArtifactStore() });
  const fixture = createMiniCourseFixture();
  fixture.contentId = 'phase-8a-segmented-course';
  fixture.content.courseId = fixture.contentId;
  const first = await service.saveDraft({ actor, document: fixture });
  const root = (await adminDb.doc(`adminContentDrafts/${fixture.contentId}`).get()).data();
  expect(root.segmentedCourseDraft).toBe(true);
  expect(root.document.content.modules).toEqual([]);
  expect(root.courseModuleIds).toEqual(fixture.content.modules.map(({ id }) => id));
  expect((await store.getDraft(fixture.contentId)).document.content.modules).toEqual(fixture.content.modules);

  const reordered = structuredClone(first.document);
  reordered.content.modules.reverse().forEach((module, index) => { module.order = index + 1; });
  const lessons = reordered.content.modules[1].lessons;
  lessons.reverse().forEach((lesson, index) => { lesson.order = index + 1; });
  const second = await service.saveDraft({ actor, document: reordered, expectedRevision: 1 });
  const reloaded = await store.getDraft(fixture.contentId);
  expect(reloaded.draftRevision).toBe(2);
  expect(reloaded.document.content.modules).toEqual(reordered.content.modules);
  expect(reloaded.document.content.modules[1].lessons.map(({ id }) => id)).toEqual(['quiz', 'hello']);
  await expect(service.saveDraft({ actor, document: first.document, expectedRevision: 1 })).rejects.toMatchObject({ code: 'content/draft-conflict' });
  expect((await store.getDraft(fixture.contentId)).document.content.modules).toEqual(second.document.content.modules);
});
