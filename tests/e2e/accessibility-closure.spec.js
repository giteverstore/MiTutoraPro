import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const credentials = { email: 'accessibility-closure@example.test', password: 'Accessibility123!' };

async function signIn(page, request) {
  const response = await request.post('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key', {
    data: { ...credentials, returnSecureToken: true },
  });
  if (!response.ok()) expect((await response.json()).error?.message).toBe('EMAIL_EXISTS');
  await page.goto('/login');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
  await page.getByRole('button', { name: /^Sign in/ }).click();
  await expect(page.locator('#application-page')).toBeVisible({ timeout: 60_000 });
}

async function scan(page, label) {
  await page.evaluate(async () => {
    await document.fonts?.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return results.violations
    .filter(({ impact }) => ['critical', 'serious'].includes(impact))
    .map(({ id, nodes }) => `${label}: ${id} (${nodes.length}) ${nodes.map((node) => `${node.target.join(' ')} [${node.any?.map(({ message }) => message).join(' | ')}]`).join(', ')}`);
}

async function openLearning(page) {
  await page.goto('/library');
  await page.getByRole('button', { name: 'Languages' }).click();
  await page.getByRole('button', { name: 'Java', exact: true }).click();
  const javaCard = page.getByRole('link').filter({ hasText: 'Java Basics' });
  await javaCard.click();
  await page.locator('.overview-primary-action').click();
  await expect(page.getByLabel('Lesson content and navigation')).toBeVisible();
}

async function openProject(page) {
  await page.goto('/projects');
  await page.getByRole('button', { name: 'View Project' }).first().click();
  await page.getByRole('button', { name: 'Start Project' }).click();
  await expect(page.getByRole('tree')).toBeVisible();
}

async function enableDarkTheme(page) {
  await page.goto('/settings');
  await page.getByRole('button', { name: /Appearance/ }).click();
  await page.getByRole('radio', { name: /Dark Theme/ }).click();
  await expect(page.getByRole('radio', { name: /Dark Theme/ })).toHaveAttribute('aria-checked', 'true');
}

test.describe('accessibility closure surfaces', () => {
  test('scans the live Learning Engine and validates lesson progress semantics', async ({ page, request }) => {
    await signIn(page, request);
    await openLearning(page);
    expect(await scan(page, 'Learning Engine')).toEqual([]);
    await expect(page.getByRole('progressbar', { name: /Lesson progress:/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Complete Lesson/i })).toBeVisible();
    const lessons = page.locator('.lesson-item:not([disabled])');
    if (await lessons.count() > 1) {
      await lessons.nth(1).focus();
      await lessons.nth(1).press('Enter');
      await expect(lessons.nth(1)).toHaveAttribute('aria-current', 'page');
    }
  });

  test('scans an opened Project Workspace and exercises tabs and splitters', async ({ page, request }) => {
    await signIn(page, request);
    await openProject(page);
    expect(await scan(page, 'Project Workspace')).toEqual([]);
    const resultTab = page.getByRole('tab', { name: 'output' });
    await resultTab.focus();
    await resultTab.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'problems' })).toHaveAttribute('aria-selected', 'true');
    const assistance = page.getByRole('tab', { name: 'Guide' });
    await assistance.focus();
    await assistance.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'AI' })).toHaveAttribute('aria-selected', 'true');
    for (const name of ['Resize left panel', 'Resize Guide and AI', 'Resize bottom panel']) {
      const splitter = page.getByRole('separator', { name });
      const before = Number(await splitter.getAttribute('aria-valuenow'));
      await splitter.focus();
      await splitter.press(name === 'Resize bottom panel' ? 'ArrowUp' : 'ArrowRight');
      expect(Number(await splitter.getAttribute('aria-valuenow'))).not.toBe(before);
    }
  });

  test('runs the representative dark-mode matrix', async ({ page, request }) => {
    await signIn(page, request);
    await enableDarkTheme(page);
    const findings = [];
    for (const route of ['/home', '/library', '/practice', '/challenges', '/projects', '/settings']) {
      await page.goto(route);
      findings.push(...await scan(page, `Dark ${route}`));
    }
    await openLearning(page);
    findings.push(...await scan(page, 'Dark Learning Engine'));
    await openProject(page);
    findings.push(...await scan(page, 'Dark Project Workspace'));
    await page.goto('/__compiler/python');
    findings.push(...await scan(page, 'Dark standalone compiler'));
    expect(findings).toEqual([]);
  });

  test('checks representative mobile and 200-percent reflow surfaces', async ({ page, request }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const route of ['/login', '/library', '/practice', '/__compiler/python']) {
      await page.goto(route);
      expect(await scan(page, `Mobile ${route}`)).toEqual([]);
    }
    await signIn(page, request);
    await openLearning(page);
    expect(await scan(page, 'Mobile Learning Engine')).toEqual([]);

    await page.setViewportSize({ width: 640, height: 720 });
    for (const route of ['/home', '/practice', '/settings', '/__compiler/python']) {
      await page.goto(route);
      expect(await scan(page, `200% reflow ${route}`)).toEqual([]);
      if (!route.startsWith('/__compiler')) {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(2);
      }
    }

    await page.addStyleTag({ content: '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }' });
    expect(await scan(page, 'Text spacing standalone compiler')).toEqual([]);
  });

  test('spot-checks tablet Learning Engine and Project Workspace layouts', async ({ page, request }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await signIn(page, request);
    await openLearning(page);
    expect(await scan(page, 'Tablet Learning Engine')).toEqual([]);
    await openProject(page);
    expect(await scan(page, 'Tablet Project Workspace')).toEqual([]);
  });
});
