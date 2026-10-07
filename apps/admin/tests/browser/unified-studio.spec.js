import { expect, test } from '@playwright/test';
import { migrateCliTaskManager, migratePracticeBank, migratePythonCourse } from '../../../../scripts/content/migrationCore.mjs';

test('Course Studio top toolbar, compact structure, collapse, and responsive drawers', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/tests/browser/index.html?mode=courses');
  const tree = page.getByRole('navigation', { name: 'Course structure' });
  const toolbar = page.getByRole('toolbar', { name: 'Insert blocks' });
  await expect(toolbar).toBeVisible();
  await expect(page.locator('#studio-structure').getByRole('toolbar')).toHaveCount(0);
  expect((await toolbar.boundingBox()).y).toBeLessThan((await page.locator('.studio-unified-workspace').boundingBox()).y);
  const moduleActions = page.getByLabel('Actions for Module 1');
  await moduleActions.click();
  await expect(page.getByRole('menuitem', { name: 'Move Module 1 down' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitem', { name: 'Move Module 1 down' })).toHaveCount(0);
  await tree.getByRole('button', { name: /Untitled lesson/ }).first().click();
  const canvas = page.getByRole('region', { name: 'Document canvas' });
  await toolbar.getByRole('button', { name: 'Add Paragraph block' }).click();
  await expect(canvas.getByRole('article', { name: 'paragraph block' })).toHaveCount(2);
  await expect(canvas.getByRole('article', { name: 'paragraph block' }).last()).toBeFocused();
  await page.getByRole('textbox', { name: 'Content', exact: true }).fill('A dragged paragraph.');
  await toolbar.getByRole('button', { name: 'Add Code block' }).dragTo(canvas);
  await expect(canvas.getByRole('article', { name: 'code block' })).toHaveCount(1);
  await expect(canvas.getByRole('article', { name: 'code block' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Code', exact: true }).fill('print("dragged")');
  await canvas.getByRole('article', { name: 'code block' }).getByRole('button', { name: 'Move block up' }).click();
  await canvas.getByRole('article', { name: 'code block' }).getByRole('button', { name: 'Move block up' }).click();
  await expect(canvas.getByRole('article').first()).toHaveAttribute('aria-label', 'code block');
  const expandedCanvasWidth = (await page.locator('.studio-main-canvas').boundingBox()).width;
  await page.getByRole('button', { name: 'Collapse structure sidebar' }).click();
  await expect(page.locator('#studio-structure-content')).toHaveAttribute('aria-hidden', 'true');
  expect((await page.locator('.studio-main-canvas').boundingBox()).width).toBeGreaterThan(expandedCanvasWidth);
  await page.getByRole('button', { name: 'Expand structure sidebar' }).click();
  await expect(tree.getByRole('button', { name: /Untitled lesson/ }).first()).toHaveClass(/active/);
  await page.getByRole('button', { name: 'Collapse structure sidebar' }).click();
  await page.waitForTimeout(850);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Expand structure sidebar' })).toBeVisible();
  await page.getByRole('button', { name: 'Expand structure sidebar' }).click();
  await tree.getByRole('button', { name: /Untitled lesson/ }).first().click();
  await expect(canvas.getByRole('article').first()).toHaveAttribute('aria-label', 'code block');

  for (const viewport of [{ width: 760, height: 820 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await expect(toolbar).toBeVisible();
    await expect(page.locator('#studio-structure')).toBeHidden();
    await expect(page.locator('#studio-properties')).toBeHidden();
    await page.getByRole('button', { name: 'Course structure' }).click();
    await expect(page.locator('#studio-structure')).toBeVisible();
    await expect(page.locator('#studio-structure').getByRole('button', { name: 'Add Heading block' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('#studio-structure')).toBeHidden();
    await toolbar.getByRole('button', { name: 'Add Heading block' }).click();
    await expect(canvas.getByRole('article', { name: 'heading block' })).toHaveCount(viewport.width === 760 ? 1 : 2);
    await page.getByRole('button', { name: 'Properties', exact: true }).click();
    await expect(page.locator('#studio-properties')).toBeVisible();
    await page.getByRole('button', { name: 'Close Properties' }).click();
    await expect(page.locator('#studio-properties')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  }
});

test('Practice Studio separates problem blocks from code and verification', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/tests/browser/index.html?mode=practice');
  const canvas = page.getByRole('region', { name: 'Document canvas' });
  await expect(page.getByRole('navigation', { name: 'Problem outline' })).toBeVisible();
  await page.getByRole('toolbar', { name: 'Insert blocks' }).getByRole('button', { name: 'Add Paragraph block' }).dragTo(canvas);
  await expect(canvas.getByRole('article', { name: 'paragraph block' })).toHaveCount(2);
  await page.getByRole('textbox', { name: 'Content', exact: true }).fill('Describe the problem.');
  await page.getByRole('button', { name: 'Collapse structure sidebar' }).click();
  await expect(page.locator('#studio-structure-content')).toHaveAttribute('aria-hidden', 'true');
  await page.getByRole('button', { name: 'Expand structure sidebar' }).click();
  await page.getByRole('button', { name: 'Code & Verification' }).click();
  await page.getByLabel('Starter code').fill('print("ok")');
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await expect(canvas).toContainText('Describe the problem.');
  await page.waitForTimeout(850);
  await page.reload();
  await expect(canvas).toContainText('Describe the problem.');
  await page.getByRole('button', { name: 'Code & Verification' }).click();
  await expect(page.getByLabel('Starter code')).toHaveValue('print("ok")');
});

for (const { mode, namespace, draft } of [
  { mode: 'courses', namespace: 'course', draft: migratePythonCourse().drafts[0] },
  { mode: 'practice', namespace: 'practice', draft: migratePracticeBank().drafts.find((item) => item.contentId === 'practice-even-or-odd') },
  { mode: 'projects', namespace: 'project', draft: migrateCliTaskManager().drafts[0] },
]) {
  test(`${mode} migrated draft preserves canonical content after a no-op save`, async ({ page }) => {
    const prefix = `ycoders.admin.${namespace}-draft.v1`;
    await page.goto('/tests/browser/index.html?mode=dashboard');
    await page.evaluate(({ prefix, value }) => {
      localStorage.setItem(`${prefix}:${value.documentId}`, JSON.stringify(value));
      localStorage.setItem(`${prefix}:active-document`, value.documentId);
    }, { prefix, value: draft });
    await page.goto(`/tests/browser/index.html?mode=${mode}`);
    await expect(page.getByRole('heading', { name: draft.content.title, level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Collapse structure sidebar' }).click();
    await page.getByRole('button', { name: 'Expand structure sidebar' }).click();
    await page.getByLabel('Title', { exact: true }).fill(draft.content.title);
    await page.waitForTimeout(850);
    await page.reload();
    const content = await page.evaluate(({ prefix, documentId }) => JSON.parse(localStorage.getItem(`${prefix}:${documentId}`)).content, { prefix, documentId: draft.documentId });
    expect(content).toEqual(draft.content);
  });
}
