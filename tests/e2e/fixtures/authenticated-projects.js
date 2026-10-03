import { randomBytes } from 'node:crypto';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { expect, test as base } from '@playwright/test';

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
const projectId = 'demo-mitutora';
const adminApp = getApps().find(({ name }) => name === 'projects-e2e') ?? initializeApp({ projectId }, 'projects-e2e');
const adminDb = getFirestore(adminApp);
const authEndpoint = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function provisionUser(request, testInfo) {
  const nonce = `${testInfo.workerIndex}-${randomBytes(8).toString('hex')}`;
  const email = `projects-${nonce}@example.test`;
  const password = `Projects-${randomBytes(12).toString('base64url')}!1`;
  const created = await request.post(`${authEndpoint}/accounts:signUp?key=demo-api-key`, { data: { email, password, returnSecureToken: true } });
  expect(created.ok()).toBe(true);
  const identity = await created.json();
  const subscriptionId = `projects-e2e-${nonce}`;
  const expiresAt = Timestamp.fromMillis(Date.now() + 3_600_000);
  await adminDb.doc(`users/${identity.localId}/subscriptions/${subscriptionId}`).set({ ownerUid: identity.localId, subscriptionId, status: 'ACTIVE', tier: 'PREMIUM', planId: 'monthly', expiresAt });
  await adminDb.doc(`users/${identity.localId}/entitlements/premium`).set({ ownerUid: identity.localId, subscriptionId, active: true, tier: 'PREMIUM', planId: 'monthly', expiresAt });
  return { uid: identity.localId, email, password, idToken: identity.idToken };
}

async function signIn(page, identity) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(identity.email);
  await page.getByLabel('Password').fill(identity.password);
  await page.getByRole('button', { name: /^Sign in/ }).click();
  await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible({ timeout: 60_000 });
}

export async function openShellPage(page, name) {
  if (name === 'Projects' && await page.getByRole('region', { name: 'Project filters' }).isVisible()) return;
  const menu = page.getByRole('button', { name: 'Open navigation' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: new RegExp(`^${name}$`, 'i') }).first().click();
}

export async function openTaskManager(page, language = 'Python') {
  await openShellPage(page, 'Projects');
  await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  const card = page.getByRole('article').filter({ hasText: 'CLI Task Manager' });
  await card.getByRole('button', { name: /Start Project|Continue Project|Review Project/ }).click();
  const start = page.getByRole('button', { name: /Start Project|Continue Project|Review Project/ });
  if (await start.isVisible()) await start.click();
  const radio = page.getByRole('radio', { name: new RegExp(`^${escapeRegExp(language)}(?:\\s|$)`) });
  if (await radio.isVisible()) {
    await radio.click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Initialize Project' }).click();
  }
  await expect(page.locator('.project-ide-shell')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 30_000 });
}

export async function replaceEditorSource(page, source) {
  const editor = page.getByRole('textbox', { name: /editor/i }).first();
  await editor.focus();
  await editor.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.insertText(source);
  await expect(page.getByText(/^Saving/, { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 30_000 });
}

export async function clearProjectLocalCache(page, uid) {
  await page.evaluate((learnerUid) => {
    localStorage.removeItem('mi-tutora:projects:v1');
    if (learnerUid) localStorage.removeItem(`mi-tutora:projects:v1:${learnerUid}`);
  }, uid);
}

export async function projectCloudState(uid, projectId = 'cli-task-manager') {
  const metadata = await adminDb.doc(`users/${uid}/activeProjects/${projectId}`).get();
  const files = await adminDb.collection(`users/${uid}/activeProjects/${projectId}/files`).get();
  return { metadata: metadata.data(), files: Object.fromEntries(files.docs.map((item) => [item.data().path, item.data()])) };
}

export { adminDb };

export const test = base.extend({
  projectLearner: async ({ page, request }, use, testInfo) => {
    const identity = await provisionUser(request, testInfo);
    await signIn(page, identity);
    await use(identity);
  },
});
