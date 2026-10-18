import { expect, test } from '@playwright/test';

test.skip(!process.env.COURSE_HERO_VISUAL_CHECK, 'Run explicitly with COURSE_HERO_VISUAL_CHECK=1 and the local Course source.');

test('Course hero background fills its region while content stays aligned in light and dark themes', async ({ page }) => {
  for (const width of [1440, 820, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/courses/python');
    await expect(page.getByRole('heading', { level: 1, name: 'Python Foundations' })).toBeVisible();
    const summaryBackgrounds = [];
    for (const theme of ['light', 'dark']) {
      // The public shell is intentionally light-only. Set the existing Course shell
      // token scope to exercise the same theme values used by authenticated routes.
      await page.locator('.course-overview-shell').evaluate((element, value) => element.setAttribute('data-theme', value), theme);
      const layout = await page.evaluate(() => {
        const shell = document.querySelector('.course-overview-shell').getBoundingClientRect();
        const hero = document.querySelector('.overview-hero').getBoundingClientRect();
        const copy = document.querySelector('.overview-hero-copy').getBoundingClientRect();
        const summary = document.querySelector('.overview-hero-summary').getBoundingClientRect();
        const details = [...document.querySelectorAll('.overview-detail-card')].map((card) => card.getBoundingClientRect());
        return {
          heroHeight: hero.height, heroWidth: hero.width, copyLeft: copy.left,
          shellLeft: shell.left, shellRight: shell.right, heroLeft: hero.left, heroRight: hero.right,
          summaryLeft: summary.left, summaryRight: summary.right,
          firstDetailLeft: details[0].left, lastDetailRight: details.at(-1).right,
          detailGap: details[0].top - hero.bottom,
          overflowing: document.documentElement.scrollWidth > window.innerWidth + 1,
          summaryBackground: getComputedStyle(document.querySelector('.overview-hero-summary')).backgroundColor,
          titleColor: getComputedStyle(document.querySelector('.overview-hero h1')).color,
          descriptionColor: getComputedStyle(document.querySelector('.overview-hero-copy > p')).color,
          heroBackground: getComputedStyle(document.querySelector('.overview-hero')).backgroundImage,
        };
      });
      expect(layout.overflowing, `${width}px ${theme} should not overflow`).toBe(false);
      expect(layout.heroLeft).toBe(layout.shellLeft);
      expect(layout.heroRight).toBe(layout.shellRight);
      expect(Math.abs(layout.copyLeft - layout.firstDetailLeft), `${width}px ${theme} left alignment`).toBeLessThanOrEqual(2);
      expect(Math.abs(layout.summaryRight - layout.lastDetailRight), `${width}px ${theme} right alignment`).toBeLessThanOrEqual(2);
      expect(layout.detailGap).toBeGreaterThanOrEqual(32);
      expect(layout.detailGap).toBeLessThanOrEqual(41);
      expect(layout.titleColor).toBe('rgb(255, 255, 255)');
      expect(layout.descriptionColor).toBe('rgb(255, 255, 255)');
      expect(layout.heroBackground).toContain('linear-gradient');
      expect(layout.heroBackground).toContain('rgb(5, 7, 11)');
      expect(layout.summaryBackground).not.toBe('rgba(0, 0, 0, 0)');
      await expect(page.getByRole('button', { name: 'Dashboard' })).toHaveCount(0);
      summaryBackgrounds.push(layout.summaryBackground);
      if (width === 1440) {
        expect(layout.heroHeight).toBe(230);
        expect(layout.summaryLeft).toBeGreaterThan(layout.copyLeft);
      } else {
        expect(layout.heroHeight).toBeGreaterThan(230);
      }
      if (width === 390) await expect(page.locator('.overview-hero-metrics strong').last()).toHaveCSS('white-space', 'normal');
      await expect(page.locator('.overview-primary-action').first()).toBeVisible();
      console.log(JSON.stringify({ width, theme, ...layout }));
    }
    expect(summaryBackgrounds[0]).not.toBe(summaryBackgrounds[1]);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  const gradientColors = [];
  for (const theme of ['light', 'dark']) {
    for (const brand of ['blue', 'ember', 'violet', 'crimson', 'cyber']) {
      await page.locator('.course-overview-shell').evaluate((element, value) => {
        element.setAttribute('data-theme', value.theme);
        element.setAttribute('data-brand-theme', value.brand);
      }, { theme, brand });
      const colors = await page.locator('.overview-hero').evaluate((element) => ({
        gradient: getComputedStyle(element).backgroundImage,
        accent: getComputedStyle(element.querySelector('.overview-hero-metrics svg')).color,
        title: getComputedStyle(element.querySelector('h1')).color,
      }));
      expect(colors.gradient).toContain(colors.accent);
      expect(colors.gradient).toContain('rgb(5, 7, 11)');
      expect(colors.title).toBe('rgb(255, 255, 255)');
      gradientColors.push(colors.gradient);
    }
  }
  expect(new Set(gradientColors).size).toBe(10);
  const completedActionLayout = await page.evaluate(() => {
    const hero = document.querySelector('.overview-hero');
    const summary = document.querySelector('.overview-hero-summary');
    const bottom = document.querySelector('.overview-hero-summary-bottom');
    const actions = document.querySelector('.overview-hero-actions');
    const examAction = actions.querySelector('button').cloneNode(true);
    examAction.textContent = 'Take Online Exam';
    bottom.classList.add('has-exam-action');
    actions.appendChild(examAction);
    const heroBounds = hero.getBoundingClientRect();
    const examBounds = examAction.getBoundingClientRect();
    return {
      examVisible: examBounds.bottom <= heroBounds.bottom,
      summaryFits: summary.scrollHeight <= summary.clientHeight,
    };
  });
  expect(completedActionLayout).toEqual({ examVisible: true, summaryFits: true });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.overview-hero-grid-highlight')).toHaveCSS('display', 'none');
});
