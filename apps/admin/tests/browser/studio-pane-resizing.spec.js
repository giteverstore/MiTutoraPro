import { expect, test } from '@playwright/test';

test('shared Admin studio panes resize by pointer and keyboard without changing content', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/tests/browser/index.html?mode=courses');
  if (await page.locator('.studio-more').getAttribute('open') === null) await page.getByText('More', { exact: true }).click();
  await page.getByRole('button', { name: 'Generated JSON' }).click();
  const before = await page.locator('.content-json-view code').textContent();
  await page.getByRole('button', { name: 'Back to editor' }).click();

  const left = page.getByRole('separator', { name: 'Resize structure pane' });
  const right = page.getByRole('separator', { name: 'Resize properties pane' });
  const structure = page.locator('#studio-structure');
  const properties = page.locator('#studio-properties');
  const originalLeft = (await structure.boundingBox()).width;
  const originalRight = (await properties.boundingBox()).width;
  const leftBounds = await left.boundingBox();
  await page.mouse.move(leftBounds.x + leftBounds.width / 2, leftBounds.y + 80);
  await page.mouse.down();
  await page.mouse.move(leftBounds.x + leftBounds.width / 2 + 65, leftBounds.y + 80, { steps: 5 });
  await page.mouse.up();
  expect((await structure.boundingBox()).width).toBeGreaterThan(originalLeft + 40);

  const rightBounds = await right.boundingBox();
  await page.mouse.move(rightBounds.x + rightBounds.width / 2, rightBounds.y + 80);
  await page.mouse.down();
  await page.mouse.move(rightBounds.x + rightBounds.width / 2 - 55, rightBounds.y + 80, { steps: 5 });
  await page.mouse.up();
  expect((await properties.boundingBox()).width).toBeGreaterThan(originalRight + 35);

  await left.focus();
  await page.keyboard.press('Home');
  await expect(left).toHaveAttribute('aria-valuenow', '192');
  await page.keyboard.press('End');
  const max = Number(await left.getAttribute('aria-valuemax'));
  expect(Number(await left.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(max);
  await right.focus();
  await page.keyboard.press('End');
  expect(Number(await right.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(Number(await right.getAttribute('aria-valuemax')));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  if (await page.locator('.studio-more').getAttribute('open') === null) await page.getByText('More', { exact: true }).click();
  await page.getByRole('button', { name: 'Generated JSON' }).click();
  expect(await page.locator('.content-json-view code').textContent()).toBe(before);

  await page.setViewportSize({ width: 760, height: 820 });
  await page.getByRole('button', { name: 'Back to editor' }).click();
  await expect(left).toBeHidden();
  await expect(right).toBeHidden();
});
