import { expect } from '@playwright/test';
import { adminDb, clearProjectLocalCache, openTaskManager, projectCloudState, replaceEditorSource, test } from './fixtures/authenticated-projects.js';

const localKey = 'mi-tutora:projects:v1';
const pythonSource = `import json, os
tasks = json.load(open("tasks.json", encoding="utf-8")) if os.path.exists("tasks.json") else [{"title": "cloud-runtime-task", "completed": False}]
open("tasks.json", "w", encoding="utf-8").write(json.dumps(tasks))
print("CLI Task Manager")
print(tasks[0]["title"])
`;
const cppSource = `#include <fstream>
#include <iostream>
#include <string>
int main() {
  std::string task;
  std::ifstream input("tasks.txt");
  if (input) std::getline(input, task);
  if (task.empty()) {
    task = "cloud-cpp-task";
    std::ofstream output("tasks.txt");
    output << task;
  }
  std::cout << "CLI Task Manager" << std::endl << task << std::endl;
  return 0;
}
`;

async function reopenTaskManagerFromCloud(page, language, uid) {
  await clearProjectLocalCache(page, uid);
  await page.reload();
  await openTaskManager(page, language);
}

async function runProjectAndShowOutput(page) {
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await page.getByRole('tab', { name: 'output' }).click();
  return page.getByRole('tabpanel');
}

async function runCppAfterColdToolchainWarmup(page, expected) {
  let output = await runProjectAndShowOutput(page);
  await expect(output).not.toContainText('Run your project to see output.', { timeout: 30_000 });
  if ((await output.textContent())?.includes('execution exceeded 10000 ms')) {
    output = await runProjectAndShowOutput(page);
  }
  await expect(output).toContainText(expected, { timeout: 120_000 });
}

test.describe('authenticated Projects cloud persistence', () => {
  test('edits, autosaves, restores checkpoint progress, and prefers cloud over stale local cache', async ({ page, projectLearner }) => {
    await openTaskManager(page, 'Python');
    const marker = 'CLI Task Manager cloud-browser-marker';
    await replaceEditorSource(page, `print("${marker}")\n`);
    await expect(await runProjectAndShowOutput(page)).toContainText(marker, { timeout: 90_000 });
    await expect.poll(async () => (await projectCloudState(projectLearner.uid)).metadata?.currentCheckpoint, { timeout: 30_000 }).toBe(1);
    const saved = await projectCloudState(projectLearner.uid);
    expect(saved.metadata).toMatchObject({ languageId: 'python', currentCheckpoint: 1, completedCheckpoints: ['setup'] });
    expect(saved.files['main.py'].content).toContain(marker);

    await page.evaluate(({ key }) => localStorage.setItem(key, JSON.stringify({ 'cli-task-manager': { status: 'active', languageId: 'python', currentCheckpoint: 0, completedCheckpoints: [], files: { 'main.py': { path: 'main.py', content: 'print("stale-local")', language: 'python', editable: true } }, entryFilePath: 'main.py' } })), { key: `${localKey}:${projectLearner.uid}` });
    await page.reload();
    await openTaskManager(page, 'Python');
    await expect(page.locator('.project-ide-topbar')).toContainText('Task Representation');
    await expect(page.getByRole('button', { name: /Project Setup Completed/ })).toBeVisible();
    await expect(page.locator('.view-lines')).toContainText(marker);
    await expect(page.locator('.view-lines')).not.toContainText('stale-local');
  });

  test('migrates an existing local active project when cloud state is absent', async ({ page, projectLearner }) => {
    const marker = 'local-migration-browser-marker';
    await page.evaluate(({ key, marker: value }) => localStorage.setItem(key, JSON.stringify({ 'cli-task-manager': { status: 'active', languageId: 'python', currentCheckpoint: 0, completedCheckpoints: [], files: { 'main.py': { path: 'main.py', content: `print("${value}")`, language: 'python', editable: true } }, folders: [], entryFilePath: 'main.py', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } })), { key: localKey, marker });
    await openTaskManager(page, 'Python');
    await expect(page.locator('.view-lines')).toContainText(marker);
    await expect.poll(async () => (await projectCloudState(projectLearner.uid)).files['main.py']?.content).toContain(marker);
  });

  test('rejects a stale browser save and does not display a false Saved state', async ({ page, projectLearner }) => {
    await openTaskManager(page, 'Python');
    await replaceEditorSource(page, 'print("cloud-original")\n');
    const before = await projectCloudState(projectLearner.uid);
    await adminDb.doc(`users/${projectLearner.uid}/activeProjects/cli-task-manager`).update({ revision: before.metadata.revision + 1, updatedAt: new Date().toISOString() });
    const editor = page.getByRole('textbox', { name: /editor/i }).first();
    await editor.focus(); await editor.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A'); await page.keyboard.insertText('print("stale-browser-write")\n');
    await expect(page.getByText('Conflict detected')).toBeVisible({ timeout: 30_000 });
    expect((await projectCloudState(projectLearner.uid)).files['main.py'].content).toContain('cloud-original');
  });

  test('recovers a Python runtime-generated file through cloud hydration and a second run @runtime', async ({ page, projectLearner }) => {
    test.setTimeout(360_000);
    await openTaskManager(page, 'Python'); await replaceEditorSource(page, pythonSource);
    await expect(await runProjectAndShowOutput(page)).toContainText('cloud-runtime-task', { timeout: 90_000 });
    await expect.poll(async () => (await projectCloudState(projectLearner.uid)).files['tasks.json']?.content).toContain('cloud-runtime-task');
    await reopenTaskManagerFromCloud(page, 'Python', projectLearner.uid);
    await page.getByRole('button', { name: /Project Setup Completed/ }).click();
    const workspaceNavigation = page.getByRole('button', { name: 'Files and checkpoints' });
    if (!(await page.getByRole('tree', { name: /files$/ }).isVisible())) await workspaceNavigation.click();
    await expect(page.getByRole('treeitem').filter({ hasText: 'tasks.json' })).toBeVisible();
    await expect(await runProjectAndShowOutput(page)).toContainText('cloud-runtime-task', { timeout: 90_000 });
  });

  test('recovers a C++ runtime-generated file through cloud hydration and a second run @runtime', async ({ page, projectLearner }) => {
    test.setTimeout(360_000);
    await openTaskManager(page, 'C++'); await replaceEditorSource(page, cppSource);
    await runCppAfterColdToolchainWarmup(page, 'cloud-cpp-task');
    await expect.poll(async () => (await projectCloudState(projectLearner.uid)).files['tasks.txt']?.content).toContain('cloud-cpp-task');
    await reopenTaskManagerFromCloud(page, 'C++', projectLearner.uid);
    await page.getByRole('button', { name: /Project Setup Completed/ }).click();
    const workspaceNavigation = page.getByRole('button', { name: 'Files and checkpoints' });
    if (!(await page.getByRole('tree', { name: /files$/ }).isVisible())) await workspaceNavigation.click();
    await expect(page.getByRole('treeitem').filter({ hasText: 'tasks.txt' })).toBeVisible();
    await runCppAfterColdToolchainWarmup(page, 'cloud-cpp-task');
  });
});
