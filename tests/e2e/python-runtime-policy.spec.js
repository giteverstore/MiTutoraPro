import { expect, test } from '@playwright/test';

async function setSource(page, source) {
  const editor = page.locator('.monaco-editor');
  await editor.waitFor({ timeout: 90_000 });
  await editor.click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.insertText(source);
}

async function run(page, source, expectedStatus = 'Success') {
  await setSource(page, source);
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.locator('.standalone-result-status')).toHaveText(expectedStatus, { timeout: 90_000 });
  return page.locator('.standalone-terminal-content').textContent();
}

test.describe('Pyodide capability and state policy @runtime', () => {
  test('starts every run with clean globals, modules, environment, files, stdin, and output', async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto('/__compiler/python');

    expect(await run(page, [
      'import os, sys, types',
      'x = 123',
      'os.environ["YCODERS_RUN_SENTINEL"] = "present"',
      'sys.modules["ycoders_run_sentinel"] = types.ModuleType("ycoders_run_sentinel")',
      'open("/home/pyodide/run-sentinel.txt", "w").write("present")',
      'print("run-one-only")',
    ].join('\n'))).toContain('run-one-only');

    const clean = await run(page, [
      'import os, sys',
      'print("global", "x" in globals())',
      'print("module", "ycoders_run_sentinel" in sys.modules)',
      'print("env", os.environ.get("YCODERS_RUN_SENTINEL"))',
      'print("file", os.path.exists("/home/pyodide/run-sentinel.txt"))',
    ].join('\n'));
    expect(clean).toContain('global False');
    expect(clean).toContain('module False');
    expect(clean).toContain('env None');
    expect(clean).toContain('file False');
    expect(clean).not.toContain('run-one-only');

    await page.getByRole('button', { name: 'Input', exact: true }).click();
    await page.getByRole('textbox', { name: 'Standard input' }).fill('fresh-input\n');
    await page.getByRole('button', { name: 'Close standard input' }).click();
    expect(await run(page, 'print(input())')).toContain('fresh-input');
    expect(await run(page, 'print(input())')).toContain('fresh-input');
  });

  test('denies package, browser-network, and JS bridge imports and recovers after errors/cancellation', async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto('/__compiler/python');

    for (const source of ['import micropip', 'from pyodide.http import pyfetch', 'from js import fetch']) {
      const terminal = await run(page, source, 'Error');
      expect(terminal).toContain('disabled by the YCoders Python runtime policy');
    }

    expect(await run(page, 'raise RuntimeError("expected")', 'Error')).toContain('RuntimeError: expected');
    expect(await run(page, 'print("after-error")')).toContain('after-error');

    await setSource(page, 'while True:\n    pass');
    await page.getByRole('button', { name: 'Run', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible({ timeout: 90_000 });
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(page.locator('.standalone-result-status')).toHaveText('Cancelled', { timeout: 30_000 });
    expect(await run(page, 'print("after-cancel")')).toContain('after-cancel');

    await setSource(page, 'print(input("Policy input: "))');
    await page.getByRole('button', { name: 'Run', exact: true }).click();
    await expect(page.locator('.standalone-result-status')).toHaveText('Waiting for input', { timeout: 90_000 });
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(page.locator('.standalone-result-status')).toHaveText('Cancelled', { timeout: 30_000 });
    expect(await run(page, 'print("after-input-cancel")')).toContain('after-input-cancel');
  });
});
