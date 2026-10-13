import { expect, test } from '@playwright/test';

const routes = [
  { name: 'Project not-found', path: '/projects/not-a-real-project-id', heading: 'Project not found.' },
  { name: 'Practice failure', path: '/practice/not-a-real-question-id', heading: 'This question couldn’t be loaded.' },
  { name: 'public 404', path: '/not-a-real-route', heading: 'Page not found' },
  { name: 'compiler unknown-language', path: '/__compiler/not-a-language', heading: 'Compiler not found' },
];

for (const width of [1440, 820, 390]) for (const theme of ['light', 'dark']) {
  test(`real route error headings at ${width}px in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript((appearance) => {
      document.documentElement.dataset.theme = appearance;
      localStorage.setItem('ycoders.standaloneCompiler.preferences', JSON.stringify({ appearance }));
    }, theme);
    await page.route('**/api/admin-content/public**', (route) => route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'content/not-published' } }),
    }));

    for (const { name, path, heading } of routes) {
      await page.goto(path);
      const state = page.locator('.error-state');
      await expect(state.getByRole('heading', { name: heading })).toBeVisible({ timeout: 20_000 });
      const result = await state.evaluate((node) => ({
        heading: getComputedStyle(node.querySelector('h1, h2')).fontSize,
        description: getComputedStyle(node.querySelector('.error-state__description')).fontSize,
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
      }));
      expect(result, name).toEqual({ heading: '24px', description: '16px', overflow: false });
    }
  });
}
