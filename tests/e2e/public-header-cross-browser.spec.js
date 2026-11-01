import { expect, test } from '@playwright/test';

const desktopWidths = [1100, 1199, 1200, 1280, 1366, 1440];

test.describe('@cross-browser public header layout', () => {
  for (const width of desktopWidths) {
    test(`keeps navigation controls on one line at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await page.evaluate(async () => {
        await document.fonts?.ready;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });

      const header = page.locator('.marketing-header');
      const navigation = page.locator('.marketing-navigation');
      const authActions = page.locator('.marketing-auth-actions');
      const login = page.getByRole('button', { name: 'Login', exact: true });
      const signUp = page.getByRole('button', { name: 'Sign Up', exact: true });
      const compilers = page.getByRole('button', { name: 'Online Compilers', exact: true });

      await expect(header).toBeVisible();
      for (const control of [login, signUp, compilers]) {
        await expect(control).toHaveCSS('white-space', 'nowrap');
        const metrics = await control.evaluate((element) => ({
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
        }));
        expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
      }

      expect((await signUp.boundingBox()).height).toBeLessThanOrEqual(48);
      const layout = await page.evaluate(() => {
        const bounds = (selector) => document.querySelector(selector).getBoundingClientRect();
        const headerBounds = bounds('.marketing-header');
        const navigationBounds = bounds('.marketing-navigation');
        const authBounds = bounds('.marketing-auth-actions');
        const authElement = document.querySelector('.marketing-auth-actions');
        return {
          documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          headerOverflow: Math.max(0, navigationBounds.right - headerBounds.right),
          authOverflow: authElement.scrollWidth - authElement.clientWidth,
          authWithinNavigation: authBounds.right <= navigationBounds.right + 1,
        };
      });

      expect(layout.documentOverflow).toBeLessThanOrEqual(1);
      expect(layout.headerOverflow).toBeLessThanOrEqual(1);
      expect(layout.authOverflow).toBeLessThanOrEqual(1);
      expect(layout.authWithinNavigation).toBe(true);
      await expect(navigation).toBeVisible();
      await expect(authActions).toBeVisible();
    });
  }
});

test('mobile public header retains its collapsed navigation', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
  await expect(page.locator('.marketing-navigation')).toBeHidden();
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await expect(page.locator('.marketing-navigation')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign Up', exact: true })).toBeVisible();
});
