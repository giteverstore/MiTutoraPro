import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = (path) => readFile(resolve(path), 'utf8');

describe('fixed learner neutral borders', () => {
  it('defines one brand-independent fixed border token', async () => {
    const theme = await css('src/styles/theme.css');
    expect(theme).toContain('--color-border-fixed: #F1F5F9;');
    expect(theme.match(/--color-border-fixed:/g)).toHaveLength(1);
    for (const brand of ['ember', 'violet', 'crimson', 'cyber']) {
      const block = theme.match(new RegExp(`data-brand-theme="${brand}"[^}]*\\{([^}]*)\\}`))?.[1] ?? '';
      expect(block).not.toContain('--color-border-fixed');
    }
  });

  it.each([
    ['Home', 'src/styles/pages/home.css'],
    ['Course and Library', 'src/styles/pages/dashboard.css'],
    ['Learning Engine', 'src/styles/pages/learning-engine.css'],
    ['Practice', 'src/styles/pages/practice.css'],
    ['Challenges', 'src/styles/pages/challenges.css'],
    ['Projects', 'src/styles/pages/projects.css'],
    ['Referrals', 'src/styles/pages/referrals.css'],
    ['Wallet', 'src/styles/pages/subscription-wallet.css'],
    ['Certificates', 'src/styles/pages/certificates.css'],
    ['Settings', 'src/styles/pages/settings.css'],
    ['App shell', 'src/styles/layout/app-shell.css'],
  ])('%s ordinary component borders use the fixed token', async (_surface, path) => {
    expect(await css(path)).toContain('var(--color-border-fixed)');
  });

  it('preserves semantic state borders and Project Guide table contrast', async () => {
    const [theme, home, practice, projects] = await Promise.all([
      css('src/styles/theme.css'),
      css('src/styles/pages/home.css'),
      css('src/styles/pages/practice.css'),
      css('src/styles/pages/projects.css'),
    ]);
    expect(theme).toContain('--color-success: #3f6658;');
    expect(theme).toContain('--color-danger: #a85b56;');
    expect(theme).toContain('--difficulty-easy-base: #b8e8c5;');
    expect(home).toMatch(/\.challenge-calendar-day\.is-today-completed \{[^}]*border-color: var\(--color-success\)/);
    expect(practice).toMatch(/\.practice-topic-chips button\.is-active \{[^}]*border-color: var\(--color-accent\)/);
    expect(projects).toContain('--project-guide-table-border: #111111;');
    expect(projects).toContain('--project-guide-table-border: #d7dee7;');
    expect(projects).toContain('border-color: var(--project-guide-table-border);');
    expect(projects).toContain('--project-border: #30363d;');
  });
});
