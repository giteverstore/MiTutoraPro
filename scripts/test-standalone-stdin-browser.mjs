import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const baseUrl = server.resolvedUrls?.local?.[0];
if (!baseUrl) throw new Error('Unable to resolve the local Vite stdin acceptance URL.');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('console', (message) => console.log(`browser:${message.type()}: ${message.text()}`));
page.on('pageerror', (error) => console.log(`browser:pageerror: ${error.message}`));
const record = (name, value = 'passed') => { results[name] = value; console.log(`${name}: ${value}`); };

async function setSource(languageLabel, source) {
  const editor = page.getByLabel(`${languageLabel} source editor`);
  await editor.waitFor({ state: 'visible', timeout: 30_000 });
  await editor.click({ force: true });
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(source);
}

async function setStdin(stdin) {
  await page.getByRole('tab', { name: 'Input' }).click();
  await page.getByLabel('Standard input').fill(stdin);
}

async function runAndRead(expectedStatus = 'Success', timeout = 120_000) {
  await page.getByRole('button', { name: 'Run' }).click();
  await page.locator('.standalone-result-status', { hasText: expectedStatus }).waitFor({ timeout });
  await page.getByRole('tab', { name: expectedStatus === 'Success' ? 'Output' : 'Errors' }).click();
  return page.locator('.standalone-terminal-content').textContent();
}

async function waitForInteractiveInput(timeout = 120_000) {
  try {
    await page.locator('.standalone-result-status', { hasText: 'Waiting for input' }).waitFor({ timeout });
  } catch (error) {
    console.log(`interactive-status: ${await page.locator('.standalone-result-status').textContent()}`);
    console.log(`interactive-panel: ${await page.locator('.standalone-terminal-content').textContent()}`);
    throw error;
  }
  return page.getByLabel('Interactive standard input');
}

async function submitInteractive(value) {
  const composer = await waitForInteractiveInput();
  await composer.fill(value);
  await page.getByRole('button', { name: 'Send' }).click();
}

async function openLanguage(slug, label) {
  await page.goto(`${baseUrl}__compiler/${slug}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.getByLabel(`${label} source editor`).waitFor({ state: 'visible', timeout: 30_000 });
}

async function smoke({ slug, label, source, stdin, expected, timeout }) {
  await openLanguage(slug, label);
  await setSource(label, source);
  await setStdin(stdin);
  const output = await runAndRead('Success', timeout);
  assert.match(output, expected, `${label} did not consume the supplied stdin.`);
  return output;
}

const results = {};
try {
  await openLanguage('python', 'Python');
  assert.equal(await page.evaluate(() => crossOriginIsolated), true, 'Standalone dev host must be cross-origin isolated.');
  await setSource('Python', 'value = input("Enter value: ")\nprint(value)');
  await setStdin('');
  await page.getByRole('button', { name: 'Run' }).click();
  await waitForInteractiveInput();
  await page.getByRole('tab', { name: 'Output' }).click();
  assert.match(await page.locator('.standalone-terminal-content').textContent(), /Enter value:/);
  await page.getByRole('tab', { name: 'Input' }).click();
  await submitInteractive('42');
  await page.locator('.standalone-result-status', { hasText: 'Success' }).waitFor({ timeout: 120_000 });
  await page.getByRole('tab', { name: 'Output' }).click();
  assert.match(await page.locator('.standalone-terminal-content').textContent(), /Enter value:\s*42/);
  record('pythonInteractiveSingleRead');

  await setSource('Python', 'a = input("First: ")\nb = input("Second: ")\nprint(a, b)');
  await setStdin('');
  await page.getByRole('button', { name: 'Run' }).click();
  await submitInteractive('10');
  await submitInteractive('20');
  await page.locator('.standalone-result-status', { hasText: 'Success' }).waitFor({ timeout: 120_000 });
  await page.getByRole('tab', { name: 'Output' }).click();
  assert.match(await page.locator('.standalone-terminal-content').textContent(), /First:\s*Second:\s*10 20/);
  record('pythonInteractiveMultipleReads');

  await setSource('Python', 'a = input("First: ")\nb = input("Second: ")\nprint(a, b)');
  await setStdin('10');
  await page.getByRole('button', { name: 'Run' }).click();
  await submitInteractive('20');
  await page.locator('.standalone-result-status', { hasText: 'Success' }).waitFor({ timeout: 120_000 });
  await page.getByRole('tab', { name: 'Output' }).click();
  assert.match(await page.locator('.standalone-terminal-content').textContent(), /First:\s*Second:\s*10 20/);
  record('pythonBufferedThenInteractive');

  await setSource('Python', 'for value in iter(lambda: input("> "), "quit"): print(value)');
  await setStdin('');
  await page.getByRole('button', { name: 'Run' }).click();
  await submitInteractive('again');
  await submitInteractive('quit');
  await page.locator('.standalone-result-status', { hasText: 'Success' }).waitFor({ timeout: 120_000 });
  await page.getByRole('tab', { name: 'Output' }).click();
  const loopOutput = await page.locator('.standalone-terminal-content').textContent();
  assert.match(loopOutput, /> again/);
  assert.doesNotMatch(loopOutput, /> quit/);
  record('pythonInteractiveLoop');

  await setSource('Python', 'value = input("Cancel: ")\nprint(value)');
  await setStdin('');
  await page.getByRole('button', { name: 'Run' }).click();
  await waitForInteractiveInput();
  await page.getByRole('button', { name: 'Stop' }).click();
  await page.locator('.standalone-result-status', { hasText: 'Cancelled' }).waitFor();
  assert.equal(await page.getByLabel('Interactive standard input').count(), 0);
  await setSource('Python', 'print("recovered")');
  assert.equal(await runAndRead(), 'recovered');
  record('pythonInteractiveCancelRecovery');

  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
  await server.close();
}
