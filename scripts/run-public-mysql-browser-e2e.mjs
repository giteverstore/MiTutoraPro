import { chromium } from 'playwright';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const base = process.env.COMPILER_PUBLIC_HTTP_BASE || 'http://127.0.0.1:13000';
const assert = (value, message) => { if (!value) throw new Error(message); };
const browser = await chromium.launch({ headless: true });
const firebaseApp = initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-public-mysql-e2e' }, `mysql-browser-${Date.now()}`);
const db = getFirestore(firebaseApp);
const page = await browser.newPage();
const results = {};
const browserDiagnostics = [];
page.on('console', (message) => { if (message.type() === 'error') browserDiagnostics.push(`console: ${message.text()}`); });
page.on('pageerror', (error) => browserDiagnostics.push(`pageerror: ${error.message}`));
page.on('requestfailed', (request) => browserDiagnostics.push(`requestfailed: ${request.url()} ${request.failure()?.errorText ?? ''}`));
const waitForEditor = async () => page.locator('.monaco-editor').waitFor({ timeout: 90_000 });
const setSource = async (source) => { const editor = page.locator('.monaco-editor'); await editor.click(); await page.keyboard.press('Control+A'); await page.keyboard.insertText(source); };
const run = async ({ allowTimeoutAbort = false } = {}) => {
  const response = page.waitForResponse((value) => value.url().includes('/api/compiler/mysql/public'), { timeout: 25_000 });
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  try { await response; } catch (error) {
    const rendered = await page.locator('.database-result-panel').innerText().catch(() => 'no result panel');
    if (allowTimeoutAbort && /timed out/i.test(rendered)) return;
    throw new Error(`${error.message}; rendered=${rendered}; diagnostics=${browserDiagnostics.join(' | ')}`);
  }
  await page.getByRole('button', { name: 'Run', exact: true }).waitFor({ state: 'visible', timeout: 5_000 });
};

try {
  const quota = await db.collection('compilerPublicMysqlRateLimits').get();
  if (!quota.empty) { const batch = db.batch(); quota.docs.forEach((document) => batch.delete(document.ref)); await batch.commit(); }
  await db.doc('compilerPublicMysqlRuntime/global').delete().catch(() => undefined);
  await page.goto(`${base}/__compiler/mysql`, { waitUntil: 'commit', timeout: 15_000 });
  await waitForEditor();
  results.load = {
    mysqlSelected: await page.getByRole('button', { name: /MySQL/ }).first().isVisible(),
    runVisible: await page.getByRole('button', { name: 'Run', exact: true }).isVisible(),
    appShellAbsent: await page.locator('.app-shell').count() === 0,
    file: await page.getByText('query.sql', { exact: true }).isVisible(),
  };
  assert(Object.values(results.load).every(Boolean), `load ${JSON.stringify(results.load)}`);

  await setSource("CREATE TABLE users (id INT PRIMARY KEY, name VARCHAR(100));\nINSERT INTO users VALUES (1, 'Alice'), (2, 'Bob');\nSELECT * FROM users ORDER BY id;");
  await run();
  const resultsPanel = page.locator('.database-results-content');
  await resultsPanel.getByText('Alice', { exact: true }).waitFor();
  assert(await resultsPanel.getByText('Bob', { exact: true }).isVisible() && await resultsPanel.getByRole('columnheader', { name: 'id' }).isVisible() && await resultsPanel.getByRole('columnheader', { name: 'name' }).isVisible(), 'structured result');
  results.success = { columns: ['id', 'name'], rows: [['1', 'Alice'], ['2', 'Bob']], affectedRowsVisible: (await page.locator('.database-result-panel').innerText()).includes('Completed') };

  await setSource('SELECT * FROM users;');
  await run();
  const freshError = await page.locator('.database-result-error').innerText();
  assert(/doesn't exist|no such table/i.test(freshError), `fresh sandbox ${freshError}`);
  results.emptySandbox = true;

  await setSource('SELEC 1;');
  await run();
  const sqlError = await page.locator('.database-result-error').innerText();
  assert(/SQL Error/i.test(sqlError) && /syntax/i.test(sqlError) && !/(password|node_modules|127\.0\.0\.1:3307|yc_run_)/i.test(sqlError), `error UX ${sqlError}`);
  results.error = { visible: true, sanitized: true };

  await setSource('SELECT SLEEP(20);');
  await run({ allowTimeoutAbort: true });
  const timeoutError = await page.locator('.database-result-error').innerText();
  assert(/timed out/i.test(timeoutError), `timeout UX ${timeoutError}`);
  await setSource('SELECT 7 AS recovered;');
  await run();
  await resultsPanel.getByText('7', { exact: true }).waitFor();
  results.timeout = { message: timeoutError, recovered: true };

  await page.locator('.standalone-language-trigger').click();
  await page.getByRole('radio', { name: 'JavaScript', exact: true }).click();
  await page.waitForURL(/\/__compiler\/javascript$/);
  await page.goBack();
  await page.waitForURL(/\/__compiler\/mysql$/);
  await page.locator('.standalone-language-trigger').filter({ hasText: 'MySQL' }).waitFor();
  results.routing = { devRoute: true, switchedAwayAndBack: true, canonical: await page.locator('link[rel="canonical"]').getAttribute('href') };
  assert(results.routing.canonical === 'https://compiler.ycoders.com/mysql', 'canonical MySQL route');
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
  await deleteApp(firebaseApp);
}
