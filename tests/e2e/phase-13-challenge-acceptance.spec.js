import { expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Timestamp } from 'firebase-admin/firestore';
import { createChallengeDraft } from '../../apps/admin/src/content-studio/challenges/challengeAuthoring.js';
import { ChallengeAssignmentService } from '../../server/admin/content/ChallengeAssignmentService.js';
import { ContentPublicationService } from '../../server/admin/content/ContentPublicationService.js';
import { PublishedContentService } from '../../server/admin/content/PublishedContentService.js';
import { InMemoryArtifactStore, InMemoryContentPublicationStore } from '../../server/admin/content/InMemoryContentPublicationStore.js';
import { FirestoreMvpActivityMetadataSource } from '../../functions/src/coins/FirestoreMvpActivityMetadataSource.js';
import { MvpCanonicalActivityResolver } from '../../functions/src/coins/MvpCanonicalActivityResolver.js';
import { MvpActivityCompletionService } from '../../functions/src/coins/MvpActivityCompletionService.js';
import { adminDb, test } from './fixtures/authenticated-projects.js';

const actor = { uid: 'phase-13-browser-admin', role: 'SUPER_ADMIN' };
const today = () => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

test('published Challenge is assigned, solved, persisted and shown on the daily hub @runtime', async ({ page, projectLearner }) => {
  test.setTimeout(180_000);
  const date = today();
  const occupied = await adminDb.collection('dailyChallenges').where('date', '==', date).get();
  for (const entry of occupied.docs) {
    if (!String(entry.data().canonicalContentId ?? '').startsWith('phase-13-')) throw new Error(`Daily Challenge ${date} is occupied by a non-test assignment.`);
    await entry.ref.delete();
  }
  const { documentId: _documentId, ...draft } = createChallengeDraft(`phase-13-${projectLearner.uid.slice(0, 12)}`);
  const contentId = draft.contentId;
  draft.content.date = date;
  draft.content.title = 'Double the Input';
  draft.content.summary = 'Read a number and print twice its value.';
  draft.content.blocks[0].content = 'Read an integer from stdin and print its double.';
  draft.content.stdin = '5';
  draft.content.starterCode = 'n = int(input())\nprint(n * 2)';
  draft.content.verification.expectedOutput = '10';
  const store = new InMemoryContentPublicationStore();
  const artifacts = new InMemoryArtifactStore();
  const publication = new ContentPublicationService({ store, artifacts });
  const delivery = new PublishedContentService({ store, artifacts });
  await publication.saveDraft({ actor, document: draft });
  await publication.publish({ actor, contentId, expectedRevision: 1 });
  await adminDb.doc(`publishedContent/${contentId}`).set({ contentType: 'CHALLENGE', publicationStatus: 'ACTIVE', activeVersion: 1 });
  const assigned = await new ChallengeAssignmentService({ db: adminDb, delivery }).assign({ contentId, actor });
  expect(assigned).toMatchObject({ id: date, canonicalContentId: contentId, canonicalVersion: 1, rewardCoins: 20 });

  const pyodideFiles = new Map([['pyodide.mjs', 'text/javascript'], ['pyodide.asm.mjs', 'text/javascript'], ['pyodide.asm.wasm', 'application/wasm'], ['python_stdlib.zip', 'application/zip'], ['pyodide-lock.json', 'application/json']]);
  await page.context().route('https://cdn.jsdelivr.net/pyodide/v314.0.3/full/**', async (route) => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1);
    if (!pyodideFiles.has(name)) return route.abort();
    return route.fulfill({ status: 200, contentType: pyodideFiles.get(name), headers: { 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin' }, body: await readFile(resolve(import.meta.dirname, '../../node_modules/pyodide', name)) });
  });
  await page.context().route('**/api/admin-content/public**', async (route) => {
    const url = new URL(route.request().url());
    const parts = url.pathname.replace(/^\/api\/admin-content\/public\/?/, '').split('/').filter(Boolean);
    try {
      const payload = !parts.length ? { items: await delivery.listActive(url.searchParams.get('contentType')) }
        : parts[1] ? await delivery.fetchVersion(parts[0], Number(parts[1])) : await delivery.resolveActive(parts[0]);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
    } catch (error) {
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: error.code ?? 'content/not-published' } }) });
    }
  });
  const metadata = new FirestoreMvpActivityMetadataSource({ db: adminDb });
  const resolver = new MvpCanonicalActivityResolver({
    loadPracticeMetadata: metadata.loadPracticeMetadata.bind(metadata),
    loadDailyChallengeMetadata: metadata.loadDailyChallengeMetadata.bind(metadata),
  });
  const completions = new MvpActivityCompletionService({ db: adminDb, resolver, timestamp: () => Timestamp.now(), rewardService: { claimActivityReward: async () => ({ status: 'unavailable' }) } });
  await page.context().route('**/api/activity/complete', async (route) => {
    if (!route.request().headers().authorization?.startsWith('Bearer ')) return route.fulfill({ status: 401, body: '{}' });
    try {
      const result = await completions.complete({ principal: { authenticated: true, uid: projectLearner.uid }, request: route.request().postDataJSON() });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
    } catch (error) {
      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { code: error.code ?? 'completion/failed', message: error.message } }) });
    }
  });

  await page.goto('/challenges');
  await expect(page.getByRole('heading', { name: 'Double the Input' })).toBeVisible();
  await page.getByRole('button', { name: /Start Today.s Challenge/ }).click();
  await expect(page.getByRole('heading', { name: 'Double the Input' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'AI Tutor' })).toHaveCount(0);
  const editor = page.getByRole('textbox', { name: 'main.py code editor' });
  await editor.focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText('print("wrong")');
  await page.getByRole('button', { name: 'Run code' }).click();
  await expect(page.locator('#compiler-panel-output')).toContainText('wrong', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Check Output' }).click();
  await expect(page.getByRole('button', { name: 'Save Completion' })).toBeDisabled();
  await editor.focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText('n = int(input())\nprint(n * 2)');
  await page.getByRole('button', { name: 'Run code' }).click();
  await expect(page.locator('#compiler-panel-output')).toContainText('10', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Check Output' }).click();
  await expect(page.getByRole('button', { name: 'Save Completion' })).toBeEnabled();
  await page.getByRole('button', { name: 'Save Completion' }).click();
  await expect(page.getByRole('button', { name: 'Completed' })).toBeDisabled();
  const saved = await adminDb.collection(`users/${projectLearner.uid}/activityCompletions`).where('activityType', '==', 'DAILY_CHALLENGE').get();
  expect(saved.docs.some((entry) => entry.data().occurrenceDate === date && entry.data().activityVersion === 'v1')).toBe(true);
  await page.goto('/challenges');
  await expect(page.getByText(/Today.s challenge completed/)).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('gridcell', { name: /challenge completed/ })).toBeVisible();
  await adminDb.doc(`dailyChallenges/${date}`).delete();
  await adminDb.doc(`publishedContent/${contentId}`).delete();
});
