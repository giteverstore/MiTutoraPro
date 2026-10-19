import { expect, test } from '@playwright/test';

test.skip(!process.env.COURSE_HERO_VISUAL_CHECK, 'Run explicitly for the local learner UI visual check.');

test('Project cards and overview keep the Course rhythm at four viewport widths', async ({ page }) => {
  await page.route('**/api/admin-content/public/simple-calculator', (route) => route.fulfill({
    status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'content/not-published' } }),
  }));
  for (const [width, columns] of [[1440, 4], [1024, 2], [820, 2], [390, 1]]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/projects');
    await expect(page.locator('.project-card').first()).toBeVisible();
    const card = page.locator('.project-card').first();
    await expect(card.locator('.project-card-description, .project-card-action')).toHaveCount(0);
    await expect(card.getByRole('img', { name: /Project progress 0 percent/ })).toBeVisible();
    const metrics = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.project-card')];
      const first = cards[0].getBoundingClientRect();
      return {
        columns: getComputedStyle(document.querySelector('.project-grid')).gridTemplateColumns.split(' ').length,
        cardWidth: first.width,
        cardHeight: first.height,
        overflowing: document.documentElement.scrollWidth > innerWidth + 1,
      };
    });
    expect(metrics.columns).toBe(columns);
    if (width > 640) expect(metrics.cardWidth).toBeLessThanOrEqual(237);
    else expect(metrics.cardWidth).toBeLessThanOrEqual(width);
    expect(metrics.cardHeight).toBe(334);
    expect(metrics.overflowing).toBe(false);
    const lightSurface = await card.evaluate((node) => getComputedStyle(node).backgroundColor);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    const darkSurface = await card.evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(darkSurface).not.toBe(lightSurface);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
    await card.click();
    await expect(page.locator('.project-overview-hero')).toBeVisible();
    const heroHeight = await page.locator('.project-overview-hero').evaluate((node) => node.getBoundingClientRect().height);
    if (width >= 1024) expect(heroHeight).toBe(300);
    else expect(heroHeight).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  }
});
