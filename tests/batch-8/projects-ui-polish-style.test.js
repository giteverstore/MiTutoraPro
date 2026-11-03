import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/pages/projects.css', 'utf8');
const selectCss = readFileSync('src/styles/components/learner-select.css', 'utf8');
const page = readFileSync('src/projects/pages/ProjectsPage.jsx', 'utf8');

describe('Projects list UI polish', () => {
  it('uses the requested resting filter treatment without changing the focused border', () => {
    expect(css).toMatch(/\.project-filters\s*\{[^}]*border:\s*1px solid #d3dce6;/s);
    expect(css).toMatch(/\.project-filters \.learner-select\s*\{[^}]*--learner-select-height:\s*2\.875rem;/s);
    expect(selectCss).toMatch(/\.learner-select > button\s*\{[^}]*background:\s*#fff;[^}]*border:\s*1px solid #d3dce6;/s);
    expect(selectCss).toMatch(/\.learner-select > button:focus-visible\s*\{[^}]*border-color:\s*#d3dce6;[^}]*outline:\s*3px solid var\(--color-focus\);/s);
  });

  it('applies the requested Project-card border and scoped progress treatment', () => {
    expect(css).toMatch(/\.project-card\s*\{[^}]*border:\s*1px solid #d3dce6;/s);
    expect(css).toMatch(/\.project-card-divider\s*\{[^}]*background:\s*#d3dce6;/s);
    expect(css).toMatch(/\.project-card \.library-course-progress\s*\{[^}]*background:\s*#d3dce6;/s);
    expect(css).toMatch(/\.project-card \.library-course-progress-base\s*\{[^}]*fill:\s*#d3dce6;/s);
    expect(css).toMatch(/\.project-card \.library-course-progress-border\s*\{[^}]*display:\s*none;/s);
    expect(readFileSync('src/styles/components/progress-circle.css', 'utf8')).not.toContain('#d3dce6');
  });

  it('uses dark theme equivalents and does not render the catalog count', () => {
    expect(css).toMatch(/\[data-theme="dark"\] \.project-filters,[\s\S]*?border-color:\s*var\(--color-border\);/s);
    expect(css).toMatch(/\[data-theme="dark"\] \.project-card:hover:not\(\.is-coming-soon\),[\s\S]*?border-color:\s*var\(--color-accent\);/s);
    expect(selectCss).toMatch(/\[data-theme="dark"\] \.learner-select > button,[\s\S]*?background:\s*var\(--color-surface\);[^}]*border-color:\s*var\(--color-border\);/s);
    expect(page).not.toMatch(/visible\.length === 1 \? 'project' : 'projects'/);
  });
});
