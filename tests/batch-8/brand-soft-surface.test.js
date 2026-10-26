import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('brand-aware learner soft surfaces', () => {
  it('uses the semantic surface in the Daily Challenge calendar without replacing state colors', async () => {
    const css = await readFile(resolve('src/styles/pages/home.css'), 'utf8');
    expect(css).toMatch(/\.challenge-calendar-redeem \.coin-balance-badge \{[^}]*background: var\(--color-brand-soft-surface\)/);
    expect(css).toMatch(/\.challenge-calendar-navigation button:hover,[\s\S]*?background: var\(--color-brand-soft-surface\)/);
    expect(css).toMatch(/\.challenge-calendar-day\.is-past-missed \{[^}]*background: var\(--color-brand-soft-surface\)/);
    expect(css).toMatch(/\.challenge-calendar-navigation button:disabled \{[^}]*background: var\(--color-surface-subtle\)/);
    expect(css).toMatch(/\.challenge-calendar-day\.is-today-completed \{[^}]*background: var\(--color-success-soft\)/);
    expect(css).toMatch(/\.challenge-calendar-day\.is-today-incomplete \{[^}]*background: var\(--color-accent-soft\)/);
    expect(css).toMatch(/\.home-icon-button:hover \{[^}]*background: var\(--color-brand-soft-surface\)/);
    expect(css).toMatch(/\.home-course-pagination button:not\(:disabled\):hover \{[^}]*background: var\(--color-brand-soft-surface\)/);
  });

  it('uses the semantic surface for Practice catalog, pagination, and all four statistic cards', async () => {
    const css = await readFile(resolve('src/styles/pages/practice.css'), 'utf8');
    expect(css).toMatch(/\.practice-question-card:hover \{[^}]*background: var\(--color-brand-soft-surface\)/);
    expect(css).toMatch(/\.practice-pagination button:not\(:disabled\):hover \{[^}]*background: var\(--color-brand-soft-surface\)/);
    expect(css).toMatch(/\.practice-statistics article \{[^}]*background: var\(--color-brand-soft-surface\)/);
    expect(css).toMatch(/\.practice-statistics article:hover \{[^}]*background: var\(--color-brand-soft-surface\)/);
    expect(css).toMatch(/\.practice-question-card\.is-active \{[^}]*background: var\(--color-accent-soft\)/);
  });
});
