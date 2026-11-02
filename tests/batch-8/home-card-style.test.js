import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const homeCss = readFileSync('src/styles/pages/home.css', 'utf8');

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return homeCss.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`, 's'))?.[1] ?? '';
}

describe('Home card outer treatment', () => {
  it.each([
    '.home-stat-card',
    '.home-continue-card',
    '.challenge-calendar-card',
  ])('uses the shared light card border and low-elevation shadow for %s', (selector) => {
    expect(rule(selector)).toMatch(/border:\s*1px solid #d3dce6;/);
    expect(rule(selector)).toMatch(/box-shadow:\s*var\(--shadow-xs\);/);
  });

  it('keeps a theme-aware dark border and shadow scoped to the target cards', () => {
    expect(homeCss).toMatch(/\.application-shell\[data-theme="dark"\] :is\(\.home-stat-card, \.home-continue-card, \.challenge-calendar-card\)\s*\{[^}]*border-color:\s*var\(--color-border\);[^}]*box-shadow:\s*var\(--shadow-xs\);/s);
  });

  it('does not change Continue Learning button styling through the card treatment', () => {
    expect(rule('.home-dashboard-grid .home-continue-card>.button')).toMatch(/grid-column:\s*1 \/ -1;/);
    expect(rule('.home-dashboard-grid .home-continue-card>.button')).toMatch(/width:\s*100%;/);
    expect(rule('.home-dashboard-grid .home-continue-card>.button')).not.toMatch(/border|box-shadow/);
  });
});
