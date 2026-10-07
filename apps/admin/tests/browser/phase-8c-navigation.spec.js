import { expect, test } from '@playwright/test';

test('Dashboard navigates across Projects, Courses and Practice without editor collisions', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/tests/browser/index.html?mode=dashboard');
  await expect(page.getByRole('main').getByRole('heading', { name: /Dashboard|Content Studio/i }).first()).toBeVisible();
  for (const [name, heading] of [
    ['Projects', /Projects/i],
    ['Courses', /Courses/i],
    ['Practice', /Practice/i],
  ]) {
    await page.getByRole('complementary', { name: 'Admin navigation' }).getByRole('link', { name, exact: true }).click();
    await expect(page.getByRole('main').getByRole('heading', { name: heading }).first()).toBeVisible();
  }
  await page.getByRole('complementary', { name: 'Admin navigation' }).getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.getByRole('main').getByRole('heading', { name: /Dashboard|Content Studio/i }).first()).toBeVisible();
  expect(errors).toEqual([]);
});
