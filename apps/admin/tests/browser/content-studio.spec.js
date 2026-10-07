import { expect, test } from '@playwright/test';

const openEditor = async (page, query = '') => {
  await page.goto(`/tests/browser/index.html${query}`);
  await expect(page.getByRole('heading', { name: 'Document Editor' })).toBeVisible();
};

test('desktop authoring workflow and local draft recovery', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  await expect(page.getByText('Start building your content')).toBeVisible();
  await page.getByRole('button', { name: 'Add Callout block' }).dragTo(page.getByLabel('Document canvas'), {
    sourcePosition: { x: 16, y: 16 }, targetPosition: { x: 100, y: 90 },
  });
  await expect(page.locator('article[aria-label="callout block"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Add Heading block' }).click();
  await page.getByLabel('Heading text').fill('Browser-authored heading');
  await page.getByRole('button', { name: 'Add Paragraph block' }).click();
  await page.getByLabel('Paragraph text').fill('A long browser-authored paragraph that remains editable and wraps inside the canvas.');
  await page.getByRole('button', { name: 'Add List block' }).click();
  await page.getByLabel('List item 1').fill('Inline list editing');
  await page.getByRole('button', { name: 'Add Code block' }).click();
  await page.getByRole('radio', { name: 'Language variants' }).check();
  await page.getByLabel('python').fill('print("python")');
  await page.getByLabel('java').fill('class Main {}');
  await page.getByLabel('cpp').fill('int main() {}');
  await expect(page.getByLabel('Document canvas').getByText('Language variants', { exact: true })).toBeVisible();

  const codeBlock = page.locator('article[aria-label="code block"]');
  await codeBlock.getByRole('button', { name: 'Move block up' }).click();
  await codeBlock.getByRole('button', { name: 'Duplicate block' }).click();
  await expect(page.locator('article[aria-label="code block"]')).toHaveCount(2);
  await page.locator('article[aria-label="code block"]').last().getByRole('button', { name: 'Delete block' }).click();
  await expect(page.locator('article[aria-label="code block"]')).toHaveCount(1);
  await page.locator('article[aria-label="heading block"]').focus();
  await page.keyboard.press('Control+z');
  await expect(page.locator('article[aria-label="code block"]')).toHaveCount(2);
  await page.keyboard.press('Control+Shift+z');
  await expect(page.locator('article[aria-label="code block"]')).toHaveCount(1);

  await page.getByRole('button', { name: 'Validate' }).click();
  await expect(page.getByText('Document is valid')).toBeVisible();
  await page.getByRole('tab', { name: 'Generated JSON' }).click();
  await expect(page.getByLabel('Generated JSON')).toContainText('Browser-authored heading');
  await page.getByRole('tab', { name: 'Editor' }).click();
  await expect(page.getByLabel('Heading text')).toHaveValue('Browser-authored heading');
  await expect(page.getByRole('status')).toContainText('Saved', { timeout: 5_000 });

  await page.reload();
  await expect(page.getByLabel('Heading text')).toHaveValue('Browser-authored heading');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('existing blocks reorder by drag and by keyboard-accessible controls', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  await page.getByRole('button', { name: 'Add Heading block' }).click();
  await page.getByRole('button', { name: 'Add Callout block' }).click();
  const canvas = page.getByLabel('Document canvas');
  const heading = canvas.locator('article[aria-label="heading block"]');
  const callout = canvas.locator('article[aria-label="callout block"]');
  await callout.dragTo(heading, { sourcePosition: { x: 20, y: 18 }, targetPosition: { x: 20, y: 18 } });
  await expect(canvas.locator('article').first()).toHaveAttribute('aria-label', 'callout block');
  await heading.getByRole('button', { name: 'Move block up' }).click();
  await expect(canvas.locator('article').first()).toHaveAttribute('aria-label', 'heading block');
  await heading.getByRole('button', { name: 'Move block down' }).click();
  await expect(canvas.locator('article').last()).toHaveAttribute('aria-label', 'heading block');
  await expect(heading).toHaveAttribute('aria-current', 'true');
  await expect(canvas.locator('article')).toHaveCount(2);
});

test('validation maps an invalid field back to its selected block', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page);
  await page.getByRole('button', { name: 'Add Heading block' }).click();
  await page.getByLabel('Heading text').fill('');
  await page.getByRole('button', { name: 'Validate' }).click();
  const issue = page.getByLabel('Validation issues').getByRole('button').first();
  await expect(issue).toContainText('must NOT have fewer than 1 characters');
  await issue.click();
  await expect(page.locator('article[aria-label="heading block"]')).toHaveAttribute('aria-current', 'true');
  await page.getByLabel('Heading text').fill('Fixed heading');
  await page.getByRole('button', { name: 'Validate' }).click();
  await expect(page.getByText('Document is valid')).toBeVisible();
});

test('tablet drawers are exclusive, keyboard dismissible, and do not overflow', async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 820 });
  await openEditor(page);
  await expect(page.getByLabel('Block palette')).toBeHidden();
  await page.getByRole('button', { name: 'Blocks' }).click();
  await expect(page.getByLabel('Block palette')).toBeVisible();
  await page.getByRole('button', { name: 'Add Heading block' }).click();
  await page.getByRole('button', { name: 'Properties' }).click();
  await expect(page.getByLabel('Block palette')).toBeHidden();
  await expect(page.getByLabel('Properties inspector')).toBeVisible();
  await page.locator('#content-properties-inspector textarea').fill('Tablet heading');
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Properties inspector')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('mobile fallback remains usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openEditor(page);
  await page.getByRole('button', { name: 'Blocks' }).click();
  await page.getByRole('button', { name: 'Add Paragraph block' }).click();
  await expect(page.getByLabel('Block palette')).toBeHidden();
  await expect(page.locator('article[aria-label="paragraph block"]')).toBeFocused();
  await page.getByLabel('Paragraph text').fill('Mobile content');
  await expect(page.getByLabel('Paragraph text')).toHaveValue('Mobile content');
  await page.getByRole('button', { name: 'Blocks' }).click();
  await page.getByRole('button', { name: 'Close blocks' }).click();
  await expect(page.getByLabel('Block palette')).toBeHidden();
  await page.getByRole('button', { name: 'Blocks' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Block palette')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('reviewer can inspect and validate but cannot mutate', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openEditor(page, '?role=reviewer');
  await expect(page.getByText('Read only')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Heading block' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Redo' })).toBeDisabled();
  await expect(page.getByLabel('Title')).toHaveAttribute('readonly', '');
  await page.getByRole('button', { name: 'Validate' }).click();
  await expect(page.getByText('Document is valid')).toBeVisible();
  await page.getByRole('tab', { name: 'Generated JSON' }).click();
  await expect(page.getByLabel('Generated JSON')).toBeVisible();
});

test('large document scroll, selection, validation, and JSON remain responsive', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const started = Date.now();
  await openEditor(page, '?fixture=large');
  await expect(page.locator('article[aria-label="paragraph block"]')).toHaveCount(120);
  const finalParagraph = page.locator('article[aria-label="paragraph block"]').last();
  await finalParagraph.scrollIntoViewIfNeeded();
  await finalParagraph.click();
  await expect(finalParagraph).toHaveAttribute('aria-current', 'true');
  await page.getByRole('button', { name: 'Validate' }).click();
  await expect(page.getByText('Document is valid')).toBeVisible();
  await page.getByRole('tab', { name: 'Generated JSON' }).click();
  await expect(page.getByLabel('Generated JSON')).toContainText('Synthetic paragraph 199');
  expect(Date.now() - started).toBeLessThan(15_000);
});
