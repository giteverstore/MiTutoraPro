import { expect } from '@playwright/test';
import { createTaskProgressionFixture } from '../content-contracts/fixtures.js';
import { openShellPage, projectCloudState, replaceEditorSource, test } from './fixtures/authenticated-projects.js';

const projectId = 'phase-7-task-progression-fixture';

function published(version, titleSuffix = '') {
  const fixture = createTaskProgressionFixture({ version });
  return {
    ...fixture,
    status: 'published',
    content: { ...fixture.content, title: `${fixture.content.title}${titleSuffix}` },
  };
}

async function installCanonicalCatalog(page, getActiveVersion) {
  await page.addInitScript(({ v1, v2, activeVersion }) => {
    globalThis.__YCODERS_PROJECT_E2E_ACTIVE_VERSION__ = Number(localStorage.getItem('__ycoders_e2e_active_project_version__')) || activeVersion;
    const documents = { 1: v1, 2: v2 };
    globalThis.__YCODERS_PROJECT_E2E_PUBLISHED_FETCH__ = async (input) => {
      const url = new URL(input, location.origin);
      const tail = url.pathname.split('/').filter(Boolean).slice(3);
      const active = globalThis.__YCODERS_PROJECT_E2E_ACTIVE_VERSION__;
      if (tail.length === 0) return { ok: true, json: async () => ({ projects: active ? [{ contentId: documents[active].contentId, activeVersion: active, metadata: { testOnly: true } }] : [] }) };
      const version = tail[1] ? Number(tail[1]) : active;
      if (!version || !documents[version]) return { ok: false, json: async () => ({ error: { code: 'content/not-published', message: 'Project is archived.' } }) };
      return { ok: true, json: async () => ({ document: documents[version], metadata: { status: 'READY' } }) };
    };
    globalThis.__YCODERS_PROJECT_E2E_EXECUTE__ = async ({ files }) => ({
      status: 'success',
      stdout: Object.values(files).map(({ content }) => content).join('\n'),
      stderr: '',
      executionTimeMs: 1,
      exitCode: 0,
    });
  }, { v1: published(1), v2: published(2, ' v2'), activeVersion: getActiveVersion() });
  await page.reload();
}

async function startFixture(page, language = 'Python') {
  await openShellPage(page, 'Home');
  await openShellPage(page, 'Projects');
  const card = page.getByRole('article').filter({ hasText: 'Task Progression Acceptance Fixture' });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: /Start Project/ }).click();
  await page.getByRole('button', { name: 'Start Project' }).click();
  await page.getByRole('radio', { name: new RegExp(`^${language}`) }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('dialog', { name: 'Confirm project' }).getByRole('button', { name: 'Start Project' }).click();
  await expect(page.locator('.project-ide-shell')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Greeting' })).toBeVisible();
}

test.describe('canonical Project publication-to-completion acceptance', () => {
  test('persists pinned v1 through task failure, regression repair, reload, and final completion', async ({ page, projectLearner }) => {
    let activeVersion = 1;
    await installCanonicalCatalog(page, () => activeVersion);
    await startFixture(page);

    await replaceEditorSource(page, 'print("Hello, Project")\n');
    await page.getByRole('button', { name: 'Verify Task' }).click();
    await expect(page.getByRole('heading', { name: 'Transform function' })).toBeVisible();
    await expect.poll(async () => (await projectCloudState(projectLearner.uid, projectId)).metadata?.contentVersion).toBe(1);

    await replaceEditorSource(page, 'print("wrong")\n');
    await page.getByRole('button', { name: 'Verify Task' }).click();
    await expect(page.getByText(/must pass/i).first()).toBeVisible();
    let cloud = await projectCloudState(projectLearner.uid, projectId);
    expect(cloud.metadata.taskProgress.transform?.status).not.toBe('COMPLETED');

    const foundation = 'def transform():\n    return "READY"\nprint("Hello, Project")\nprint(transform())\n';
    await replaceEditorSource(page, foundation);
    await page.getByRole('button', { name: 'Verify Task' }).click();
    await expect(page.getByRole('button', { name: 'Validate Checkpoint' })).toBeVisible();

    await replaceEditorSource(page, 'def transform():\n    return "READY"\nprint(transform())\n');
    await page.getByRole('button', { name: 'Validate Checkpoint' }).click();
    await expect(page.getByText(/must pass/i).first()).toBeVisible();
    cloud = await projectCloudState(projectLearner.uid, projectId);
    expect(cloud.metadata.taskProgress.greeting.status).toBe('COMPLETED');
    expect(cloud.metadata.taskProgress.transform.status).toBe('COMPLETED');
    expect(cloud.metadata.checkpointProgress.foundation?.status).not.toBe('COMPLETED');

    await replaceEditorSource(page, foundation);
    await page.getByRole('button', { name: 'Validate Checkpoint' }).click();
    await expect(page.getByRole('heading', { name: 'Input handling' })).toBeVisible();
    await expect.poll(async () => (await projectCloudState(projectLearner.uid, projectId)).metadata?.currentCheckpoint).toBe(1);

    activeVersion = 2;
    await page.evaluate(() => {
      localStorage.setItem('__ycoders_e2e_active_project_version__', '2');
      globalThis.__YCODERS_PROJECT_E2E_ACTIVE_VERSION__ = 2;
    });
    await page.reload();
    const resumeCard = page.getByRole('article').filter({ hasText: 'Task Progression Acceptance Fixture' });
    await resumeCard.getByRole('button', { name: 'Continue Project' }).click();
    await page.getByRole('button', { name: 'Continue Project' }).click();
    await expect(page.getByRole('heading', { name: 'Input handling' })).toBeVisible();
    cloud = await projectCloudState(projectLearner.uid, projectId);
    expect(cloud.metadata.contentVersion).toBe(1);
    expect(cloud.metadata.checkpointProgress.foundation.status).toBe('COMPLETED');

    const input = `${foundation}\nvalue = input()\nprint("VALUE", value)\n`;
    await replaceEditorSource(page, input);
    await page.getByRole('button', { name: 'Verify Task' }).click();
    await expect(page.getByRole('heading', { name: 'Final result' })).toBeVisible();
    const complete = `${input}\nprint(value.upper())\n`;
    await replaceEditorSource(page, complete);
    await page.getByRole('button', { name: 'Verify Task' }).click();
    await page.getByRole('button', { name: 'Validate Checkpoint' }).click();
    await expect(page.getByRole('button', { name: 'Verify Final Project' })).toBeVisible();

    await replaceEditorSource(page, 'print("VALUE")\n');
    await page.getByRole('button', { name: 'Verify Final Project' }).click();
    await expect(page.getByText(/must pass/i).first()).toBeVisible();
    expect((await projectCloudState(projectLearner.uid, projectId)).metadata.status).not.toBe('completed');

    await replaceEditorSource(page, complete);
    await page.getByRole('button', { name: 'Verify Final Project' }).click();
    await expect(page.getByText('Project Complete', { exact: true })).toBeVisible();
    await expect.poll(async () => (await projectCloudState(projectLearner.uid, projectId)).metadata?.status).toBe('completed');
    await page.reload();
    const completedCard = page.getByRole('article').filter({ hasText: 'Task Progression Acceptance Fixture' });
    await completedCard.getByRole('button', { name: 'Review Project' }).click();
    await page.getByRole('button', { name: 'Review Project' }).click();
    await expect(page.getByText('Project Complete', { exact: true })).toBeVisible();
    expect((await projectCloudState(projectLearner.uid, projectId)).metadata.contentVersion).toBe(1);
  });

  test('a new learner starts the active v2 JavaScript workspace without Python leakage', async ({ page, projectLearner }) => {
    await installCanonicalCatalog(page, () => 2);
    await startFixture(page, 'JavaScript');
    const cloud = await projectCloudState(projectLearner.uid, projectId);
    expect(cloud.metadata.contentVersion).toBe(2);
    expect(cloud.metadata.languageId).toBe('javascript');
    await expect(page.locator('.view-lines')).toContainText('console.log');
    await expect(page.getByText('// Greeting', { exact: true })).toBeVisible();
    await expect(page.getByText('# Greeting', { exact: true })).toHaveCount(0);
    const verify = page.getByRole('button', { name: 'Verify Task' });
    await verify.focus();
    await expect(verify).toBeFocused();
    await page.getByRole('button', { name: 'Checkpoints' }).click();
    await expect(page.getByRole('button', { name: 'Transform function Locked' })).toBeDisabled();
    for (const viewport of [{ width: 760, height: 820 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await expect(page.getByRole('navigation', { name: 'Project workspace tools' })).toBeVisible();
      await expect(page.getByRole('textbox', { name: /editor/i }).first()).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Guide' })).toBeVisible();
    }
  });

  test('language reset clears task evidence while retaining the pinned version', async ({ page, projectLearner }) => {
    await installCanonicalCatalog(page, () => 1);
    await startFixture(page, 'Python');
    await replaceEditorSource(page, 'print("Hello, Project")\n');
    await page.getByRole('button', { name: 'Verify Task' }).click();
    await expect(page.getByRole('heading', { name: 'Transform function' })).toBeVisible();
    await page.getByRole('button', { name: 'Python', exact: true }).click();
    await page.getByRole('radio', { name: 'JavaScript' }).click();
    await page.getByRole('button', { name: 'Reset and Change Language' }).click();
    await expect(page.locator('.view-lines')).toContainText('console.log');
    await expect(page.getByText('// Greeting', { exact: true })).toBeVisible();
    await expect.poll(async () => (await projectCloudState(projectLearner.uid, projectId)).metadata?.languageId).toBe('javascript');
    const cloud = await projectCloudState(projectLearner.uid, projectId);
    expect(cloud.metadata.contentVersion).toBe(1);
    expect(cloud.metadata.currentCheckpoint).toBe(0);
    expect(cloud.metadata.taskProgress).toEqual({});
    expect(cloud.metadata.checkpointProgress).toEqual({});
  });
});
