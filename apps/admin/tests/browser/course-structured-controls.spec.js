import { expect, test } from '@playwright/test';

test('new Course code and compiler blocks use learner-supported defaults', async ({ page }) => {
  await page.goto('/tests/browser/index.html?mode=courses');
  await page.getByRole('navigation', { name: 'Course structure' }).getByRole('button', { name: '1. Untitled lesson' }).click();

  await page.getByRole('button', { name: 'Add Code block' }).click();
  await expect(page.getByRole('combobox', { name: 'Mode' })).toHaveValue('display');
  await expect(page.getByRole('combobox', { name: 'Mode' }).locator('option')).toHaveCount(2);

  await page.getByRole('button', { name: 'Add Compiler Exercise block' }).click();
  await expect(page.getByRole('textbox', { name: 'Runtime' })).toHaveValue('python');
  await expect(page.getByRole('textbox', { name: 'Runtime' })).toHaveAttribute('readonly');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('javascript');
  await expect(page.getByRole('textbox', { name: 'Runtime' })).toHaveValue('javascript');
});
