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
});
