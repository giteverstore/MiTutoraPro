import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const homeCss = readFileSync('src/styles/pages/home.css', 'utf8');

describe('Library UI polish', () => {
  it('uses the requested light border for discovery, sections, and Library cards', () => {
    expect(homeCss).toMatch(/\.library-main \.home-discovery-bar\s*\{[^}]*border-color:\s*#d3dce6;/s);
    expect(homeCss).toMatch(/\.library-main \.library-language-section\s*\{[^}]*border-color:\s*#d3dce6;/s);
    expect(homeCss).toMatch(/\.library-main \.library-course-card\s*\{[^}]*border-color:\s*#d3dce6;/s);
  });

  it('changes only inactive chip borders and preserves active and hover surfaces', () => {
    expect(homeCss).toMatch(/\.library-main \.home-filter-list button:not\(\.is-active\)\s*\{[^}]*border-color:\s*#d3dce6;/s);
    expect(homeCss).toMatch(/\.home-filter-list button\.is-active\s*\{[^}]*background:\s*var\(--color-accent\);[^}]*border-color:\s*var\(--color-accent\);/s);
    expect(homeCss).toMatch(/\.library-main \.home-filter-list button:not\(\.is-active\):hover,[\s\S]*?border-color:\s*var\(--color-accent\);/s);
    const inactiveRule = homeCss.match(/\.library-main \.home-filter-list button:not\(\.is-active\)\s*\{([^}]*)\}/s)?.[1] ?? '';
    expect(inactiveRule).not.toMatch(/background/);
  });

  it('uses the requested resting search border and preserves its focused state', () => {
    expect(homeCss).toMatch(/\.library-main \.home-course-search\s*\{[^}]*border-color:\s*#d3dce6;/s);
    expect(homeCss).toMatch(/\.library-main \.home-course-search:focus-within\s*\{[^}]*border-color:\s*var\(--color-accent\);[^}]*box-shadow:\s*0 0 0 3px var\(--color-focus\);/s);
  });

  it('matches the Home progress treatment without changing the shared component', () => {
    expect(homeCss).toMatch(/\.library-main \.library-course-divider,[\s\S]*?\.library-course-progress\s*\{[^}]*background:\s*#d3dce6;/s);
    expect(homeCss).toMatch(/\.library-main \.library-course-progress-base\s*\{[^}]*fill:\s*#d3dce6;/s);
    expect(homeCss).toMatch(/\.library-main \.library-course-progress-border\s*\{[^}]*display:\s*none;/s);
    expect(readFileSync('src/styles/components/progress-circle.css', 'utf8')).not.toContain('#d3dce6');
  });

  it('keeps the Coming Soon scrollbar visible but compact across engines', () => {
    expect(homeCss).toMatch(/\.library-coming-soon-strip\s*\{[^}]*overflow-x:\s*auto;[^}]*scrollbar-width:\s*thin;/s);
    expect(homeCss).toMatch(/\.library-coming-soon-strip::\-webkit-scrollbar\s*\{[^}]*height:\s*6px;/s);
    expect(homeCss).toMatch(/\.library-coming-soon-strip::\-webkit-scrollbar-thumb\s*\{[^}]*background:\s*var\(--color-border-strong\);/s);
  });

  it('uses theme-safe dark borders without changing backgrounds', () => {
    expect(homeCss).toMatch(/\[data-theme="dark"\] \.library-main :is\([^)]*\.library-course-card\)\s*\{[^}]*border-color:\s*var\(--color-border\);/s);
    expect(homeCss).toMatch(/\[data-theme="dark"\] \.library-main \.home-filter-list button:not\(\.is-active\)\s*\{[^}]*border-color:\s*var\(--color-border\);/s);
  });
});
