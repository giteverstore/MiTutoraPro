import { expect, test } from '@playwright/test';

test('Course authoring, preview, and local draft reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/tests/browser/index.html?mode=courses');
  await expect(page.getByRole('heading', { name: 'Untitled Course', level: 1 })).toBeVisible();
  await page.getByLabel('Title', { exact: true }).fill('Python Mini Fundamentals');
  await page.getByRole('button', { name: '+ Add module' }).click();
  await expect(page.getByRole('navigation', { name: 'Course structure' }).getByRole('button', { name: /Module 2 1 lessons/ })).toBeVisible();
  await page.getByRole('button', { name: '+ Add lesson' }).last().click();
  await page.getByLabel('Title', { exact: true }).fill('Print a greeting');
  await page.getByRole('button', { name: 'Add Paragraph block' }).click();
  await page.getByRole('textbox', { name: 'Content', exact: true }).fill('Learn to print a greeting.');
  await page.getByRole('button', { name: 'Add Code block' }).click();
  await page.getByLabel('Code', { exact: true }).fill('print("Hello")');
  await page.getByRole('button', { name: 'Validate Course' }).click();
  await expect(page.getByText('Content is valid')).toBeVisible();
  await page.getByRole('button', { name: 'Preview & Test' }).click();
  await expect(page.getByRole('heading', { name: 'Python Mini Fundamentals', level: 2 })).toBeVisible();
  await page.getByRole('navigation', { name: 'Preview modules' }).getByRole('button', { name: 'Print a greeting' }).click();
  await expect(page.getByRole('heading', { name: 'Print a greeting', level: 2 })).toBeVisible();
  await expect(page.getByText('Learn to print a greeting.')).toBeVisible();
  await page.waitForTimeout(850);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Python Mini Fundamentals', level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Course structure' }).getByRole('button', { name: /^2\. Print a greeting$/ })).toBeVisible();
});

test('Practice authoring, preview controls, and local draft reload', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/tests/browser/index.html?mode=practice');
  await page.getByLabel('Title', { exact: true }).fill('Print a greeting');
  await page.getByLabel('Topic', { exact: true }).fill('Output');
  await page.getByRole('button', { name: 'Code & Verification' }).click();
  await page.getByLabel('Starter code').fill('print("Hello")');
  await page.getByLabel('Expected output').fill('Hello');
  await page.getByLabel('Question type').fill('implementation');
  await page.getByRole('button', { name: 'Content', exact: true }).click();
  await page.getByRole('button', { name: 'Add Heading block' }).click();
  await page.getByLabel('Text', { exact: true }).fill('Function contract');
  await page.getByRole('button', { name: 'Add Code block' }).click();
  await page.getByLabel('Code', { exact: true }).fill('print("Hello")');
  await page.getByRole('button', { name: 'Code & Verification' }).click();
  await page.getByLabel('Tags').fill('output\npython');
  await page.getByRole('button', { name: '+ Add example' }).click();
  await page.getByLabel('Example 1 input').fill('No input');
  await page.getByLabel('Example 1 output').fill('Hello');
  await page.getByLabel('Public tests').fill('[{"name":"hello","arguments":[],"expected":"Hello"}]');
  await page.getByLabel('Public tests').blur();
  await page.getByRole('button', { name: 'Validate Question' }).click();
  await expect(page.getByText('Content is valid')).toBeVisible();
  await page.getByRole('button', { name: 'Preview & Test' }).click();
  await expect(page.getByRole('button', { name: 'Run code' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Verify output' })).toBeDisabled();
  const editor = page.locator('.admin-practice-preview-editor .view-lines');
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.insertText('print("Wrong")');
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(editor).toContainText('print("Hello")');
  await page.waitForTimeout(850);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Print a greeting' })).toBeVisible();
  await page.getByRole('button', { name: 'Code & Verification' }).click();
  await expect(page.getByLabel('Starter code')).toHaveValue('print("Hello")');
});

for (const mode of ['courses', 'practice']) {
  test(`${mode} reviewer cannot edit`, async ({ page }) => {
    await page.goto(`/tests/browser/index.html?mode=${mode}&role=reviewer`);
    await expect(page.getByText('Read only')).toBeVisible();
    await expect(page.getByLabel('Title', { exact: true })).toHaveAttribute('readonly', '');
  });
}
