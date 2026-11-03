import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(path, 'utf8');
const theme = read('src/styles/theme.css');

describe('site-wide dark surface contract', () => {
  it('defines four semantic dark surface levels without changing fixed light values', () => {
    expect(theme).toContain('--color-surface: #ffffff;');
    expect(theme).toContain('--color-border-fixed: #F1F5F9;');
    expect(theme).toMatch(/\[data-theme="dark"\][\s\S]*--color-canvas: #121513;/);
    expect(theme).toMatch(/\[data-theme="dark"\][\s\S]*--color-surface: #1b201d;/);
    expect(theme).toMatch(/\[data-theme="dark"\][\s\S]*--color-surface-interactive: #282f2a;/);
    expect(theme).toMatch(/\[data-theme="dark"\][\s\S]*--color-surface-hover: #303832;/);
  });

  it('remaps light-fixed neutral contracts only inside dark mode', () => {
    expect(theme).toMatch(/\[data-theme="dark"\][\s\S]*--color-border-fixed: var\(--color-border\);/);
    expect(theme).toMatch(/\[data-theme="dark"\][\s\S]*--color-progress-track-fixed: var\(--color-surface-hover\);/);
    expect(theme).toMatch(/\[data-theme="dark"\][\s\S]*--color-neutral-surface-fixed: var\(--color-surface-interactive\);/);
  });

  it.each([
    ['Home and Library', 'src/styles/pages/home.css'],
    ['Practice', 'src/styles/pages/practice/page.css'],
    ['Challenges', 'src/styles/pages/challenges.css'],
    ['Projects', 'src/styles/pages/projects.css'],
    ['Bookmarks', 'src/styles/pages/library-bookmarks.css'],
    ['Certificates', 'src/styles/pages/certificates.css'],
    ['Settings', 'src/styles/pages/settings.css'],
    ['Referrals', 'src/styles/pages/referrals.css'],
    ['Wallet and Redeem', 'src/styles/pages/subscription-wallet.css'],
    ['Course Overview and Learning Engine', 'src/styles/pages/dashboard.css'],
    ['AppShell', 'src/styles/layout/app-shell.css'],
  ])('%s uses semantic dark surfaces or borders', (_name, path) => {
    const css = read(path);
    expect(css).toMatch(/dark/);
    expect(css).toMatch(/var\(--color-(surface|border|divider)/);
  });

  it('keeps shared dark fields, dropdowns, and hover surfaces consistent', () => {
    expect(read('src/design-system/primitives.css')).toContain('background: var(--color-surface-interactive);');
    const learnerSelect = read('src/styles/components/learner-select.css');
    expect(learnerSelect).toContain('background: var(--color-surface-interactive);');
    expect(learnerSelect).toContain('background: var(--color-surface-hover);');
  });

  it('preserves semantic and brand tokens', () => {
    for (const token of ['--color-accent:', '--color-success:', '--color-warning:', '--color-danger:', '--color-coin:']) {
      expect(theme).toContain(token);
    }
  });
});
