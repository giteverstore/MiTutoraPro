import { chromium } from 'playwright';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const base = process.env.COMPILER_PUBLIC_HTTP_BASE || 'http://127.0.0.1:13000';
const projectId = process.env.FIREBASE_PROJECT_ID || 'demo-compiler-public-http';
const app = initializeApp({ projectId }, `compiler-browser-${Date.now()}`);
const db = getFirestore(app);
const assert = (value, message) => { if (!value) throw new Error(message); };
const clear = async (name) => { const snapshot = await db.collection(name).get(); for (let i = 0; i < snapshot.size; i += 400) { const batch = db.batch(); snapshot.docs.slice(i, i + 400).forEach((doc) => batch.delete(doc.ref)); await batch.commit(); } };
const waitForCompiler = async (page) => { await page.locator('.monaco-editor').waitFor({ timeout: 90000 }); await page.getByRole('button', { name: 'Share' }).waitFor(); };
const setSource = async (page, source) => { const editor = page.locator('.monaco-editor'); await editor.click(); await page.keyboard.press('Control+A'); await page.keyboard.insertText(source); };
const sourceText = async (page) => (await page.locator('.view-lines').first().innerText()).replace(/\u00a0/g, ' ');
const shareIdFromUrl = (url) => new URL(url).pathname.split('/').filter(Boolean).at(-1);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const results = {};

try {
  await Promise.all(['compilerShares', 'compilerFeedback', 'compilerPublicRateLimits'].map(clear));
  await page.goto(`${base}/__compiler/javascript`, { waitUntil: 'commit', timeout: 15000 });
  await waitForCompiler(page);
  results.load = { language: await page.getByRole('button', { name: 'JavaScript' }).isVisible(), share: await page.getByRole('button', { name: 'Share' }).isVisible(), feedback: await page.getByRole('button', { name: 'Feedback' }).isVisible(), appShellAbsent: await page.locator('.app-shell').count() === 0 };
  assert(Object.values(results.load).every(Boolean), 'standalone load');
  console.log('browser-e2e: standalone loaded');

  const firstSource = 'console.log("shared without stdin")';
  await setSource(page, firstSource);
  await page.getByRole('button', { name: 'Share' }).click();
  await page.getByRole('button', { name: 'Create link' }).click();
  const firstUrl = await page.getByLabel('Share link').inputValue();
  const firstId = shareIdFromUrl(firstUrl);
  const firstStored = (await db.collection('compilerShares').doc(firstId).get()).data();
  assert(firstStored.source === firstSource && firstStored.stdinIncluded === false && firstStored.stdin === null, 'share without stdin');
  results.withoutStdin = { url: firstUrl, sourceExact: true, stdinIncluded: firstStored.stdinIncluded };
  console.log('browser-e2e: share without stdin created');
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('tab', { name: 'Input' }).click();
  await page.getByLabel('Standard input').fill('alpha\nbeta');
  const secondSource = 'console.log("shared with stdin")';
  await setSource(page, secondSource);
  await page.getByRole('button', { name: 'Share' }).click();
  await page.getByLabel('Include standard input (stdin)').check();
  await page.getByRole('button', { name: 'Create link' }).click();
  const secondUrl = await page.getByLabel('Share link').inputValue();
  const secondId = shareIdFromUrl(secondUrl);
  const originalStored = (await db.collection('compilerShares').doc(secondId).get()).data();
  assert(originalStored.source === secondSource && originalStored.stdinIncluded === true && originalStored.stdin === 'alpha\nbeta', 'share with stdin');
  results.withStdin = { url: secondUrl, sourceExact: true, stdinExact: true };
  console.log('browser-e2e: share with stdin created');

  const shared = await context.newPage();
  await shared.goto(secondUrl, { waitUntil: 'commit', timeout: 15000 });
  await waitForCompiler(shared);
  const restoredSource = await sourceText(shared);
  await shared.getByRole('tab', { name: 'Input' }).click();
  const restoredStdin = await shared.getByLabel('Standard input').inputValue();
  const robots = await shared.locator('meta[name="robots"]').getAttribute('content');
  assert(restoredSource.includes('shared with stdin') && restoredStdin === 'alpha\nbeta' && robots === 'noindex, nofollow', 'shared restoration');
  results.sharedPage = { language: await shared.getByRole('button', { name: 'JavaScript' }).isVisible(), sourceRestored: true, stdinRestored: true, robots };
  console.log('browser-e2e: shared page restored');

  await setSource(shared, 'console.log("browser execution")');
  await shared.getByRole('button', { name: 'Run' }).click();
  await shared.getByRole('tab', { name: 'Output' }).click();
  await shared.getByText('browser execution', { exact: true }).waitFor({ timeout: 30000 });
  await setSource(shared, 'console.log("edited execution")');
  await shared.getByRole('button', { name: 'Run' }).click();
  await shared.getByText('edited execution', { exact: true }).waitFor({ timeout: 30000 });
  const unchanged = (await db.collection('compilerShares').doc(secondId).get()).data();
  assert(unchanged.source === originalStored.source && unchanged.stdin === originalStored.stdin, 'immutable stored snapshot');
  results.execution = { firstOutput: 'browser execution', editedOutput: 'edited execution', snapshotUnchanged: true };
  console.log('browser-e2e: shared execution passed');

  await shared.getByRole('button', { name: 'Open in Compiler' }).click();
  await shared.waitForURL(/\/__compiler\/javascript$/);
  await waitForCompiler(shared);
  results.openInCompiler = { canonicalRoute: shared.url().endsWith('/__compiler/javascript'), resetsToStarter: (await sourceText(shared)).includes('Hello, World!') };
  assert(results.openInCompiler.canonicalRoute && results.openInCompiler.resetsToStarter, 'Open in Compiler behavior');
  console.log('browser-e2e: open in compiler passed');

  await clear('compilerPublicRateLimits');
  await shared.getByRole('button', { name: 'Feedback' }).click();
  const feedbackText = 'Browser feedback acceptance evidence';
  await shared.getByLabel('Description').fill(feedbackText);
  await shared.getByRole('button', { name: 'Send', exact: true }).click();
  await shared.getByText(/your feedback was sent/i).waitFor();
  assert(await shared.getByLabel('Description').inputValue() === '', 'feedback clears');
  const feedbackSnapshot = await db.collection('compilerFeedback').where('description', '==', feedbackText).get();
  assert(feedbackSnapshot.size === 1, 'feedback stored');
  const feedbackSerialized = JSON.stringify(feedbackSnapshot.docs[0].data());
  assert(!/browser execution|edited execution|alpha|beta/.test(feedbackSerialized), 'feedback excludes code and stdin');
  results.feedback = { success: true, textareaCleared: true, stored: true, privateContentAbsent: true };
  console.log('browser-e2e: feedback passed');

  results.clientFirestoreDenial = await shared.evaluate(async () => {
    try {
      const { BaseRepository } = await import('/src/repositories/firestore/BaseRepository.js');
      const repository = new BaseRepository('compilerShares', { toFirestore: (value) => value, fromFirestore: (snapshot) => snapshot.data() });
      await repository.get('AAAAAAAAAAAAAAAAAAAAAA');
      return { denied: false };
    } catch (error) { return { denied: /permission|denied/i.test(String(error?.code || error?.message)), code: String(error?.code || ''), message: String(error?.message || '') }; }
  });
  assert(results.clientFirestoreDenial.denied, 'client Firestore denial');
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
  await deleteApp(app);
}
