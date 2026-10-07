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
import { MvpActivityRewardClaimService } from '../../functions/src/coins/MvpActivityRewardClaimService.js';
import { CoinLedgerService } from '../../functions/src/coins/CoinLedgerService.js';
import { coinRewardPolicy } from '../../functions/src/coins/CoinRewardPolicy.js';
import { adminDb, provisionUser, signIn, test } from './fixtures/authenticated-projects.js';

const actor = { uid: 'phase-13-version-admin', role: 'SUPER_ADMIN' };
const dateInKolkata = (value) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value).filter(({ type }) => type !== 'literal').map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const addDays = (date, count) => new Date(Date.parse(`${date}T00:00:00Z`) + count * 86_400_000).toISOString().slice(0, 10);
const atNoon = (date) => new Date(`${date}T06:30:00Z`);

async function clearOwnAssignments(dates) {
  for (const date of dates) {
    const existing = await adminDb.collection('dailyChallenges').where('date', '==', date).get();
    for (const item of existing.docs) {
      if (!String(item.data().canonicalContentId ?? '').startsWith('phase-13-version-')) throw new Error(`Daily Challenge ${date} is occupied by another fixture.`);
      await item.ref.delete();
    }
  }
}

function withVersion(draft, version, date) {
  const copy = structuredClone(draft);
  copy.content.date = date;
  copy.content.title = `Double the Input v${version}`;
  copy.content.summary = `Version ${version}: double the input.`;
  copy.content.blocks[0].content = `Version ${version}: read an integer and print its double.`;
  copy.content.stdin = '5';
  copy.content.starterCode = 'n = int(input())\nprint(n * 2)';
  copy.content.verification.expectedOutput = '10';
  return copy;
}

async function installTransport(context, delivery, complete, uid) {
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
      const payload = !parts.length ? { items: await delivery.listActive(url.searchParams.get('contentType')) }
        : parts[1] ? await delivery.fetchVersion(parts[0], Number(parts[1])) : await delivery.resolveActive(parts[0]);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
    } catch (error) {
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: error.code ?? 'content/not-published' } }) });
    }
  });
  await context.route('**/api/activity/complete', async (route) => {
    if (!route.request().headers().authorization?.startsWith('Bearer ')) return route.fulfill({ status: 401, body: '{}' });
    try {
      const result = await complete.complete({ principal: { authenticated: true, uid }, request: route.request().postDataJSON() });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result) });
    } catch (error) {
      return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: { code: error.code ?? 'completion/failed', message: error.message } }) });
    }
  });
}

async function runSolution(page, source, output) {
  const editor = page.getByRole('textbox', { name: 'main.py code editor' });
  await editor.focus();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText(source);
  await page.getByRole('button', { name: 'Run code' }).click();
  await expect(page.locator('#compiler-panel-output')).toContainText(output, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Check Output' }).click();
}

async function assertOneReward(uid, date) {
  const completion = await adminDb.collection(`users/${uid}/activityCompletions`).where('occurrenceDate', '==', date).get();
  expect(completion.size).toBe(1);
  expect(completion.docs[0].data()).toMatchObject({ activityType: 'DAILY_CHALLENGE', activityId: date, activityVersion: 'v1', occurrenceDate: date, completionStatus: 'COMPLETED', rewardStatus: 'CREDITED' });
  const ledger = await adminDb.collection(`users/${uid}/coinTransactions`).get();
  expect(ledger.size).toBe(1);
  expect(ledger.docs[0].data().amount).toBe(20);
}

test('dated v1/v2 publication, pinned learner history, rollback, archive and reward once @runtime', async ({ page, projectLearner: learnerA, browser, request }, testInfo) => {
  test.setTimeout(240_000);
  const dateA = dateInKolkata(new Date());
  const dateB = addDays(dateA, 1);
  const dateC = addDays(dateA, 2);
  await clearOwnAssignments([dateA, dateB, dateC]);
  const { documentId: _documentId, ...base } = createChallengeDraft(`phase-13-version-${learnerA.uid.slice(0, 8)}`);
  const contentId = base.contentId;
  const store = new InMemoryContentPublicationStore();
  const artifacts = new InMemoryArtifactStore();
  const publication = new ContentPublicationService({ store, artifacts });
  const delivery = new PublishedContentService({ store, artifacts });
  let serverNow = atNoon(dateA);
  const assignments = new ChallengeAssignmentService({ db: adminDb, delivery, now: () => serverNow });
  const metadata = new FirestoreMvpActivityMetadataSource({ db: adminDb });
  const resolver = new MvpCanonicalActivityResolver({ loadPracticeMetadata: metadata.loadPracticeMetadata.bind(metadata), loadDailyChallengeMetadata: metadata.loadDailyChallengeMetadata.bind(metadata) });
  const ledger = new CoinLedgerService({ db: adminDb, timestamp: () => Timestamp.fromDate(serverNow) });
  const rewardService = new MvpActivityRewardClaimService({ ledger, resolver, policy: coinRewardPolicy, now: () => serverNow, timestamp: () => Timestamp.fromDate(serverNow) });
  const completionService = new MvpActivityCompletionService({ db: adminDb, resolver, rewardService, now: () => serverNow, timestamp: () => Timestamp.fromDate(serverNow) });
  const syncPointer = async () => adminDb.doc(`publishedContent/${contentId}`).set(await store.getPointer(contentId));
  const assignment = async (date, version) => {
    const result = await assignments.assign({ contentId, actor });
    expect(result).toMatchObject({ date, canonicalVersion: version, version: 'v1', rewardCoins: 20 });
    return result;
  };

  const v1 = withVersion(base, 1, dateA);
  await publication.saveDraft({ actor, document: v1 });
  await publication.publish({ actor, contentId, expectedRevision: 1 });
  await syncPointer();
  await assignment(dateA, 1);
  await expect(assignments.assign({ contentId, actor })).rejects.toMatchObject({ code: 'challenge/date-occupied' });
  await installTransport(page.context(), delivery, completionService, learnerA.uid);
  await page.goto('/challenges');
  await expect(page.getByRole('heading', { name: 'Double the Input v1' })).toBeVisible();
  await page.getByRole('button', { name: /Start Today.s Challenge/ }).click();
  await expect(page.getByRole('heading', { name: 'Double the Input v1' })).toBeVisible();
  await runSolution(page, 'print("wrong")', 'wrong');
  await expect(page.getByRole('button', { name: 'Save Completion' })).toBeDisabled();
  await runSolution(page, 'n = int(input())\nprint(n * 2)', '10');
  await page.getByRole('button', { name: 'Save Completion' }).click();
  await expect(page.getByRole('button', { name: 'Completed', exact: true })).toBeDisabled();
  await assertOneReward(learnerA.uid, dateA);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Double the Input v1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Completed', exact: true })).toBeDisabled();
  await assertOneReward(learnerA.uid, dateA);

  const v2 = withVersion(base, 2, dateB);
  await publication.saveDraft({ actor, document: v2, expectedRevision: 1 });
  await publication.publish({ actor, contentId, expectedRevision: 2, expectedActiveRevision: 1 });
  await syncPointer();
  expect((await delivery.resolveActive(contentId)).document.content.date).toBe(dateB);
  expect((await delivery.fetchVersion(contentId, 1)).document.content.date).toBe(dateA);
  expect((await delivery.fetchVersion(contentId, 2)).document.content.date).toBe(dateB);
  expect((await adminDb.doc(`dailyChallenges/${dateA}`).get()).data().canonicalVersion).toBe(1);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Double the Input v1' })).toBeVisible();
  await assertOneReward(learnerA.uid, dateA);

  serverNow = atNoon(dateB);
  await assignment(dateB, 2);
  const learnerB = await provisionUser(request, testInfo);
  const contextB = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  const pageB = await contextB.newPage();
  await signIn(pageB, learnerB);
  await installTransport(contextB, delivery, completionService, learnerB.uid);
  await pageB.clock.setFixedTime(serverNow);
  await pageB.goto('/challenges');
  await expect(pageB.getByRole('heading', { name: 'Double the Input v2' })).toBeVisible();
  await pageB.getByRole('button', { name: /Start Today.s Challenge/ }).click();
  await expect(pageB.getByRole('heading', { name: 'Double the Input v2' })).toBeVisible();
  await runSolution(pageB, 'n = int(input())\nprint(n * 2)', '10');
  await pageB.getByRole('button', { name: 'Save Completion' }).click();
  await expect(pageB.getByRole('button', { name: 'Completed', exact: true })).toBeDisabled();
  await assertOneReward(learnerB.uid, dateB);
  await pageB.reload();
  await expect(pageB.getByRole('heading', { name: 'Double the Input v2' })).toBeVisible();
  await expect(pageB.getByRole('button', { name: 'Completed', exact: true })).toBeDisabled();
  await assertOneReward(learnerB.uid, dateB);

  await publication.activate({ actor, contentId, version: 1, expectedActiveRevision: 2 });
  await syncPointer();
  expect((await delivery.resolveActive(contentId)).document.version).toBe(1);
  expect((await adminDb.doc(`dailyChallenges/${dateA}`).get()).data().canonicalVersion).toBe(1);
  expect((await adminDb.doc(`dailyChallenges/${dateB}`).get()).data().canonicalVersion).toBe(2);
  serverNow = atNoon(dateC);
  await expect(assignments.assign({ contentId, actor })).rejects.toMatchObject({ code: 'challenge/date-past' });
  expect((await adminDb.doc(`dailyChallenges/${dateC}`).get()).exists).toBe(false);
  await assertOneReward(learnerA.uid, dateA);
  await assertOneReward(learnerB.uid, dateB);

  await publication.archive({ actor, contentId, expectedActiveRevision: 3 });
  await syncPointer();
  expect(await delivery.listActive('CHALLENGE')).toEqual([]);
  expect((await delivery.fetchVersion(contentId, 1)).document.content.date).toBe(dateA);
  expect((await delivery.fetchVersion(contentId, 2)).document.content.date).toBe(dateB);
  await page.clock.setFixedTime(serverNow);
  await pageB.clock.setFixedTime(serverNow);
  await page.goto(`/challenges/daily/${dateA}`);
  await pageB.goto(`/challenges/daily/${dateB}`);
  await expect(page.getByRole('heading', { name: 'Double the Input v1' })).toBeVisible();
  await expect(pageB.getByRole('heading', { name: 'Double the Input v2' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Completed', exact: true })).toBeDisabled();
  await expect(pageB.getByRole('button', { name: 'Completed', exact: true })).toBeDisabled();
  await page.goto('/');
  await pageB.goto('/');
  await expect(page.getByRole('gridcell', { name: new RegExp(`${Number(dateA.slice(-2))}, challenge completed`) })).toBeVisible();
  await expect(pageB.getByRole('gridcell', { name: new RegExp(`${Number(dateB.slice(-2))}, challenge completed`) })).toBeVisible();
  await assertOneReward(learnerA.uid, dateA);
  await assertOneReward(learnerB.uid, dateB);
  await publication.activate({ actor, contentId, version: 2, expectedActiveRevision: 4 });
  await syncPointer();
  expect((await delivery.resolveActive(contentId)).document.version).toBe(2);
  expect((await adminDb.doc(`dailyChallenges/${dateA}`).get()).data().canonicalVersion).toBe(1);
  expect((await adminDb.doc(`dailyChallenges/${dateB}`).get()).data().canonicalVersion).toBe(2);
  await assertOneReward(learnerA.uid, dateA);
  await assertOneReward(learnerB.uid, dateB);

  await contextB.close();
  await adminDb.doc(`dailyChallenges/${dateA}`).delete();
  await adminDb.doc(`dailyChallenges/${dateB}`).delete();
  await adminDb.doc(`publishedContent/${contentId}`).delete();
});
