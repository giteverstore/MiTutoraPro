import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const courseCss = readFileSync('src/styles/pages/dashboard.css', 'utf8');
const projectCss = readFileSync('src/styles/pages/projects.css', 'utf8');

describe('Course and Project overview neutral borders', () => {
  it('uses the light neutral border across Course Overview surfaces', () => {
    for (const selector of [
      '.overview-hero-summary',
      '.overview-stat-card',
      '.overview-detail-card',
      '.overview-module',
    ]) {
      expect(courseCss).toMatch(new RegExp(`${selector.replace('.', '\\\.')} \\{[^}]*border: 1px solid #d3dce6;`, 's'));
    }
    expect(courseCss).toMatch(/\.overview-hero-metrics>div\+div \{[^}]*border-left: 1px solid #d3dce6;/s);
    expect(courseCss).toMatch(/\.overview-curriculum-section\+\.overview-curriculum-section \{[^}]*border-top: 1px solid #d3dce6;/s);
    expect(courseCss).toMatch(/\[data-theme="dark"\] \.overview-hero-summary,[\s\S]*?border-color: var\(--color-border\);/s);
  });

  it('uses the light neutral border across Project Overview surfaces', () => {
    expect(projectCss).toMatch(/\.project-overview-summary \{[^}]*border: 1px solid #d3dce6;/s);
    expect(projectCss).toMatch(/\.project-overview-metrics > div \+ div \{[^}]*border-left: 1px solid #d3dce6;/s);
    expect(projectCss).toMatch(/\.project-details-grid>\* \{[^}]*border: 1px solid #d3dce6;/s);
    expect(projectCss).toMatch(/\.project-language-badges span \{[^}]*border: 1px solid #d3dce6;/s);
    expect(projectCss).toMatch(/\.project-roadmap li > span \{[^}]*border: 1px solid #d3dce6;/s);
    expect(projectCss).toMatch(/\[data-theme="dark"\] \.project-language-badges span,[\s\S]*?border-color: var\(--color-border\);/s);
    expect(projectCss).toMatch(/\[data-theme="dark"\] \.project-roadmap li:not\(\.is-current\):not\(\.is-complete\)>span \{[^}]*border-color: var\(--color-border\);/s);
  });

  it('preserves active and semantic accent treatments', () => {
    expect(projectCss).toMatch(/\.project-roadmap li\.is-current > span,[\s\S]*?border-color: var\(--color-accent\);/s);
    expect(courseCss).toMatch(/\.overview-certification-badge \{[^}]*border: 1px solid rgb\(255 255 255 \/ 42%\);/s);
    expect(projectCss).toMatch(/\.project-overview-progress \[role="progressbar"\] > span \{[^}]*background: var\(--color-accent\);/s);
  });
});
