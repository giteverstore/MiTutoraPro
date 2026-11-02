import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const homeCss = readFileSync('src/styles/pages/home.css', 'utf8');

describe('Home Recently Viewed card treatment', () => {
  it('uses the requested light border only within the Recently Viewed grid', () => {
    expect(homeCss).toMatch(/\.home-recent-grid \.library-course-card\s*\{[^}]*border-color:\s*#d3dce6;/s);
  });

  it('uses the requested color for the divider and progress-circle background', () => {
    expect(homeCss).toMatch(/\.home-recent-grid \.library-course-divider\s*\{[^}]*background:\s*#d3dce6;/s);
    expect(homeCss).toMatch(/\.home-recent-grid \.library-course-progress\s*\{[^}]*background:\s*#d3dce6;/s);
    expect(homeCss).toMatch(/\.home-recent-grid \.library-course-progress-base\s*\{[^}]*fill:\s*#d3dce6;/s);
  });

  it('removes the progress-circle border without adding a replacement ring', () => {
    expect(homeCss).toMatch(/\.home-recent-grid \.library-course-progress-border\s*\{[^}]*display:\s*none;/s);
    const scopedTreatment = homeCss.match(/\.home-recent-grid \.library-course-card\s*\{[\s\S]*?(?=@media \(min-width: 1360px\))/)?.[0] ?? '';
    expect(scopedTreatment).not.toMatch(/outline|box-shadow/);
  });

  it('uses theme-safe dark equivalents without changing geometry', () => {
    expect(homeCss).toMatch(/\.application-shell\[data-theme="dark"\] \.home-recent-grid \.library-course-card\s*\{[^}]*border-color:\s*var\(--color-border\);/s);
    expect(homeCss).toMatch(/\.application-shell\[data-theme="dark"\] \.home-recent-grid \.library-course-divider,[\s\S]*?\.library-course-progress\s*\{[^}]*background:\s*var\(--color-border\);/s);
    expect(homeCss).toMatch(/\.application-shell\[data-theme="dark"\] \.home-recent-grid \.library-course-progress-base\s*\{[^}]*fill:\s*var\(--color-border\);/s);
  });
});
