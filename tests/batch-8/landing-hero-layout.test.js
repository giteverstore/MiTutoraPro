import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/pages/landing.css', 'utf8');

describe('Landing hero layout contract', () => {
  it('keeps the build hero in two bounded desktop grid tracks', () => {
    expect(css).toMatch(/@media \(min-width: 1200px\)[\s\S]*?\.landing-building\s*\{[^}]*width:\s*100%;[^}]*grid-template-columns:\s*minmax\(22rem, 1fr\) minmax\(26rem, 38rem\);[^}]*gap:\s*clamp\(2rem, 3\.5vw, 4rem\);/s);
    expect(css).toMatch(/\.landing-building-copy,[\s\S]*?\.landing-feature-panel\s*\{[^}]*min-width:\s*0;/s);
    expect(css).toMatch(/\.landing-building h2\s*\{[^}]*white-space:\s*normal;/s);
    expect(css).toMatch(/\.landing-feature-tabs\s*\{[^}]*flex-wrap:\s*wrap;/s);
    expect(css).not.toMatch(/\.landing-feature-panel\s*\{[^}]*position:\s*absolute;/s);
  });

  it('stacks both split sections before their columns can overlap', () => {
    expect(css).toMatch(/@media \(max-width: 1199px\)[\s\S]*?\.landing-building,[\s\S]*?\.landing-projects\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s);
    expect(css).toMatch(/\.landing-feature-panel,[\s\S]*?\.landing-project-illustration\s*\{[^}]*width:\s*min\(100%, 44rem\);[^}]*justify-self:\s*center;/s);
  });

  it('uses more of the project column without cropping its artwork', () => {
    expect(css).toMatch(/\.landing-projects\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1\.15fr\) minmax\(22rem, \.85fr\);/s);
    expect(css).toMatch(/\.landing-project-illustration\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*48rem;[^}]*justify-self:\s*center;/s);
    expect(css).toMatch(/\.landing-project-illustration img\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*48rem;[^}]*max-height:\s*36rem;[^}]*aspect-ratio:\s*auto;[^}]*object-fit:\s*contain;/s);
  });
});
