import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startBrowserRuntimeServer } from './browser-runtime-harness.mjs';

const { server, baseUrl } = await startBrowserRuntimeServer();

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
  await page.getByRole('button', { name: 'Input' }).click();
  await page.getByRole('textbox', { name: 'Standard input' }).fill(stdin);
  await page.getByRole('button', { name: 'Close standard input' }).click();
}

async function runAndRead(expectedStatus = 'Success', timeout = 120_000) {
  await page.getByRole('button', { name: 'Run' }).click();
  try {
    await page.locator('.standalone-result-status', { hasText: expectedStatus }).waitFor({ timeout });
  } catch (error) {
    console.log(`run-status: ${await page.locator('.standalone-result-status').textContent()}`);
    console.log(`run-panel: ${await page.locator('.standalone-terminal-content').textContent()}`);
    throw error;
  }
  await page.getByRole('tab', { name: expectedStatus === 'Success' ? 'Output' : 'Errors' }).click();
  return (await page.locator('.standalone-terminal-content').textContent()).trimEnd();
}

async function waitForInteractiveInput(timeout = 120_000) {
  try {
    await page.locator('.standalone-result-status', { hasText: 'Waiting for input' }).waitFor({ timeout });
  } catch (error) {
    console.log(`interactive-status: ${await page.locator('.standalone-result-status').textContent()}`);
    console.log(`interactive-panel: ${await page.locator('.standalone-terminal-content').textContent()}`);
    throw error;
  }
  return page.getByLabel('Program input');
}

async function submitInteractive(value) {
  const composer = await waitForInteractiveInput();
  await composer.fill(value);
  await composer.press('Enter');
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

async function interactiveLoopSmoke({ slug, label, source }) {
  await openLanguage(slug, label);
  assert.equal(await page.getByRole('tab', { name: 'Input' }).count(), 0);
  await setSource(label, source);
  await setStdin('');
  await page.getByRole('button', { name: 'Run' }).click();
  await submitInteractive('one');
  await submitInteractive('two');
  await submitInteractive('quit');
  await page.locator('.standalone-result-status', { hasText: 'Success' }).waitFor({ timeout: 120_000 });
  await page.getByRole('tab', { name: 'Output' }).click();
  const transcript = await page.locator('.standalone-terminal-content').textContent();
  assert.match(transcript, /one/);
  assert.match(transcript, /two/);
  assert.match(transcript, /quit/);
}

async function interactiveCancelSmoke({ slug, label, waitingSource, recoverySource, recoveryOutput }) {
  await openLanguage(slug, label);
  await setSource(label, waitingSource);
  await setStdin('');
  await page.getByRole('button', { name: 'Run' }).click();
  await waitForInteractiveInput();
  await page.getByRole('button', { name: 'Stop' }).click();
  await page.locator('.standalone-result-status', { hasText: 'Cancelled' }).waitFor();
  await setSource(label, recoverySource);
  assert.match(await runAndRead(), recoveryOutput);
}

async function bufferedInteractiveSmoke({ slug, label, source }) {
  await openLanguage(slug, label);
  await setSource(label, source);
  await setStdin('10');
  await page.getByRole('button', { name: 'Run' }).click();
  await submitInteractive('20');
  await page.locator('.standalone-result-status', { hasText: 'Success' }).waitFor({ timeout: 120_000 });
  await page.getByRole('tab', { name: 'Output' }).click();
  assert.match(await page.locator('.standalone-terminal-content').textContent(), /10 20/);
}

const results = {};
try {
  await openLanguage('python', 'Python');
  assert.equal(await page.getByRole('tab', { name: 'Input' }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Input' }).getAttribute('aria-expanded'), 'false');
  assert.equal(await page.evaluate(() => crossOriginIsolated), true, 'Standalone dev host must be cross-origin isolated.');
  await setSource('Python', 'value = input("Enter value: ")\nprint(value)');
  await setStdin('');
  await page.getByRole('button', { name: 'Run' }).click();
  await waitForInteractiveInput();
  await page.getByRole('tab', { name: 'Output' }).click();
  assert.match(await page.locator('.standalone-terminal-content').textContent(), /Enter value:/);
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
  assert.match(await page.locator('.standalone-terminal-content').textContent(), /First:\s*10\s*Second:\s*20\s*10 20/);
  record('pythonInteractiveMultipleReads');

  await setSource('Python', 'value = input("Edit: ")\nprint(value)');
  await setStdin('');
  await page.getByRole('button', { name: 'Run' }).click();
  const editableInput = await waitForInteractiveInput();
  await editableInput.fill('123');
  await editableInput.press('Backspace');
  await editableInput.press('Backspace');
  assert.equal(await editableInput.inputValue(), '1');
  assert.match(await page.locator('.standalone-terminal-content').textContent(), /Edit:/);
  await editableInput.press('Enter');
  await page.locator('.standalone-result-status', { hasText: 'Success' }).waitFor({ timeout: 120_000 });
  record('pythonInlineBackspace');

  await setSource('Python', 'a = input("First: ")\nb = input("Second: ")\nprint(a, b)');
  await setStdin('10');
  await page.getByRole('button', { name: 'Run' }).click();
  await submitInteractive('20');
  await page.locator('.standalone-result-status', { hasText: 'Success' }).waitFor({ timeout: 120_000 });
  await page.getByRole('tab', { name: 'Output' }).click();
  assert.match(await page.locator('.standalone-terminal-content').textContent(), /First:\s*Second:\s*20\s*10 20/);
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
  assert.match(loopOutput, /> quit/);
  record('pythonInteractiveLoop');

  await setSource('Python', 'value = input("Cancel: ")\nprint(value)');
  await setStdin('');
  await page.getByRole('button', { name: 'Run' }).click();
  await waitForInteractiveInput();
  await page.getByRole('button', { name: 'Stop' }).click();
  await page.locator('.standalone-result-status', { hasText: 'Cancelled' }).waitFor();
  assert.equal(await page.getByLabel('Program input').count(), 0);
  await setSource('Python', 'print("recovered")');
  assert.equal(await runAndRead(), 'recovered');
  record('pythonInteractiveCancelRecovery');

  await interactiveLoopSmoke({
    slug: 'javascript',
    label: 'JavaScript',
    source: 'while (true) { const value = readLine(); if (value === "quit") break; console.log(value); }',
  });
  await interactiveCancelSmoke({ slug: 'javascript', label: 'JavaScript', waitingSource: 'readLine();', recoverySource: 'console.log("js recovered");', recoveryOutput: /js recovered/ });
  await bufferedInteractiveSmoke({ slug: 'javascript', label: 'JavaScript', source: 'const a = readLine(); const b = readLine(); console.log(a, b);' });
  record('javascriptInteractiveLoop');

  await interactiveLoopSmoke({
    slug: 'typescript',
    label: 'TypeScript',
    source: 'while (true) { const value: string = readLine(); if (value === "quit") break; console.log(value); }',
  });
  await interactiveCancelSmoke({ slug: 'typescript', label: 'TypeScript', waitingSource: 'const value: string = readLine();', recoverySource: 'console.log("ts recovered");', recoveryOutput: /ts recovered/ });
  await bufferedInteractiveSmoke({ slug: 'typescript', label: 'TypeScript', source: 'const a: string = readLine(); const b: string = readLine(); console.log(a, b);' });
  record('typescriptInteractiveLoop');
  await smoke({
    slug: 'java',
    label: 'Java',
    source: 'import java.util.Scanner;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner scanner = new Scanner(System.in);\n    System.out.println(scanner.nextLine());\n  }\n}',
    stdin: 'buffered java input',
    expected: /buffered java input/,
    timeout: 180_000,
  });
  assert.equal(await page.getByRole('tab', { name: 'Input' }).count(), 0);
  record('javaBufferedStdinDrawer');

  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
  await server.close();
}
