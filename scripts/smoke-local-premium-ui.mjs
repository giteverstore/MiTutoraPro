import { randomBytes } from 'node:crypto';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:5173';
const authUrl = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const nonce = randomBytes(12).toString('hex');
const email = `premium-ui-${nonce}@example.test`;
const password = randomBytes(24).toString('base64url');
const lessonOne = 'lesson-1-1-introduction-to-python';
const lessonTwo = 'lesson-1-2-run-your-first-python-program';
const lessonThree = 'lesson-1-3-working-of-the-program';
const lessonFour = 'lesson-1-4-quiz-which-of-the-following-is-the-correct-way-to-displ';
const premiumCompilerLesson = 'lesson-1-5-your-first-python-greeting';
let identity;
let browser;

async function openShellPage(page, name) {
  const menu = page.getByRole('button', { name: 'Open navigation' });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: new RegExp(name, 'i') }).first().click();
}

async function returnToShell(page) {
  await page.goto(baseUrl);
  await page.getByRole('heading', { name: /Welcome back/i }).waitFor({ timeout: 60_000 });
}

try {
  const created = await fetch(`${authUrl}/accounts:signUp?key=local-emulator-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  identity = await created.json();
  if (!created.ok || !identity.localId) throw new Error('Local Auth user creation failed.');

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(baseUrl);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /^Sign in/ }).click();
  await page.getByRole('heading', { name: /Welcome back/i }).waitFor({ timeout: 60_000 });

  await openShellPage(page, 'Settings');
  await page.getByRole('button', { name: 'Subscription' }).click();
  await page.getByText('Free', { exact: true }).waitFor();
  await page.getByText('No active Premium subscription').waitFor();

  for (const lessonId of [lessonOne, lessonTwo, lessonThree]) {
    await page.goto(`${baseUrl}/courses/python/lesson/${lessonId}`);
    await page.getByLabel('Lesson content and navigation').waitFor({ timeout: 60_000 });
  }
  await page.goto(`${baseUrl}/courses/python/lesson/${lessonFour}`);
  await page.getByRole('heading', { name: 'Premium required' }).waitFor({ timeout: 60_000 });
  if (await page.getByLabel('Lesson content and navigation').count()) throw new Error('A Free learner mounted the Premium lesson workspace.');
  await page.reload();
  await page.getByRole('heading', { name: 'Premium required' }).waitFor();

  await returnToShell(page);
  await openShellPage(page, 'Practice');
  await page.getByRole('heading', { name: 'Practice' }).waitFor();
  await openShellPage(page, 'Challenges');
  await page.getByRole('heading', { name: 'Daily Challenge' }).waitFor();
  await openShellPage(page, 'Bookmarks');
  await page.getByRole('heading', { name: 'Everything you saved, in one place.' }).waitFor();

  await openShellPage(page, 'Certificates');
  await page.getByRole('heading', { name: 'Premium required' }).waitFor();
  await openShellPage(page, 'Projects');
  await page.getByRole('heading', { name: 'Premium required' }).waitFor();
  await page.getByRole('button', { name: 'View Premium Plans' }).click();
  await page.waitForURL('**/settings?section=subscription');
  await page.getByRole('heading', { name: 'Subscription' }).waitFor();

  await page.getByRole('button', { name: 'Get Premium' }).first().click();
  await page.getByText('Premium', { exact: true }).waitFor({ timeout: 30_000 });
  await page.getByText(/Current plan: monthly .* expires/).waitFor();

  await page.goto(`${baseUrl}/courses/python/lesson/${premiumCompilerLesson}`);
  await page.getByLabel('Lesson content and navigation').waitFor({ timeout: 60_000 });
  await page.locator('.compiler-panel').waitFor();
  const tutorTab = page.getByRole('tab', { name: 'AI Tutor' });
  if (await tutorTab.isVisible()) await tutorTab.click();
  await page.getByRole('button', { name: 'Explain full code' }).waitFor();

  await returnToShell(page);
  await openShellPage(page, 'Projects');
  await page.getByRole('heading', { name: 'Build projects you can keep.' }).waitFor();
  if (await page.getByRole('heading', { name: 'Premium required' }).count()) throw new Error('Projects remained gated after authoritative entitlement refresh.');

  await openShellPage(page, 'Certificates');
  await page.getByRole('heading', { name: 'Credentials for the skills you’ve earned.' }).waitFor();

  process.stdout.write('Local Premium UI smoke passed: Free lesson preview/direct-route lock, Free surfaces/gates, authoritative Monthly grant, Premium compiler/AI, Projects, Certificates, and expiry display.\n');
} finally {
  await browser?.close();
  if (identity?.localId) {
    await fetch(`${authUrl}/accounts:delete?key=local-emulator-key`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: identity.localId }),
    }).catch(() => undefined);
  }
}
