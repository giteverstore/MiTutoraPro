import { expect, test } from '@playwright/test';
import { createCourseDraft } from '../../src/content-studio/courses/courseAuthoring.js';

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

test('language-neutral Course authoring suppresses executable compiler blocks', async ({ page }) => {
  await page.goto('/tests/browser/index.html?mode=courses');
  await page.getByRole('combobox', { name: 'Language' }).selectOption('none');
  await page.getByRole('navigation', { name: 'Course structure' }).getByRole('button', { name: '1. Untitled lesson' }).click();
  await expect(page.getByRole('button', { name: 'Add Compiler Exercise block' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Add Code block' }).click();
  await expect(page.getByRole('combobox', { name: 'Language' })).toHaveValue('text');
});

test('Course metadata hydrates and autosaves Coming Soon without validation or publication', async ({ page }) => {
  const draft = createCourseDraft('course-coming-soon-browser');
  draft.draftRevision = 4;
  draft.content.title = 'Existing Browser Course';
  draft.content.comingSoon = false;
  await page.addInitScript((value) => {
    localStorage.setItem(`ycoders.admin.course-draft.v1:${value.documentId}`, JSON.stringify(value));
    localStorage.setItem('ycoders.admin.course-draft.v1:active-document', value.documentId);
  }, draft);
  const adminRequests = [];
  page.on('request', (request) => { if (request.url().includes('/api/admin-content/')) adminRequests.push(request.url()); });
  await page.goto('/tests/browser/index.html?mode=courses');
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Existing Browser Course');
  const toggle = page.getByRole('checkbox', { name: /Coming Soon/ });
  await expect(toggle).not.toBeChecked();
  await toggle.check();
  await expect(toggle).toBeChecked();
  await expect.poll(() => page.evaluate((id) => JSON.parse(localStorage.getItem(`ycoders.admin.course-draft.v1:${id}`))?.content.comingSoon, draft.documentId)).toBe(true);
  const saved = await page.evaluate((id) => JSON.parse(localStorage.getItem(`ycoders.admin.course-draft.v1:${id}`)), draft.documentId);
  expect(saved.content).toEqual({ ...draft.content, comingSoon: true });
  expect(adminRequests).toEqual([]);
});
