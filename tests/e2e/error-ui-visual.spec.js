import { expect, test } from '@playwright/test';

const sizes = [1440, 820, 390];
const themes = ['light', 'dark'];
const surfaces = ['course', 'project', 'practice', 'challenge', 'compiler', 'notfound', 'panel', 'compact'];
const fixture = (surface, theme) => `/tests/e2e/error-ui-visual.html?surface=${surface}&theme=${theme}`;

for (const width of sizes) for (const theme of themes) {
  test(`shared error layouts at ${width}px in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const surface of surfaces) {
      await page.goto(fixture(surface, theme));
      const state = page.locator('.error-state');
      await expect(state).toBeVisible();
      const typography = await state.evaluate((node) => ({
        heading: getComputedStyle(node.querySelector('h1,h2')).fontSize,
        description: getComputedStyle(node.querySelector('.error-state__description')).fontSize,
        reference: node.querySelector('.error-state__reference') ? getComputedStyle(node.querySelector('.error-state__reference')).fontSize : null,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      }));
      expect(typography).toMatchObject({ heading: '24px', description: '16px', overflow: false });
      if (surface === 'course') expect(typography.reference).toBe('14px');
      await expect(state.locator('.error-state__actions button').first()).toBeVisible();
    }
    await page.goto(fixture('normal-title', theme));
    const normalTitleSize = await page.getByRole('heading', { name: 'Normal page title' }).evaluate((node) => getComputedStyle(node).fontSize);
    expect(normalTitleSize).toBe(width === 1440 ? '43.2px' : '32px');
  });

  test(`certificate modal and compiler landing at ${width}px in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(fixture('certificate', theme));
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('region', { name: 'Certificate preview' })).toBeVisible();
    await expect(dialog.getByRole('complementary', { name: 'Credential details' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Close certificate viewer' })).toBeVisible();
    const certificate = await page.evaluate(() => ({
      heading: getComputedStyle(document.querySelector('#certificate-viewer-title')).fontSize,
      value: getComputedStyle(document.querySelector('.certificate-viewer-details dd')).fontSize,
      label: getComputedStyle(document.querySelector('.certificate-viewer-details dt')).fontSize,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    }));
    expect(certificate).toEqual({ heading: '24px', value: '16px', label: '14px', overflow: false });

    await page.goto(fixture('landing', theme));
    await expect(page.getByRole('heading', { name: 'YCoders Online Compiler' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Python' })).toBeVisible();
    const landing = await page.evaluate(() => ({
      heading: getComputedStyle(document.querySelector('.standalone-compiler-index__hero h1')).fontSize,
      subtitle: getComputedStyle(document.querySelector('.standalone-compiler-index__hero p')).fontSize,
      card: getComputedStyle(document.querySelector('.standalone-compiler-index__language')).fontSize,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    }));
    expect(landing).toEqual({ heading: '24px', subtitle: '16px', card: '16px', overflow: false });
    await page.getByRole('button', { name: 'Python' }).click();
    await expect(page).toHaveURL(/#.*python/);
  });
}
