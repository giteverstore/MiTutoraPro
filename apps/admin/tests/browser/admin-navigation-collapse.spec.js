import { expect, test } from '@playwright/test';

test('desktop Admin navigation collapses, keeps routes active, and restores preference', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/tests/browser/index.html?mode=dashboard');
  const sidebar = page.getByRole('complementary', { name: 'Admin navigation' });
  const main = page.locator('#admin-main');
  const expandedMainWidth = (await main.boundingBox()).width;
  await expect(sidebar.getByText('Y Coders')).toBeVisible();
  const collapse = sidebar.getByRole('button', { name: 'Collapse navigation' });
  await expect(collapse).toHaveAttribute('aria-expanded', 'true');
  await collapse.click();
  await expect(sidebar.getByRole('button', { name: 'Expand navigation' })).toHaveAttribute('aria-expanded', 'false');
  await expect(sidebar.getByText('Y Coders')).toBeHidden();
  await expect(sidebar.getByText('Y', { exact: true })).toBeVisible();
  expect((await sidebar.boundingBox()).width).toBe(60);
  expect((await main.boundingBox()).width).toBeGreaterThan(expandedMainWidth + 150);
  await expect(sidebar.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  await expect(sidebar.getByRole('heading', { name: 'Content' })).toBeHidden();

  const courses = sidebar.getByRole('link', { name: 'Courses' });
  await courses.hover();
  await expect(page.getByRole('tooltip')).toHaveText('Courses');
  await page.mouse.move(900, 500);
  await courses.focus();
  await expect(page.getByRole('tooltip')).toHaveText('Courses');
  await courses.click();
  await expect(courses).toHaveAttribute('aria-current', 'page');
  await sidebar.getByRole('link', { name: 'Practice' }).click();
  await expect(sidebar.getByRole('link', { name: 'Practice' })).toHaveAttribute('aria-current', 'page');
  await sidebar.getByRole('link', { name: 'Drafts' }).click();
  await expect(sidebar.getByRole('link', { name: 'Drafts' })).toHaveAttribute('aria-current', 'page');
  await expect(sidebar.getByRole('button', { name: 'Expand navigation' })).toBeVisible();
  await page.reload();
  await expect(sidebar.getByRole('button', { name: 'Expand navigation' })).toBeVisible();
  const expand = sidebar.getByRole('button', { name: 'Expand navigation' });
  await expand.focus();
  await page.keyboard.press('Enter');
  await expect(sidebar.getByText('Y Coders')).toBeVisible();
  await expect(sidebar.getByRole('button', { name: 'Collapse navigation' })).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Space');
  await expect(sidebar.getByRole('button', { name: 'Expand navigation' })).toBeVisible();
});

test('main Admin rail and Course Studio structure rail stay independent', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/tests/browser/index.html?mode=courses');
  const sidebar = page.getByRole('complementary', { name: 'Admin navigation' });
  const lesson = page.getByRole('navigation', { name: 'Course structure' }).getByRole('button', { name: /Untitled lesson/ }).first();
  await lesson.click();
  await page.getByRole('toolbar', { name: 'Insert blocks' }).getByRole('button', { name: 'Add Paragraph block' }).click();
  const selectedBlock = page.getByRole('region', { name: 'Document canvas' }).getByRole('article', { name: 'paragraph block' }).last();
  await expect(selectedBlock).toHaveAttribute('aria-current', 'true');
  const before = (await page.locator('.studio-main-canvas').boundingBox()).width;
  await sidebar.getByRole('button', { name: 'Collapse navigation' }).click();
  expect((await page.locator('.studio-main-canvas').boundingBox()).width).toBeGreaterThan(before + 100);
  await expect(lesson).toHaveClass(/active/);
  await expect(selectedBlock).toHaveAttribute('aria-current', 'true');
  await page.getByRole('button', { name: 'Collapse structure sidebar' }).click();
  await expect(page.locator('#studio-structure-content')).toHaveAttribute('aria-hidden', 'true');
  await expect(sidebar.getByRole('button', { name: 'Expand navigation' })).toBeVisible();
  await page.getByRole('button', { name: 'Expand structure sidebar' }).click();
  await expect(selectedBlock).toHaveAttribute('aria-current', 'true');

  page.on('dialog', (dialog) => dialog.accept());
  for (const [name, newButton] of [['Projects', 'New Project'], ['Practice', 'New Practice Question']]) {
    await sidebar.getByRole('link', { name }).click();
    await expect(page.getByRole('main').getByRole('heading', { name, exact: true }).first()).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'Expand navigation' })).toBeVisible();
    await page.getByRole('button', { name: newButton }).click();
    await expect(page.getByRole('toolbar', { name: 'Insert blocks' })).toBeVisible();
    await expect(page.locator('.studio-main-canvas')).toBeVisible();
  }
});

for (const viewport of [{ width: 760, height: 820 }, { width: 390, height: 844 }]) {
  test(`Admin navigation remains a full-label drawer at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/tests/browser/index.html?mode=dashboard');
    await page.evaluate(() => localStorage.setItem('ycoders.admin.navigation-collapsed.v1', 'true'));
    await page.reload();
    const sidebar = page.getByRole('complementary', { name: 'Admin navigation' });
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(sidebar.getByRole('link', { name: 'Courses' })).toBeVisible();
    await expect(sidebar.getByText('Y Coders')).toBeVisible();
    await expect(sidebar.getByRole('button', { name: 'Expand navigation' })).toBeHidden();
    await sidebar.getByRole('link', { name: 'Courses' }).click();
    await expect(page.locator('.admin-navigation-scrim')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  });
}
