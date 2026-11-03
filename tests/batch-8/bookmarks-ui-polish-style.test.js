import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/pages/library-bookmarks.css', 'utf8');

describe('Bookmarks UI polish', () => {
  it('uses the requested neutral for the segmented surface while preserving the active tab', () => {
    expect(css).toMatch(/\.library-tabs\s*\{[^}]*background:\s*#d3dce6;/s);
    expect(css).toMatch(/\.library-tabs button\.is-active\s*\{[^}]*background:\s*var\(--color-surface\);[^}]*box-shadow:\s*var\(--shadow-xs\);/s);
  });

  it('updates resting search, list, and row borders while preserving search focus', () => {
    expect(css).toMatch(/\.library-search\s*\{[^}]*border:\s*1px solid #d3dce6;/s);
    expect(css).toMatch(/\.library-search:focus-within\s*\{[^}]*outline:\s*3px solid var\(--color-focus\);/s);
    expect(css).toMatch(/\.library-saved-items\s*\{[^}]*border:\s*1px solid #d3dce6;/s);
    expect(css).toMatch(/\.saved-item-card\s*\{[^}]*border-bottom:\s*1px solid #d3dce6;/s);
    expect(css).toMatch(/\.saved-item-card:last-child\s*\{[^}]*border-bottom:\s*0;/s);
  });

  it('uses theme-safe dark equivalents without changing geometry', () => {
    expect(css).toMatch(/\[data-theme="dark"\] \.library-tabs\s*\{[^}]*background:\s*var\(--color-surface-subtle\);[^}]*border-color:\s*var\(--color-border\);/s);
    expect(css).toMatch(/\[data-theme="dark"\] \.library-search,[\s\S]*?border-color:\s*var\(--color-border\);/s);
    expect(css).toMatch(/\[data-theme="dark"\] \.saved-item-card\s*\{[^}]*border-bottom-color:\s*var\(--color-divider\);/s);
  });
});
