import { expect, test } from '@playwright/test';

test('Course outline keeps flat lessons and converts to canonical sections without losing lesson IDs', async ({ page }) => {
  await page.goto('/tests/browser/index.html?mode=courses');
  const outline = page.getByRole('navigation', { name: 'Course structure' });
  await expect(outline.getByRole('button', { name: 'Course Overview' })).toHaveAttribute('aria-current', 'page');
  await expect(outline.getByRole('button', { name: /1\. Module 1 1 lessons/ })).toBeVisible();
  await expect(outline.getByRole('button', { name: '1. Untitled lesson' })).toBeVisible();
  await outline.getByRole('button', { name: '1. Untitled lesson' }).click();
  const originalLessonId = await page.getByLabel('Stable lesson ID').inputValue();
  await outline.getByRole('button', { name: '+ Add section', exact: true }).click();
  await expect(outline.getByRole('button', { name: 'Section 1 1 items' })).toBeVisible();
  await expect(outline.getByRole('button', { name: 'Section 2 1 items' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByLabel('Properties').getByRole('heading', { name: 'Section 2' })).toBeVisible();
  await expect(outline.getByRole('button', { name: '1. Untitled lesson' })).toHaveCount(2);
  await outline.getByRole('button', { name: '1. Untitled lesson' }).first().click();
  await expect(page.getByLabel('Stable lesson ID')).toHaveValue(originalLessonId);
  await outline.getByRole('button', { name: '+ Add lesson to Section 2' }).click();
  await expect(outline.getByRole('button', { name: 'Section 2 2 items' })).toBeVisible();
  await expect(outline.getByRole('button', { name: 'Actions for Section 2' })).toBeVisible();
  await page.getByRole('button', { name: 'Validate Course' }).click();
  await expect(page.getByText('Content is valid')).toBeVisible();
  await outline.getByRole('button', { name: 'Course Overview' }).click();
  await expect(page.getByRole('heading', { name: 'Course properties' })).toBeVisible();
  await outline.getByRole('button', { name: 'Section 2 2 items' }).click();
  await page.getByLabel('Title', { exact: true }).fill('A very long section title that must stay within the structure sidebar without pushing the actions or creating horizontal overflow');
  await expect.poll(() => outline.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test('Course section actions reorder and delete without leaving a broken default lesson', async ({ page }) => {
  await page.goto('/tests/browser/index.html?mode=courses');
  const outline = page.getByRole('navigation', { name: 'Course structure' });
  await outline.getByRole('button', { name: '+ Add section', exact: true }).click();
  await outline.getByRole('button', { name: 'Actions for Section 2' }).click();
  await page.getByRole('menuitem', { name: 'Move Section 2 up' }).click();
  await expect(outline.locator('.course-outline-section-row .course-outline-title').first()).toHaveText('Section 2');
  await outline.getByRole('button', { name: 'Actions for Section 1' }).click();
  await page.getByRole('menuitem', { name: 'Delete Section 1' }).click();
  await expect(outline.getByRole('button', { name: 'Section 1 1 items' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Validate Course' }).click();
  await expect(page.getByText('Content is valid')).toBeVisible();
});

test('Course structure menus close outside, on Escape, and when another opens', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/tests/browser/index.html?mode=courses');
  const moduleTrigger = page.getByRole('button', { name: 'Actions for Module 1' });
  const lessonTrigger = page.getByRole('button', { name: 'Actions for Untitled lesson' });
  await expect(moduleTrigger).toHaveAttribute('aria-haspopup', 'menu');
  await expect(moduleTrigger).toHaveAttribute('aria-expanded', 'false');
  await moduleTrigger.click();
  await expect(moduleTrigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('menu', { name: 'Actions for Module 1' })).toBeVisible();
  await page.locator('.studio-main-canvas').click({ position: { x: 15, y: 15 } });
  await expect(page.getByRole('menu')).toHaveCount(0);

  await moduleTrigger.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(moduleTrigger).toBeFocused();

  await moduleTrigger.click();
  await lessonTrigger.click();
  await expect(page.getByRole('menu', { name: 'Actions for Module 1' })).toHaveCount(0);
  await expect(page.getByRole('menu', { name: 'Actions for Untitled lesson' })).toBeVisible();
  await page.locator('.studio-main-canvas').click({ position: { x: 15, y: 15 } });
  await expect(page.getByRole('menu')).toHaveCount(0);

  await lessonTrigger.focus();
  await page.keyboard.press('Space');
  await expect(page.getByRole('menu')).toBeVisible();
  await page.getByRole('button', { name: 'Collapse structure sidebar' }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await page.getByRole('button', { name: 'Expand structure sidebar' }).click();

  await page.getByRole('button', { name: '+ Add module' }).click();
  await page.getByRole('button', { name: 'Actions for Module 2' }).click();
  await page.getByRole('menuitem', { name: 'Move Module 2 up' }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Actions for Module 2' })).toBeFocused();
});

test('Course menu stays in the viewport near a scrolled sidebar edge', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/tests/browser/index.html?mode=courses');
  const addLesson = page.getByRole('button', { name: '+ Add lesson' });
  for (let index = 0; index < 18; index += 1) await addLesson.click();
  const trigger = page.getByRole('button', { name: 'Actions for Untitled lesson' }).last();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  const bounds = await menu.boundingBox();
  const anchor = await trigger.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(1440);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(900);
  expect(bounds.y).toBeLessThan(anchor.y);
  await page.locator('#studio-structure-content').evaluate((element) => element.scrollBy(0, -80));
  await expect(page.getByRole('menu')).toHaveCount(0);
});

for (const viewport of [{ width: 760, height: 820 }, { width: 390, height: 844 }]) {
  test(`Course menu works in the ${viewport.width}px structure drawer`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/tests/browser/index.html?mode=courses');
    await page.getByRole('button', { name: 'Course structure' }).click();
    const trigger = page.getByRole('button', { name: 'Actions for Untitled lesson' });
    await trigger.click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    const bounds = await menu.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await page.getByRole('button', { name: 'Close Course structure' }).click();
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(page.locator('#studio-structure')).toBeHidden();
  });
}
