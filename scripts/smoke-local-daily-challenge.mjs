import { randomBytes } from 'node:crypto';
import { chromium } from '@playwright/test';
import { Firestore } from '@google-cloud/firestore';
import { kolkataDate } from '../src/home/challengeCalendar.js';

const PROJECT_ID = 'demo-mitutora-coins';
const expected = {
  FIREBASE_PROJECT_ID: PROJECT_ID,
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
};
for (const [name, value] of Object.entries(expected)) {
  if (process.env[name] !== value) throw new Error(`Daily Challenge smoke requires the pinned local ${name}.`);
}

const today = kolkataDate();
const labelFor = (date) => new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
const shiftDate = (date, days) => { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };
const appBase = process.env.LOCAL_APP_BASE ?? 'http://127.0.0.1:5173';
if (!['http://127.0.0.1:5173', 'http://localhost:5173'].includes(appBase)) {
  throw new Error('Daily Challenge smoke requires the pinned local Vite origin.');
}
const authBase = `http://${expected.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1`;
const nonce = randomBytes(12).toString('hex');
const email = `challenge-smoke-${nonce}@example.test`;
const password = randomBytes(24).toString('base64url');
let identity;
let browser;
let db;

async function runPalindromeCompiler(page, pyodideNetwork, scope) {
  await page.locator('.monaco-editor').waitFor({ state: 'visible', timeout: 30_000 });
  const editor = page.getByRole('textbox', { name: /code editor/i });
  await editor.focus();
  await editor.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.insertText("phrase = input()\nnormalized = ''.join(phrase.lower().split())\nprint(normalized == normalized[::-1])");
  await page.getByRole('button', { name: /Run Code/i }).click();
  const check = page.getByRole('button', { name: 'Check Output' });
  await page.locator('.practice-test-footer .ide-status-dot').filter({ hasText: /Completed|Failed/ })
    .waitFor({ state: 'visible', timeout: 75_000 });
  if (await check.isDisabled()) {
    const terminalState = (await page.locator('.practice-test-footer .ide-status-dot').textContent())?.trim();
    const resultSummary = (await page.locator('.practice-result-summary strong').textContent())?.trim();
    const runtimeError = (await page.locator('.practice-result-values section.is-error code').textContent())?.trim();
    throw new Error(`${scope} compiler did not permit verification: ${terminalState ?? 'unknown'} / ${resultSummary ?? 'unknown'} / ${runtimeError?.slice(0, 240) ?? 'no runtime error'} / network=${JSON.stringify(pyodideNetwork)}.`);
  }
  await check.click();
  await page.getByRole('button', { name: 'Output Verified' }).waitFor({ state: 'visible', timeout: 30_000 });
}

try {
  const created = await fetch(`${authBase}/accounts:signUp?key=local-emulator-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  identity = await created.json();
  if (!created.ok || !identity.localId) throw new Error('Local Auth user creation failed.');

  db = new Firestore({ projectId: PROJECT_ID });
  const assignment = await db.doc(`dailyChallenges/${today}`).get();
  if (!assignment.exists || !assignment.data()?.practiceQuestionId) throw new Error('Today assignment is absent from the emulator.');
  const expectedQuestionId = assignment.data().practiceQuestionId;
  const practice = await db.doc(`practiceQuestions/${expectedQuestionId}`).get();
  if (!practice.exists) throw new Error('Referenced Practice metadata is absent from the emulator.');

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const pyodideNetwork = { status: null, failure: null };
  const firebaseTraffic = { auth: false, firestore: false, storage: false, authStatus: null };
  let fileUrlErrors = 0;
  page.on('console', (message) => { if (message.text().includes('file:///')) fileUrlErrors += 1; });
  page.on('pageerror', (error) => { if (error.message.includes('file:///')) fileUrlErrors += 1; });
  page.on('request', (request) => {
    const url = request.url();
    if (url.startsWith('http://127.0.0.1:9099/')) firebaseTraffic.auth = true;
    if (url.startsWith('http://127.0.0.1:8080/')) firebaseTraffic.firestore = true;
    if (url.startsWith('http://127.0.0.1:9199/')) firebaseTraffic.storage = true;
  });
  page.on('response', (response) => {
    if (response.url().includes('/pyodide/v') && response.url().endsWith('/pyodide.mjs')) pyodideNetwork.status = response.status();
    if (response.url().startsWith('http://127.0.0.1:9099/')) firebaseTraffic.authStatus = response.status();
  });
  page.on('requestfailed', (request) => {
    if (request.url().includes('/pyodide/v') && request.url().endsWith('/pyodide.mjs')) pyodideNetwork.failure = request.failure()?.errorText ?? 'request-failed';
  });
  await page.goto(`${appBase}/challenges`, { waitUntil: 'domcontentloaded' });
  const runtimeTarget = await page.evaluate(async () => {
    const [{ app, useFirebaseEmulators }, { auth }, { db }, { storage }] = await Promise.all([
      import('/src/firebase/firebase.js'), import('/src/firebase/auth.js'), import('/src/firebase/firestore.js'), import('/src/firebase/storage.js'),
    ]);
    return {
      projectId: app.options.projectId,
      emulatorMode: useFirebaseEmulators,
      authHost: auth.emulatorConfig?.host ?? null,
      firestoreHost: db._settings?.host ?? null,
      storageHost: storage._host ?? storage.host ?? null,
    };
  });
  if (runtimeTarget.projectId !== PROJECT_ID || !runtimeTarget.emulatorMode) {
    throw new Error(`Normal Vite Firebase target is unsafe: ${JSON.stringify(runtimeTarget)}.`);
  }
  await page.locator('form.auth-form').waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: /^Sign in/ }).click();
  try {
    await page.getByRole('button', { name: 'Home', exact: true }).waitFor({ state: 'visible', timeout: 30_000 });
  } catch {
    const authMessage = (await page.locator('[role="alert"], .auth-error').first().textContent().catch(() => null))?.trim();
    throw new Error(`Browser authentication did not publish the user: target=${JSON.stringify(runtimeTarget)} / status=${firebaseTraffic.authStatus ?? 'none'} / ${authMessage?.slice(0, 160) ?? 'no bounded UI error'}.`);
  }

  await page.goto(`${appBase}/practice/practice-palindrome`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Palindrome Check' }).waitFor({ state: 'visible', timeout: 30_000 });
  await runPalindromeCompiler(page, pyodideNetwork, 'Practice');
  await page.goto(`${appBase}/challenges`, { waitUntil: 'domcontentloaded' });
  const start = page.getByRole('button', { name: /Start Today.s Challenge/ });
  await start.waitFor({ state: 'visible', timeout: 30_000 });
  const hubTitle = await page.locator('#today-challenge-title').textContent();
  if (!hubTitle || hubTitle === "Today's challenge") throw new Error('Hub did not resolve canonical Practice content.');
  await start.click();
  await page.waitForURL(`**/challenges/daily/${today}`);
  if ((await page.locator('.practice-detail-header h1').textContent()) !== hubTitle) throw new Error('Hub and workspace question identities differ.');
  await page.getByRole('heading', { name: /Example/ }).waitFor();
  const constraintsPresent = await page.locator('.practice-constraints').isVisible();
  const hintsPresent = await page.getByRole('heading', { name: 'Hints' }).isVisible();
  await runPalindromeCompiler(page, pyodideNetwork, 'Challenge');
  const save = page.getByRole('button', { name: 'Save Completion' });
  await save.waitFor({ state: 'visible', timeout: 30_000 });
  await save.click();
  await page.getByRole('button', { name: 'Completed', exact: true }).waitFor({ state: 'visible', timeout: 30_000 });
  const completionDialog = page.getByRole('dialog', { name: 'Daily Challenge Completed!' });
  await completionDialog.waitFor({ state: 'visible', timeout: 30_000 });
  if (!(await completionDialog.getByText(hubTitle, { exact: true }).isVisible())
    || !(await completionDialog.getByText('+20', { exact: true }).isVisible())
    || !(await completionDialog.getByText('1', { exact: true }).isVisible())) {
    throw new Error('Completion dialog did not use the canonical challenge, reward, and streak response.');
  }
  await page.getByLabel("1 day streak. Today's Daily Challenge completed.").waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByRole('button', { name: "Challenges — today's challenge completed" }).waitFor({ state: 'visible', timeout: 30_000 });
  await completionDialog.getByRole('button', { name: 'Close' }).click();
  await completionDialog.waitFor({ state: 'hidden', timeout: 30_000 });
  await page.getByRole('button', { name: 'Back to Challenges' }).click();
  await page.getByRole('button', { name: 'Review Challenge' }).waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByRole('button', { name: 'Review Challenge' }).click();
  await page.getByText('Review mode').waitFor({ state: 'visible', timeout: 30_000 });
  if (await page.getByRole('dialog', { name: 'Daily Challenge Completed!' }).isVisible()) throw new Error('Review reopened the completion dialog.');
  if (!(await page.getByRole('button', { name: 'Completed', exact: true }).isDisabled())) throw new Error('Review mode exposed completion.');
  await page.getByRole('button', { name: 'Back to Challenges' }).click();
  await page.getByText('Missed').first().waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  const todayCell = page.getByRole('gridcell', { name: `${labelFor(today)}, Daily Challenge completed` });
  const missedCell = page.getByRole('gridcell', { name: `${labelFor(shiftDate(today, -1))}, Daily Challenge missed` });
  const futureCell = page.getByRole('gridcell', { name: `${labelFor(shiftDate(today, 1))}, future day` });
  await todayCell.waitFor({ state: 'visible', timeout: 30_000 });
  if ((await todayCell.textContent())?.trim() !== '✓' || await todayCell.isDisabled() || !(await missedCell.isDisabled()) || !(await futureCell.isDisabled())) {
    throw new Error('Home calendar interaction policy does not match the challenge occurrence states.');
  }

  const [completions, transactions] = await Promise.all([
    db.collection(`users/${identity.localId}/activityCompletions`).get(),
    db.collection(`users/${identity.localId}/coinTransactions`).get(),
  ]);
  const daily = completions.docs.filter((item) => item.data().activityType === 'DAILY_CHALLENGE');
  const practiceCompletions = completions.docs.filter((item) => item.data().activityType === 'PRACTICE');
  const rewardTransactions = transactions.docs.filter((item) => item.data().sourceType === 'DAILY_CHALLENGE');
  if (daily.length !== 1 || daily[0].data().occurrenceDate !== today || practiceCompletions.length !== 0
    || rewardTransactions.length !== 1 || rewardTransactions[0].data().amount !== 20) {
    throw new Error('Canonical completion, reward, or Practice-separation invariant failed.');
  }

  process.stdout.write(`${JSON.stringify({
    project: PROJECT_ID, today, assignmentId: assignment.id, practiceQuestionId: expectedQuestionId,
    title: hubTitle, difficulty: practice.data().difficulty, hubAvailable: true,
    constraintsPresent, hintsPresent,
    route: `/challenges/daily/${today}`, practiceRun: 'passed', practiceCheckOutput: 'passed', run: 'passed', checkOutput: 'passed',
    completionCount: daily.length, rewardCoins: 20, practiceCompletionCount: practiceCompletions.length,
    popup: true, popupStreak: 1, activeFlame: true, challengeNavigationComplete: true,
    hubCompleted: true, reviewMode: true, reviewPopup: false, historyMissed: true,
    calendarTodayReviewable: true, calendarMissedDisabled: true, calendarFutureDisabled: true,
    runtimeTarget, firebaseTraffic, fileUrlErrors,
  })}\n`);
} finally {
  if (browser) await browser.close();
  if (db) await db.terminate();
  if (identity?.localId) {
    await fetch(`${authBase}/accounts:delete?key=local-emulator-key`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: identity.localId }),
    }).catch(() => {});
  }
}
