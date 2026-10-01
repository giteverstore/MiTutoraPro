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

  it('keeps coin color theme-owned and consumed by coin presentation', () => {
    expect(themeStyles).toMatch(/:root \{[\s\S]*?--color-coin: #b7791f;/);
    expect(themeStyles).toMatch(/\[data-theme="dark"\] \{[\s\S]*?--color-coin: #facc15;/);
    expect(redeemStyles).toMatch(/\.redeem-balance>svg \{[^}]*color: var\(--color-coin\)/);
    expect(appShellStyles).toMatch(/\.coin-balance-badge svg \{[^}]*color: var\(--color-coin\)/);
    expect(redeemStyles).toMatch(/\.challenge-calendar-redeem button \{[^}]*color: var\(--color-success\)/);
  });

  it('compile-time gates controls and has no deployable API function', () => {
    expect(redeemSource).toContain('import.meta.env.DEV');
    expect(controlsSource).toContain('/api/dev/coins/set-balance');
    expect(existsSync(new URL('../../api/dev/coins/set-balance.js', import.meta.url))).toBe(false);
  });
});
