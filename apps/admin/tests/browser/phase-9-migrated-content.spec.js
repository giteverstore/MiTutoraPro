import { expect, test } from '@playwright/test';
import { migratePythonCourse, migratePracticeBank } from '../../../../scripts/content/migrationCore.mjs';

async function preloadDraft(page, namespace, draft) {
  await page.goto('/tests/browser/index.html?mode=dashboard');
  await page.evaluate(({ prefix, value }) => {
    localStorage.setItem(`${prefix}:${value.documentId}`, JSON.stringify(value));
    localStorage.setItem(`${prefix}:active-document`, value.documentId);
  }, { prefix: namespace, value: draft });
}

test('real migrated Python Course is editable, reloadable and previews representative lessons', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await preloadDraft(page, 'ycoders.admin.course-draft.v1', migratePythonCourse().drafts[0]);
  const openedAt = Date.now();
  await page.goto('/tests/browser/index.html?mode=courses');
  await expect(page.getByRole('heading', { name: 'Python Foundations', level: 1 })).toBeVisible();
  const loadMs = Date.now() - openedAt;
  await expect(page.getByRole('navigation', { name: 'Course structure' }).getByRole('button', { name: '1. Introduction to Python', exact: true })).toBeVisible();
  let startedAt = Date.now();
  await page.getByRole('navigation', { name: 'Course structure' }).getByRole('button', { name: /1\. CH 1:/ }).click();
  await expect(page.getByRole('heading', { name: 'Module 1' })).toBeVisible();
  const moduleMs = Date.now() - startedAt;
  startedAt = Date.now();
  await page.getByRole('navigation', { name: 'Course structure' }).getByRole('button', { name: '1. Introduction to Python', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lesson 1' })).toBeVisible();
  const lessonMs = Date.now() - startedAt;
  await page.getByRole('navigation', { name: 'Course structure' }).getByRole('button', { name: 'Course Overview', exact: true }).click();
  startedAt = Date.now();
  await page.getByRole('button', { name: 'Validate Course' }).click();
  await expect(page.getByText('Content is valid')).toBeVisible();
  const validateMs = Date.now() - startedAt;
  await page.getByLabel('Title', { exact: true }).fill('Python Foundations Test Edit');
  startedAt = Date.now();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('ycoders.admin.course-draft.v1:python')).content.title === 'Python Foundations Test Edit');
  const saveMs = Date.now() - startedAt;
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Python Foundations Test Edit', level: 1 })).toBeVisible();
  startedAt = Date.now();
  await page.getByText('More', { exact: true }).click();
  await page.getByRole('button', { name: 'Generated JSON' }).click();
  await expect(page.locator('.content-json-view')).toContainText('lesson-9-15-finish');
  const jsonMs = Date.now() - startedAt;
  await page.getByRole('button', { name: 'Back to editor' }).click();
  await page.getByRole('button', { name: 'Preview & Test' }).click();
  const preview = page.getByRole('navigation', { name: 'Preview modules' });
  for (const name of ['Introduction to Python', 'Common Errors (I)', 'Run Your First Python Program', 'Working of the Program', 'Finish']) {
    await preview.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible();
  }
  await preview.getByRole('button', { name: /Quiz: Which of the following is the correct way/ }).click();
  await expect(page.locator('.project-preview-guide').getByRole('group')).toBeVisible();
  console.log(`Migrated Course Studio browser timings: load=${loadMs}ms module=${moduleMs}ms lesson=${lessonMs}ms validate=${validateMs}ms autosave=${saveMs}ms JSON=${jsonMs}ms`);
});

test('real migrated Practice question opens, validates, previews and reloads', async ({ page }) => {
  test.setTimeout(120_000);
  const draft = migratePracticeBank().drafts.find((item) => item.contentId === 'practice-even-or-odd');
  await preloadDraft(page, 'ycoders.admin.practice-draft.v1', draft);
  await page.goto('/tests/browser/index.html?mode=practice');
  await expect(page.getByRole('heading', { name: 'Even or Odd', level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Code & Verification' }).click();
  await expect(page.getByLabel('Starter code')).toContainText('number = int(input())');
  await page.getByRole('button', { name: 'Validate Question' }).click();
  await expect(page.getByText('Content is valid')).toBeVisible();
  await page.getByRole('button', { name: 'Preview & Test' }).click();
  await expect(page.getByRole('button', { name: 'Run code' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Reset' })).toBeEnabled();
  const editor = page.locator('.admin-practice-preview-editor .view-lines');
  const enterCode = async (code) => { await editor.click(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.insertText(code); };
  await enterCode('print("Wrong")');
  await page.getByRole('button', { name: 'Run code' }).click();
  await expect(page.getByLabel('Execution output')).toHaveValue('Wrong', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Verify output' }).click();
  await expect(page.getByRole('status')).toHaveText('Output does not match the expected result.');
  await enterCode('number = int(input())\nprint("Even" if number % 2 == 0 else "Odd")');
  await page.getByRole('button', { name: 'Run code' }).click();
  await expect(page.getByLabel('Execution output')).toHaveValue('Even', { timeout: 60_000 });
  await page.getByRole('button', { name: 'Verify output' }).click();
  await expect(page.getByRole('status')).toHaveText('Accepted');
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(editor).toContainText('number = int(input())');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Even or Odd', level: 1 })).toBeVisible();
});
