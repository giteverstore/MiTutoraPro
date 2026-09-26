import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
try {
  await page.goto('http://127.0.0.1:13000/__compiler/mysql', { waitUntil: 'commit', timeout: 15_000 });
  await page.locator('.monaco-editor').waitFor({ timeout: 90_000 });
  const response = page.waitForResponse((value) => value.url().includes('/api/compiler/mysql/public'));
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  const http = await response;
  await page.locator('.database-result-error').waitFor();
  const message = await page.locator('.database-result-error').innerText();
  if (http.status() !== 503 || !/temporarily unavailable/i.test(message) || await page.locator('.app-shell').count()) throw new Error(`disabled gate failed: ${http.status()} ${message}`);
  console.log(JSON.stringify({ pageRendered: true, status: http.status(), message, appShellAbsent: true }));
} finally { await browser.close(); }
