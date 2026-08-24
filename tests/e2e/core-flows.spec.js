import { expect, test } from '@playwright/test';

const credentials = {
  email: 'browser-learner@example.test',
  password: 'BrowserTest123!',
};

async function ensureEmulatorUser(request) {
  const response = await request.post(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key',
    { data: { email: credentials.email, password: credentials.password, returnSecureToken: true } },
  );
  if (!response.ok()) {
    const body = await response.json();
    expect(body.error?.message).toBe('EMAIL_EXISTS');
  }
}

async function signIn(page, request) {
  await ensureEmulatorUser(request);
  await page.goto('/');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
  await page.getByRole('button', { name: /^Sign in/ }).click();
  await expect(page.getByRole('heading', { name: /Welcome back/i })).toBeVisible({ timeout: 60_000 });
}

async function openShellPage(page, name) {
  const menuButton = page.getByRole('button', { name: 'Open navigation' });
  if (await menuButton.isVisible()) await menuButton.click();
  await page.getByRole('button', { name: new RegExp(name, 'i') }).first().click();
}

test.describe('authenticated core journeys', () => {
  test('loads the shell, Home, a course overview, and the learning workspace', async ({ page, request }) => {
    await signIn(page, request);
    await expect(page.getByRole('main')).toBeVisible();
    const continueLearning = page.getByLabel('Continue Learning').getByRole('button', { name: 'Continue Learning' });
    await continueLearning.scrollIntoViewIfNeeded();
    await continueLearning.click();
    await expect(page.getByRole('heading', { level: 1, name: 'Getting started with Python' })).toBeVisible();
    const enterCourse = page.locator('.overview-primary-action');
    await enterCourse.click();
    await expect(page.getByLabel('Lesson content and navigation')).toBeVisible();
    const lessonButtons = page.locator('.lesson-item:not([disabled])');
    if (await lessonButtons.count() > 1) {
      await lessonButtons.nth(1).click();
      await expect(lessonButtons.nth(1)).toHaveAttribute('aria-current', 'page');
    }
  });

  test('loads and paginates the local Practice catalog', async ({ page, request }) => {
    await signIn(page, request);
    await openShellPage(page, 'Practice');
    await expect(page.getByRole('heading', { name: 'Practice' })).toBeVisible();
    const catalog = page.getByRole('region', { name: '24 questions' });
    await expect(catalog).toBeVisible();
    await catalog.getByRole('button', { name: 'Load more questions' }).click();
    await expect(page.getByRole('region', { name: '48 questions' })).toBeVisible();
  });

  test('executes Python in the built Practice workspace @runtime', async ({ page, request }) => {
    await signIn(page, request);
    await openShellPage(page, 'Practice');
    await page.getByRole('button', { name: /Create a User Label/ }).click();
    await expect(page.getByRole('button', { name: /Back to Practice/ })).toBeVisible();
    await expect(page.getByLabel('Code workspace')).toBeVisible();
    const editor = page.getByRole('textbox', { name: /code editor/i });
    await editor.focus();
    await editor.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.insertText('print("browser-python-ok")');
    await page.getByRole('button', { name: 'Run code' }).click();
    await expect(page.getByText('browser-python-ok', { exact: true })).toBeVisible({ timeout: 90_000 });
  });

  test('shows settings persistence feedback and restores the saved value after reload', async ({ page, request }) => {
    await signIn(page, request);
    await openShellPage(page, 'Settings');
    await expect(page.getByRole('heading', { name: 'Make MiTutora yours.' })).toBeVisible();
    await page.getByRole('button', { name: /Appearance/ }).click();
    const darkTheme = page.getByRole('radio', { name: /Dark Theme/ });
    await darkTheme.click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole('heading', { name: 'Make MiTutora yours.' })).toBeVisible();
    await page.getByRole('button', { name: /Appearance/ }).click();
    await expect(page.getByRole('radio', { name: /Dark Theme/ })).toHaveAttribute('aria-checked', 'true');
  });

  test('executes Java in the built browser workspace @runtime', async ({ page, request }) => {
    await signIn(page, request);
    await page.getByRole('button', { name: 'Languages' }).click();
    await page.getByRole('button', { name: 'Java', exact: true }).click();
    const javaCard = page.getByRole('article').filter({ hasText: 'Java Basics' });
    await javaCard.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Java Basics' })).toBeVisible();
    await page.locator('.overview-primary-action').click();
    const editor = page.getByRole('textbox', { name: /code editor/i });
    await editor.focus();
    await editor.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.insertText('public class Main { public static void main(String[] args) { System.out.println("browser-java-ok"); } }');
    await page.getByRole('button', { name: 'Run code' }).click();
    await expect(page.getByText('browser-java-ok', { exact: true })).toBeVisible({ timeout: 90_000 });
  });
});
