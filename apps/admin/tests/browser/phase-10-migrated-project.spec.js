import { expect, test } from '@playwright/test';
import { migrateCliTaskManager } from '../../../../scripts/content/migrationCore.mjs';

test('real CLI Task Manager draft edits, validates, reloads and previews every language', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const draft = migrateCliTaskManager().drafts[0];
  await page.goto('/tests/browser/index.html?mode=dashboard');
  await page.evaluate((value) => {
    localStorage.setItem(`ycoders.admin.project-draft.v1:${value.documentId}`, JSON.stringify(value));
    localStorage.setItem('ycoders.admin.project-draft.v1:active-document', value.documentId);
  }, draft);
  const started = Date.now();
  await page.goto('/tests/browser/index.html?mode=projects');
  await expect(page.getByRole('heading', { name: 'CLI Task Manager', level: 1 })).toBeVisible();
  const loadMs = Date.now() - started;
  const structure = page.getByRole('navigation', { name: 'Project structure' });
  for (const title of ['Project Setup', 'Task Representation', 'Task Operations', 'Persistent Storage', 'Final CLI Integration']) await expect(structure.getByRole('button', { name: new RegExp(title) }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Validate Project' }).click();
  await expect(page.getByText('Project contract is valid.')).toBeVisible();
  await page.getByLabel('Title', { exact: true }).fill('CLI Task Manager Test Edit');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('ycoders.admin.project-draft.v1:cli-task-manager')).content.title === 'CLI Task Manager Test Edit');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'CLI Task Manager Test Edit', level: 1 })).toBeVisible();
  await structure.getByRole('button', { name: /Project Setup/ }).first().click();
  await page.getByLabel('Paragraph text').first().fill('Build one verified capability at a time.');
  await page.getByLabel('Learner failure message').first().fill('The Task Manager must start.');
  await page.getByLabel('Additional mentor context').fill('Guide learners to test the first run.');
  await structure.getByRole('button', { name: 'Runtime / Starter Files' }).click();
  const pythonStarter = page.getByLabel('File content').first();
  await pythonStarter.fill(`${await pythonStarter.inputValue()}\n# migration acceptance`);
  await page.waitForFunction(() => {
    const content = JSON.parse(localStorage.getItem('ycoders.admin.project-draft.v1:cli-task-manager')).content;
    return content.checkpoints[0].blocks[0].text === 'Build one verified capability at a time.'
      && content.checkpoints[0].validators[0].failureMessage === 'The Task Manager must start.'
      && content.checkpoints[0].mentor.additionalContext === 'Guide learners to test the first run.'
      && content.starterWorkspaces.python.files[0].content.includes('# migration acceptance');
  });
  await page.reload();
  await structure.getByRole('button', { name: /Project Setup/ }).first().click();
  await expect(page.getByLabel('Additional mentor context')).toHaveValue('Guide learners to test the first run.');
  await page.getByRole('button', { name: 'Validate Project' }).click();
  await expect(page.getByText('Project contract is valid.')).toBeVisible();
  await page.getByRole('button', { name: 'Preview & Test' }).click();
  await expect(page.getByRole('heading', { name: 'Learner Preview' })).toBeVisible();
  for (const [language, entrypoint, uniqueCode] of [['python', 'main.py', 'print("CLI Task Manager")'], ['javascript', 'index.js', 'console.log("CLI Task Manager")'], ['java', 'Main.java', 'System.out.println'], ['cpp', 'main.cpp', 'std::cout']]) {
    await page.getByLabel('Language').selectOption(language);
    await expect(page.getByText(`Entrypoint: ${entrypoint}`)).toBeVisible();
    await expect(page.locator('.validation-workspace')).toContainText(uniqueCode);
  }
  await page.getByRole('button', { name: '2. Task Representation' }).click();
  await page.getByLabel('Language').selectOption('python');
  await expect(page.locator('.project-learner-surface')).toContainText('A small class or dataclass');
  await expect(page.locator('.project-learner-surface')).not.toContainText('An object or a small class');
  await page.getByLabel('Language').selectOption('javascript');
  await expect(page.locator('.project-learner-surface')).toContainText('An object or a small class');
  await expect(page.locator('.project-learner-surface')).not.toContainText('A small class or dataclass');
  await page.getByRole('button', { name: 'Completion' }).click();
  await expect(page.locator('.project-learner-surface')).toContainText('CLI Task Manager is complete.');
  console.log(`Migrated Project Studio browser load=${loadMs}ms`);
});
