import { expect, test } from '@playwright/test';

test('Practice Preview runs real Python and verifies output', async ({ page }) => {
  page.on('pageerror', (error) => console.error('Admin browser error:', error.stack));
  const setCode = async (code) => {
    const editor = page.locator('.admin-practice-preview-editor .view-lines');
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.insertText(code);
  };
  const startedAt = Date.now();
  await page.goto('/tests/browser/index.html?mode=practice');
  await page.getByRole('button', { name: 'Code & Verification' }).click();
  await page.getByLabel('Starter code').fill('print("Hello")');
  await page.getByLabel('Expected output').fill('Hello');
  await page.getByRole('button', { name: 'Preview & Test' }).click();
  const previewReadyAt = Date.now();
  await setCode('print("Wrong")');
  const firstRunAt = Date.now();
  await page.getByRole('button', { name: 'Run code' }).click();
  await expect(page.getByLabel('Execution output')).toHaveValue('Wrong', { timeout: 60_000 });
  const firstOutputAt = Date.now();
  await page.getByRole('button', { name: 'Verify output' }).click();
  await expect(page.getByRole('status')).toHaveText('Output does not match the expected result.');
  const firstVerificationAt = Date.now();
  await setCode('print("Hello")');
  const secondRunAt = Date.now();
  await page.getByRole('button', { name: 'Run code' }).click();
  await expect(page.getByLabel('Execution output')).toHaveValue('Hello', { timeout: 60_000 });
  const secondOutputAt = Date.now();
  await page.getByRole('button', { name: 'Verify output' }).click();
  await expect(page.getByRole('status')).toHaveText('Accepted');
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.locator('.admin-practice-preview-editor .view-lines')).toContainText('print("Hello")');
  console.log(`Practice Preview timings: ready=${previewReadyAt - startedAt}ms first-run=${firstOutputAt - firstRunAt}ms first-verify=${firstVerificationAt - firstOutputAt}ms warm-run=${secondOutputAt - secondRunAt}ms`);
});
