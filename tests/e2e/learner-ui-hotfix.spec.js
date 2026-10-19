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
    expect(metrics.cardHeight).toBe(350);
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

test('Course and Project footers share clear metadata and Coming Soon geometry', async ({ page }) => {
  await page.route('**/api/admin-content/public/simple-calculator', (route) => route.fulfill({
    status: 404, contentType: 'application/json', body: JSON.stringify({ error: { code: 'content/not-published' } }),
  }));
  for (const width of [1440, 1024, 820, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/library');
    const courseCard = page.locator('.library-course-card').filter({ hasText: 'Python Foundations' }).first();
    const courseSoon = page.locator('.library-course-card.is-unavailable').first();
    const comingSoonCards = page.locator('.library-coming-soon-section .library-course-card');
    await expect(comingSoonCards).toHaveCount(6);
    expect(await comingSoonCards.locator('h3').allTextContents()).toEqual([
      'C Programming', 'HTML Fundamentals for Webpage', 'CSS Fundamentals for Webpage',
      'Build Your Web App with React', 'React Beyond Basics', 'SQL Basics',
    ]);
    for (const image of await comingSoonCards.locator('.library-course-artwork img').all()) {
      await image.scrollIntoViewIfNeeded();
      await expect.poll(() => image.evaluate((node) => node.complete && node.naturalWidth > 0)).toBe(true);
    }
    await expect(courseCard.locator('.library-course-meta')).toBeVisible();
    await expect(courseSoon.locator('.card-footer-coming-soon')).toBeVisible();
    await expect(courseSoon.locator('.library-course-meta, .library-course-progress')).toHaveCount(0);
    const course = await courseCard.evaluate((node) => ({
      cardHeight: node.getBoundingClientRect().height,
      metaTop: node.querySelector('.card-footer-meta span').getBoundingClientRect().top,
      dividerTop: node.querySelector('.library-course-divider').getBoundingClientRect().top,
      metaRight: node.querySelector('.card-footer-meta').getBoundingClientRect().right,
      cardRight: node.getBoundingClientRect().right,
    }));
    expect(course.cardHeight).toBeCloseTo(334, 1);
    expect(course.metaTop).toBeGreaterThan(course.dividerTop + 15);
    expect(course.metaRight).toBeLessThanOrEqual(course.cardRight);

    await page.goto('/projects');
    const projectCard = page.locator('.project-card').filter({ hasText: 'Simple Calculator' }).first();
    const projectSoon = page.locator('.project-card.is-coming-soon').first();
    await expect(projectCard.locator('.project-card-meta')).toBeVisible();
    await expect(projectSoon.locator('.card-footer-coming-soon')).toBeVisible();
    await projectCard.evaluate((node) => {
      const [duration, checkpoints] = node.querySelectorAll('.project-card-meta span');
      duration.lastChild.textContent = '600 min';
      checkpoints.lastChild.textContent = '8 checkpoints';
    });
    const project = await projectCard.evaluate((node) => {
      const meta = node.querySelector('.card-footer-meta');
      const circle = node.querySelector('.library-course-progress');
      return {
        cardHeight: node.getBoundingClientRect().height,
        metaTop: meta.firstElementChild.getBoundingClientRect().top,
        metaContentRight: meta.lastElementChild.getBoundingClientRect().right,
        cardRight: node.getBoundingClientRect().right,
        circleBottom: circle?.getBoundingClientRect().bottom ?? 0,
        languageBottom: node.querySelector('.project-card-languages')?.getBoundingClientRect().bottom ?? 0,
        languageTop: node.querySelector('.project-card-languages')?.getBoundingClientRect().top ?? 0,
        languageWidth: node.querySelector('.project-card-languages')?.getBoundingClientRect().width ?? 0,
      };
    });
    expect(project.cardHeight).toBeCloseTo(course.cardHeight + 16, 1);
    expect(project.metaTop).toBeGreaterThanOrEqual(project.circleBottom);
    expect(project.languageTop).toBeGreaterThanOrEqual(project.circleBottom);
    expect(project.metaTop).toBeGreaterThanOrEqual(project.languageBottom);
    expect(project.languageWidth).toBeGreaterThan(0);
    expect(project.metaContentRight).toBeLessThan(project.cardRight);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  }
});
