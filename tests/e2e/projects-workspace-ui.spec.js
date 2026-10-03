import { expect } from '@playwright/test';
import { openTaskManager, test } from './fixtures/authenticated-projects.js';

test.describe('Projects workspace focused UI', () => {
  test('keeps the editor visible, stacks navigation, and runs only the configured terminal command', async ({ page, projectLearner: _projectLearner }) => {
    test.skip(test.info().project.name === 'mobile-chromium', 'Desktop workspace composition is covered by the dedicated 760px smoke.');
    await openTaskManager(page, 'JavaScript');
    await expect(page.locator('.project-editor-pane')).toBeVisible();
    await expect(page.locator('.project-files-section')).toBeVisible();
    const explorerHeaderBox = await page.locator('.project-files-section>header').boundingBox();
    const explorerRootBox = await page.locator('.project-tree-root').boundingBox();
    expect(explorerHeaderBox).not.toBeNull();
    expect(explorerRootBox?.y).toBeGreaterThanOrEqual(explorerHeaderBox.y + explorerHeaderBox.height - 1);
    await expect(page.locator('.project-checkpoints-section')).not.toBeAttached();
    await page.getByRole('button', { name: 'Checkpoints' }).click();
    await expect(page.locator('.project-checkpoints-section')).toBeVisible();
    await expect(page.locator('.project-files-section')).not.toBeAttached();
    await page.getByRole('button', { name: 'Explorer' }).click();
    await expect(page.locator('.project-ide-topbar')).not.toContainText(/\d+\s*\/\s*\d+.*Python/);
    await expect(page.getByRole('button', { name: 'Run', exact: true })).toHaveCSS('background-color', 'rgb(37, 99, 235)');

    const guideHeading = page.locator('.project-guide-content h2');
    await guideHeading.evaluate((node) => { const selection = window.getSelection(); const range = document.createRange(); range.selectNodeContents(node); selection.removeAllRanges(); selection.addRange(range); });
    await guideHeading.dispatchEvent('mouseup');
    await expect(page.getByRole('tab', { name: 'Guide' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'AI' })).toHaveAttribute('aria-selected', 'false');
    const guideAskAi = page.getByRole('button', { name: 'Ask AI' });
    await expect(guideAskAi).toHaveCSS('white-space', 'nowrap');
    await expect(guideAskAi).toHaveCSS('display', 'flex');
    await guideAskAi.click();
    await expect(page.getByRole('tab', { name: 'AI' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.project-ai-context-preview')).toContainText('guide text');
    await page.getByRole('tab', { name: 'Guide' }).click();

    await page.getByRole('treeitem').filter({ hasText: 'index.js' }).getByRole('button').first().click();
    const editor = page.getByRole('textbox', { name: /implementation editor/i });
    await editor.focus();
    await editor.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.insertText('console.log("Task Manager browser smoke");\n');
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Run', exact: true }).click();
    await page.getByRole('tab', { name: 'output' }).click();
    await expect(page.getByRole('tabpanel')).toContainText('Task Manager browser smoke', { timeout: 30_000 });

    await page.getByRole('tab', { name: 'terminal' }).click();
    const command = page.getByRole('textbox', { name: 'Project terminal command' });
    await command.fill('pip install requests');
    await command.press('Enter');
    await expect(page.getByRole('log')).toContainText('Command not available in this project.');
    await command.fill('node index.js');
    await command.press('Enter');
    await expect(page.getByRole('log')).toContainText('$ node index.js');
    await expect(page.getByRole('log')).toContainText('Command completed successfully.', { timeout: 30_000 });
    await expect(page.getByRole('log')).not.toContainText('Task Manager browser smoke');
    await expect(page.getByRole('log')).not.toContainText('Running project…', { timeout: 90_000 });
    await expect(command).toBeFocused();
    await page.getByRole('tab', { name: 'output' }).click();
    const terminalOutput = page.getByRole('tabpanel').locator('pre').filter({ hasText: 'Task Manager browser smoke' }).last();
    await terminalOutput.evaluate((node) => { const selection = window.getSelection(); const range = document.createRange(); range.selectNodeContents(node); selection.removeAllRanges(); selection.addRange(range); });
    await terminalOutput.dispatchEvent('mouseup');
    await expect(page.getByRole('button', { name: 'Ask AI' })).toBeVisible();
    await page.getByRole('button', { name: 'Ask AI' }).click();
    await expect(page.getByRole('tab', { name: 'AI' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.project-ai-context-preview')).toContainText('terminal output');
  });

  test('keeps the editor usable at a narrow tablet viewport', async ({ page, projectLearner: _projectLearner }) => {
    test.skip(test.info().project.name === 'mobile-chromium', 'This test sets and verifies its own narrow viewport.');
    await page.setViewportSize({ width: 760, height: 820 });
    await openTaskManager(page, 'Python');
    await page.getByRole('button', { name: 'Explorer' }).click();
    const editor = page.locator('.project-editor-pane');
    const box = await editor.boundingBox();
    expect(box?.width).toBeGreaterThan(300);
    expect(box?.height).toBeGreaterThan(250);
    await page.getByRole('tab', { name: 'terminal' }).click();
    await expect(page.getByRole('textbox', { name: 'Project terminal command' })).toBeFocused();
  });
});
