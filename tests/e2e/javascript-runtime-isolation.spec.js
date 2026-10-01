import { expect, test } from '@playwright/test';

async function openCompiler(page, language = 'javascript') {
  await page.goto(`/__compiler/${language}`);
  await page.locator('.monaco-editor').waitFor({ timeout: 90_000 });
}

async function setSource(page, source) {
  const editor = page.locator('.monaco-editor');
  await editor.click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.insertText(source);
  await page.waitForTimeout(100);
}

async function runToCompletion(page) {
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.locator('.standalone-result-status')).toHaveText('Success', { timeout: 30_000 });
  return page.getByLabel('Program terminal').innerText();
}

test.describe('JavaScript learner Worker capability boundary', () => {
  test('preserves normal JavaScript and TypeScript language behavior', async ({ page }) => {
    await openCompiler(page);
    await setSource(page, `class Total { constructor(values) { this.values = values; } async value() { return this.values.reduce((a, b) => a + b, 0); } }
new Total([2, 3, 5]).value().then((value) => console.log(JSON.stringify({ value, date: new Date(0).getUTCFullYear(), match: /ok/.test('ok') })));`);
    expect(await runToCompletion(page)).toContain('{"value":10,"date":1970,"match":true}');
    await openCompiler(page, 'typescript');
    await setSource(page, 'const values: number[] = [4, 6]; console.log(values.reduce((a, b) => a + b, 0));');
    expect(await runToCompletion(page)).toContain('10');
  });

  test('blocks same-origin and external HTTP plus WebSocket without emitting a request', async ({ page }) => {
    await openCompiler(page);
    const escaped = [];
    page.on('request', (request) => { if (/\/api\/compiler\/(?:isolation-probe|share|feedback)|example\.invalid/.test(request.url())) escaped.push(request.url()); });
    await setSource(page, `const root = console.log.constructor('return globalThis')();
for (const action of [
  () => root.fetch('/api/compiler/isolation-probe'),
  () => root.fetch('/api/compiler/isolation-probe', { method: 'POST', body: '{}' }),
  () => root.fetch('/api/compiler/share', { method: 'POST', body: '{}' }),
  () => root.fetch('/api/compiler/feedback', { method: 'POST', body: '{}' }),
  () => root.fetch('https://example.invalid/isolation-probe'),
  () => new root.WebSocket('wss://example.invalid/isolation-probe')
]) {
  try { action(); } catch (error) { console.log(error.message); }
}`);
    const output = await runToCompletion(page);
    expect(output.match(/Network access is unavailable in this compiler\./g)).toHaveLength(6);
    expect(escaped).toEqual([]);
  });

  test('denies the extended Worker capability inventory while retaining safe language primitives', async ({ page }) => {
    await openCompiler(page);
    await setSource(page, `const root = console.log.constructor('return globalThis')();
const denied = [
  () => new root.EventSource('/events'), () => new root.XMLHttpRequest(), () => new root.WebTransport('https://example.invalid'),
  () => new root.RTCPeerConnection(), () => root.importScripts('/probe.js'), () => root.showOpenFilePicker(),
  () => root.close()
];
for (const probe of denied) { try { probe(); } catch (error) { console.log(error.message); } }
console.log(JSON.stringify({ navigator: typeof root.navigator, location: typeof root.location, crypto: typeof root.crypto, sharedArrayBuffer: typeof root.SharedArrayBuffer, atomics: typeof root.Atomics, window: typeof root.window, document: typeof root.document, ycoders: typeof root.YCoders }));`);
    const output = await runToCompletion(page);
    expect(output.match(/Network access is unavailable in this compiler\./g)).toHaveLength(4);
    expect(output.match(/Cross-context communication is unavailable in this compiler\./g)).toHaveLength(2);
    expect(output.match(/Browser storage is unavailable in this compiler\./g)).toHaveLength(1);
    expect(output).toContain('{"navigator":"object","location":"object","crypto":"object","sharedArrayBuffer":"function","atomics":"object","window":"undefined","document":"undefined","ycoders":"undefined"}');
  });

  test('blocks nested execution, storage, and cross-context communication through reflected globals', async ({ page }) => {
    await openCompiler(page);
    await setSource(page, `const root = console.log.constructor('return globalThis')();
const probes = [() => new root.Worker('data:text/javascript,postMessage(1)'), () => new root.SharedWorker('data:text/javascript,postMessage(1)'), () => root.indexedDB.open('probe'), () => root.caches.open('probe'), () => new root.BroadcastChannel('probe'), () => new root.MessageChannel(), () => root.postMessage({ type: 'forged' })];
for (const probe of probes) { try { probe(); } catch (error) { console.log(error.message); } }`);
    const output = await runToCompletion(page);
    expect(output.match(/Cross-context communication is unavailable in this compiler\./g)).toHaveLength(5);
    expect(output.match(/Browser storage is unavailable in this compiler\./g)).toHaveLength(2);
  });

  test('blocks remote dynamic import at the Worker response policy', async ({ page }) => {
    await openCompiler(page);
    const escaped = [];
    page.on('request', (request) => { if (request.url().includes('example.invalid')) escaped.push(request.url()); });
    await setSource(page, "return import('https://example.invalid/isolation-probe.js');");
    await page.getByRole('button', { name: 'Run', exact: true }).click();
    await expect(page.locator('.standalone-result-status')).toHaveText('Error', { timeout: 30_000 });
    await page.getByRole('tab', { name: /Errors/ }).click();
    await expect(page.locator('.standalone-terminal-content pre')).toContainText('Network access is unavailable in this compiler.');
    expect(escaped).toEqual([]);
  });

  test('preserves interactive stdin and cancellation', async ({ page }) => {
    await openCompiler(page);
    await setSource(page, 'console.log(readLine().toUpperCase());');
    await page.getByRole('button', { name: 'Run', exact: true }).click();
    const input = page.getByLabel('Program input');
    await input.waitFor({ timeout: 30_000 });
    await input.fill('safe');
    await input.press('Enter');
    await expect(page.locator('.standalone-result-status')).toHaveText('Success', { timeout: 30_000 });
    await expect(page.getByLabel('Program terminal')).toContainText('SAFE');
    await setSource(page, 'while (true) {}');
    await page.getByRole('button', { name: 'Run', exact: true }).click();
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(page.locator('.standalone-result-status')).toHaveText('Cancelled', { timeout: 30_000 });
    await setSource(page, 'console.log("recovered")');
    expect(await runToCompletion(page)).toContain('recovered');
  });

  test('stops hostile stdout at the shared byte limit and recovers', async ({ page }) => {
    await openCompiler(page);
    await setSource(page, 'console.log("x".repeat(2 * 1024 * 1024 + 1));');
    await page.getByRole('button', { name: 'Run', exact: true }).click();
    await expect(page.locator('.standalone-result-status')).toHaveText('Error', { timeout: 30_000 });
    await page.getByRole('tab', { name: /Errors/ }).click();
    await expect(page.locator('.standalone-terminal-content pre')).toContainText('Program stopped because it produced too much output.');
    await setSource(page, 'console.log("recovered-after-output-limit")');
    expect(await runToCompletion(page)).toContain('recovered-after-output-limit');
  });
});
