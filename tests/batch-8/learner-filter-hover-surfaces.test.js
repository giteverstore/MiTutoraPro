import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = (path) => readFileSync(path, 'utf8');

describe('learner filter and hover surfaces', () => {
  it('restores the subtle Continue Learning hover while preserving artwork and progress styling', () => {
    const home = css('src/styles/pages/home.css');
    expect(home).not.toMatch(/\.home-continue-card:hover\s*\{[^}]*background:/s);
    expect(home).toMatch(/\.home-continue-mark\s*\{[^}]*background:\s*transparent;/s);
    expect(home).toMatch(/\.home-continue-mark img\s*\{[^}]*object-fit:\s*contain;/s);
    expect(home).toMatch(/\.home-progress-track\s*\{[^}]*background:\s*var\(--color-progress-track-fixed\);/s);
    expect(home).toMatch(/\.home-progress-track>span\s*\{[^}]*background:\s*var\(--color-accent\);/s);
  });

  it('uses the brand accent for Library and Practice chip hover borders', () => {
    const home = css('src/styles/pages/home.css');
    const practice = css('src/styles/pages/practice.css');
    expect(home).toMatch(/\.home-filter-list button:hover,[\s\S]*?\.home-filter-list button:focus-visible\s*\{[^}]*border-color:\s*var\(--color-accent\);/s);
    expect(practice).toMatch(/\.practice-topic-chips button:hover,[\s\S]*?\.practice-topic-chips button:focus-visible\s*\{[^}]*border-color:\s*var\(--color-accent\);/s);
    expect(practice).toMatch(/\.practice-topic-chips button\s*\{[^}]*border:\s*1px solid var\(--color-border-fixed\);[^}]*border-radius:\s*var\(--radius-full\);[^}]*font-size:\s*1rem;/s);
  });

  it('keeps requested selector and bookmark surfaces fixed across themes', () => {
    const theme = css('src/styles/theme.css');
    const practice = css('src/styles/pages/practice.css');
    const projects = css('src/styles/pages/projects.css');
    const bookmarks = css('src/styles/pages/library-bookmarks.css');
    expect(theme).toContain('--color-neutral-surface-fixed: #F1F5F9;');
    expect(theme.match(/--color-neutral-surface-fixed:/g)).toHaveLength(1);
    expect(theme).toContain('--color-text-on-neutral-fixed: #111111;');
    expect(theme.match(/--color-text-on-neutral-fixed:/g)).toHaveLength(1);
    expect(practice).toMatch(/\.practice-filter select,[\s\S]*?\.practice-search>div\s*\{[^}]*background:\s*var\(--color-neutral-surface-fixed\);/s);
    expect(projects).toMatch(/\.project-filters select\s*\{[^}]*background:\s*var\(--color-neutral-surface-fixed\);/s);
    expect(bookmarks).toMatch(/\.library-tabs\s*\{[^}]*background:\s*var\(--color-neutral-surface-fixed\);/s);
    expect(bookmarks).toMatch(/\.saved-item-copy>div span\s*\{[^}]*background:\s*var\(--color-neutral-surface-fixed\);/s);
  });

  it('uses the fixed border token for Challenge history actions', () => {
    const challenges = css('src/styles/pages/challenges.css');
    expect(challenges).toMatch(/\.challenge-history-list \.button--secondary\s*\{[^}]*border-color:\s*var\(--color-border-fixed\);/s);
  });
});
