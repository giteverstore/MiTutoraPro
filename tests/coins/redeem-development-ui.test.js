import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const redeemSource = readFileSync(new URL('../../src/coins/RedeemPage.jsx', import.meta.url), 'utf8');
const controlsSource = readFileSync(new URL('../../src/coins/DevelopmentCoinControls.jsx', import.meta.url), 'utf8');
const themeStyles = readFileSync(new URL('../../src/styles/theme.css', import.meta.url), 'utf8');
const redeemStyles = readFileSync(new URL('../../src/styles/pages/home.css', import.meta.url), 'utf8');
const appShellStyles = readFileSync(new URL('../../src/styles/layout/app-shell.css', import.meta.url), 'utf8');

describe('Redeem development presentation boundary', () => {
  it('removes the redundant hero copy and keeps reward cards at the top', () => {
    expect(redeemSource).not.toContain('Turn learning into rewards');
    expect(redeemSource).not.toContain('Coins are non-cash learning rewards');
    expect(redeemSource).not.toContain('Redeem Rewards');
    expect(redeemSource.indexOf('redeem-catalog')).toBeLessThan(redeemSource.indexOf('CoinHistory'));
  });

  it('uses sticky responsive balance presentation', () => {
    expect(redeemSource).toContain("import '../styles/pages/home.css'");
    expect(redeemStyles).toMatch(/\.redeem-balance-position \{[^}]*position: sticky/);
    expect(redeemStyles).toMatch(/@media \(max-width: 800px\)[^{]*\{[^}]*\.redeem-balance-position/);
  });

  it('keeps the essential reward copy and removes redundant helper text', () => {
    expect(redeemSource).toContain('Brand Themes');
    expect(redeemSource).not.toContain('Personalize brand accents without changing semantic status colors.');
    expect(redeemSource).toContain('Unlock one Daily Challenge you previously missed.');
    expect(redeemSource).toContain('of 3 uses remaining this month');
    expect(redeemSource).not.toContain('Choose a missed challenge in Challenge History.');
    expect(redeemSource).toContain('Choose in Challenges');
  });

  it('uses fixed light borders and semantic dark borders on Redeem surfaces', () => {
    expect(redeemStyles).toMatch(/\.redeem-balance \{[^}]*border: 1px solid #d3dce6/s);
    expect(redeemStyles).toMatch(/\.theme-reward-grid article \{[^}]*border: 1px solid #d3dce6/s);
    expect(redeemStyles).toMatch(/\.redeem-catalog article \{[^}]*border: 1px solid #d3dce6/s);
    expect(redeemStyles).toMatch(/\.coin-history>div \{[^}]*border: 1px solid #d3dce6/s);
    expect(redeemStyles).toMatch(/\.coin-history article \{[^}]*border-bottom: 1px solid #d3dce6/s);
    expect(redeemStyles).toMatch(/\.redeem-page \.button--secondary \{[^}]*border-color: #d3dce6/s);
    expect(redeemStyles).toMatch(/\[data-theme="dark"\] \.redeem-page :is\([\s\S]*?\) \{[^}]*border-color: var\(--color-border\)/s);
    expect(redeemStyles).toMatch(/\[data-theme="dark"\] \.redeem-page \.coin-history article \{[^}]*border-bottom-color: var\(--color-border\)/s);
    expect(redeemStyles).toMatch(/\.theme-reward-grid article\.is-selected \{[^}]*border-color: var\(--color-accent\)/s);
  });

  it('keeps the pre-colored coin image intact while preserving semantic reward colors', () => {
    expect(themeStyles).toMatch(/:root \{[\s\S]*?--color-coin: #b7791f;/);
    expect(themeStyles).toMatch(/\[data-theme="dark"\] \{[\s\S]*?--color-coin: #facc15;/);
    expect(appShellStyles).toMatch(/\.coin-icon \{[^}]*object-fit: contain/);
    expect(appShellStyles).not.toMatch(/\.coin-icon \{[^}]*color:/);
    expect(redeemStyles).toMatch(/\.challenge-calendar-redeem button \{[^}]*color: var\(--color-success\)/);
  });

  it('compile-time gates controls and has no deployable API function', () => {
    expect(redeemSource).toContain('import.meta.env.DEV');
    expect(controlsSource).toContain('/api/dev/coins/set-balance');
    expect(existsSync(new URL('../../api/dev/coins/set-balance.js', import.meta.url))).toBe(false);
  });
});
