import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path) => readFileSync(path, 'utf8');

describe('shared learner workspace style ownership', () => {
  it('loads the canonical compiler and AI styles before Practice overrides', () => {
    const route = source('src/pages/PracticePage.jsx');
    expect(route.indexOf("import '../styles/pages/learning-engine.css'"))
      .toBeLessThan(route.indexOf("import '../styles/pages/practice.css'"));
    const shared = source('src/styles/pages/learning-engine.css');
    for (const selector of ['.learning-workspace-tabs', '.compiler-panel', '.terminal-tabs', '.ai-workspace']) {
      expect(shared).toContain(selector);
    }
  });

  it('loads the same compiler shell plus Practice layout for Challenges, with no AI tab', () => {
    const route = source('src/pages/ChallengesPage.jsx');
    expect(route.indexOf("import '../styles/pages/learning-engine.css'"))
      .toBeLessThan(route.indexOf("import '../styles/pages/practice.css'"));
    expect(route.indexOf("import '../styles/pages/practice.css'"))
      .toBeLessThan(route.indexOf("import '../styles/pages/challenges.css'"));
    const challenge = source('src/challenges/ChallengesPage.jsx');
    expect(challenge).toContain('aiEnabled={false}');
    expect(challenge).toContain('aiEnabled: false');
  });

  it('keeps the shared viewport-bounded editor and internally scrollable Practice content', () => {
    const css = source('src/styles/pages/practice.css');
    expect(css).toMatch(/\.practice-immersive-shell\s*\{[^}]*height:\s*calc\(100dvh - var\(--layout-topbar-height\)\);/);
    expect(css).toMatch(/\.practice-immersive-workspace \.practice-problem\s*\{[^}]*overflow-y:\s*auto;/);
    expect(css).toMatch(/\.coding-workspace__compiler\s*\{[^}]*min-height:\s*0;/);
  });

  it('keeps the Projects illustration fluid and centered beside its copy', () => {
    const css = source('src/styles/pages/landing.css');
    expect(css).toMatch(/\.landing-project-illustration\{display:grid;width:100%;min-width:0;place-items:center\}/);
    expect(css).toMatch(/\.landing-project-illustration img\{[^}]*height:auto;[^}]*object-fit:contain\}/);
    expect(css).toMatch(/@media\(max-width:1000px\)\{\.landing-projects\{grid-template-columns:1fr\}/);
  });

  it('keeps selected learner navigation highlighted without a left stripe', () => {
    const shared = source('src/design-system/coherence.css');
    for (const selector of ['.application-navigation button.is-active', '.lesson-link.is-active']) {
      const rule = shared.match(new RegExp(`${selector.replaceAll('.', '\\.')}\\s*\\{([^}]*)\\}`));
      if (rule) expect(rule[1]).not.toMatch(/box-shadow|border-left/);
    }
    expect(shared).toMatch(/\.application-navigation button\.is-active\s*\{[^}]*background:/);
    for (const [path, selector] of [
      ['src/styles/pages/learning-engine.css', '.lesson-link.is-active'],
      ['src/styles/pages/practice.css', '.practice-question-card.is-active'],
      ['src/styles/pages/projects.css', '.project-activity-bar button.is-active'],
      ['src/styles/pages/projects.css', '.project-task-list button.is-active'],
    ]) {
      const rule = source(path).match(new RegExp(`${selector.replaceAll('.', '\\.')}\\s*\\{([^}]*)\\}`));
      expect(rule?.[1]).toMatch(/background:/);
      expect(rule?.[1]).not.toMatch(/box-shadow|border-left/);
    }
  });

  it('keeps avatar hover subtle and keyboard focus visible', () => {
    const css = source('src/styles/layout/app-shell.css');
    expect(css).toMatch(/\.application-profile-button:hover\s*\{[^}]*background:\s*var\(--color-accent-soft\);[^}]*\}/);
    expect(css).toMatch(/\.application-profile-button:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--color-accent\)/);
    expect(css.match(/\.application-profile-button:hover\s*\{([^}]*)\}/)?.[1]).not.toMatch(/border-color/);
  });
});
