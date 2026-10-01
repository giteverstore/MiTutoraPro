import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const credentials = {
  email: 'accessibility-learner@example.test',
  password: 'Accessibility123!',
};

async function signIn(page, request) {
  const response = await request.post(
    'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key',
    { data: { email: credentials.email, password: credentials.password, returnSecureToken: true } },
  );
  if (!response.ok()) {
    const body = await response.json();
    expect(body.error?.message).toBe('EMAIL_EXISTS');
  }
  await page.goto('/login');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
  await page.getByRole('button', { name: /^Sign in/ }).click();
  await expect(page.locator('#application-page')).toBeVisible({ timeout: 60_000 });
}

async function highImpactViolations(page, label) {
  await page.locator('body').waitFor({ state: 'visible' });
  await page.evaluate(async () => {
    await document.fonts?.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations
    .filter(({ impact }) => impact === 'critical' || impact === 'serious')
    .map(({ id, nodes }) => `${label}: ${id} (${nodes.length}) ${nodes.map((node) => node.target.join(' ')).join(', ')}`);
}

async function tabUntilFocused(page, locator, attempts = 12) {
  for (let index = 0; index < attempts; index += 1) {
    if (await locator.evaluate((element) => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(locator).toBeFocused();
}

test.describe('real-browser accessibility matrix', () => {
  test('public, auth, catalog, and standalone compiler routes have no high-impact axe findings', async ({ page }) => {
    const findings = [];
    const routes = [
      ['Landing', '/'],
      ['Sign in', '/login'],
      ['Sign up', '/signup'],
      ['Library', '/library'],
      ['Practice', '/practice'],
      ['Projects', '/projects'],
      ['Standalone compiler', '/__compiler/python'],
    ];
    for (const [label, route] of routes) {
      await page.goto(route);
      findings.push(...await highImpactViolations(page, label));
    }
    expect(findings).toEqual([]);
  });

  test('authenticated application routes have no high-impact axe findings', async ({ page, request }) => {
    await signIn(page, request);
    const findings = [];
    const routes = [
      ['Home', '/home'],
      ['Library', '/library'],
      ['Practice', '/practice'],
      ['Challenges', '/challenges'],
      ['Projects', '/projects'],
      ['Bookmarks', '/bookmarks'],
      ['Certificates', '/certificates'],
      ['Referrals', '/referrals'],
      ['Wallet', '/wallet'],
      ['Redeem', '/redeem'],
      ['Settings', '/settings'],
    ];
    for (const [label, route] of routes) {
      await page.goto(route);
      await expect(page.locator('#application-page')).toBeVisible();
      findings.push(...await highImpactViolations(page, label));
    }
    expect(findings).toEqual([]);
  });

  test('keyboard users can skip navigation and operate the auth and compiler controls', async ({ page, request }) => {
    await page.goto('/login');
    await tabUntilFocused(page, page.getByLabel('Email'));
    await page.goto('/__compiler/python');
    const languageButton = page.getByRole('button', { name: 'Python', exact: true });
    await languageButton.focus();
    await expect(languageButton).toBeFocused();
    await languageButton.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(languageButton).toBeFocused();

    await signIn(page, request);
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skipLink).toBeFocused();
    await skipLink.press('Enter');
    await expect(page.locator('#application-page')).toBeFocused();
  });
});
