import { expect, test } from '@playwright/test';

const cases = [
  ['python', 'print("x" * (2 * 1024 * 1024 + 1))', 'print("recovered")'],
  ['c', '#include <stdio.h>\nint main(void){ for(int i=0;i<2*1024*1024+1;i++) putchar(120); return 0; }', '#include <stdio.h>\nint main(void){ puts("recovered"); return 0; }'],
  ['php', '<?php\necho str_repeat("x", 2 * 1024 * 1024 + 1);\n', '<?php\necho "recovered";\n'],
  ['r', 'cat(strrep("x", 2 * 1024 * 1024 + 1))', 'cat("recovered")'],
  ['csharp', 'using System;\nclass Program { static void Main() { Console.Write(new string(\'x\', 2 * 1024 * 1024 + 1)); } }', 'using System;\nclass Program { static void Main() { Console.WriteLine("recovered"); } }'],
];

async function setSource(page, source) {
  const editor = page.locator('.monaco-editor');
  await editor.waitFor({ timeout: 90_000 });
  await editor.click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.insertText(source);
}

async function setRuntimeSource(page, language, source) {
  await setSource(page, source);
  if (language === 'php') {
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
  }
}

test.describe('browser compiler resource limits @runtime', () => {
  for (const [language, hostile, recovery] of cases) {
    test(`${language} stops excessive output, remains responsive, and recovers`, async ({ page }) => {
      await page.goto(`/__compiler/${language}`);
      await setRuntimeSource(page, language, hostile);
      await page.getByRole('button', { name: 'Run', exact: true }).click();
      await expect(page.locator('.standalone-result-status')).toHaveText('Error', { timeout: 150_000 });
      await page.getByRole('tab', { name: /Errors/ }).click();
      await expect(page.locator('.standalone-terminal-content pre')).toContainText('Program stopped because it produced too much output.');
      await setRuntimeSource(page, language, recovery);
      await page.getByRole('button', { name: 'Run', exact: true }).click();
      await expect(page.locator('.standalone-result-status')).toHaveText('Success', { timeout: 150_000 });
      await expect(page.getByLabel('Program terminal')).toContainText('recovered');
    });
  }
});
