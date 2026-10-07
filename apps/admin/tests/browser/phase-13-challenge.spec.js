import { expect, test } from '@playwright/test';

test('Challenge authoring, preview, reload, and no AI entry point', async ({ page }) => {
  test.setTimeout(120_000);
  page.on('pageerror', (error) => { throw error; });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/tests/browser/index.html?mode=challenges');
  await expect(page.getByRole('heading', { name: 'Untitled Challenge', level: 1 })).toBeVisible();
  await page.getByLabel('Title', { exact: true }).fill('Double a Number');
  await page.getByLabel('Topic', { exact: true }).fill('Arithmetic');
  await page.getByRole('button', { name: 'Code & Verification' }).click();
  await page.getByLabel('Starter code').fill('number = int(input())\nprint(number * 2)');
  await page.getByLabel('Standard input').fill('5');
  await page.getByLabel('Expected output').fill('10');
  await page.getByRole('button', { name: 'Validate Challenge' }).click();
  await expect(page.getByText('Content is valid')).toBeVisible();
  await page.getByRole('button', { name: 'Preview & Test' }).click();
  await expect(page.getByRole('button', { name: 'Run code' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
  await page.getByRole('button', { name: 'Run code' }).click();
  await expect(page.getByLabel('Execution output')).toHaveValue(/10/, { timeout: 60_000 });
  await page.getByRole('button', { name: 'Verify output' }).click();
  await expect(page.getByRole('status')).toHaveText('Accepted');
  await expect(page.getByText('Preview does not persist learner completion.')).toBeVisible();
  await expect(page.getByRole('button', { name: /AI|mentor|tutor/i })).toHaveCount(0);
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Double a Number', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Code & Verification' }).click();
  await expect(page.getByLabel('Starter code')).toHaveValue('number = int(input())\nprint(number * 2)');
});

test('Challenge Studio is responsive and read-only for reviewer', async ({ page }) => {
  page.on('pageerror', (error) => { throw error; });
  for (const viewport of [{ width: 760, height: 820 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/tests/browser/index.html?mode=challenges&role=reviewer');
    await expect(page.getByRole('heading', { name: 'Untitled Challenge', level: 1 })).toBeVisible();
    await expect(page.getByText('Read only')).toBeVisible();
    await page.getByRole('button', { name: 'Properties' }).click();
    await expect(page.getByLabel('Title', { exact: true })).toHaveAttribute('readonly', '');
  }
});
