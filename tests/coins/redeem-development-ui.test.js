import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const redeemSource = readFileSync(new URL('../../src/coins/RedeemPage.jsx', import.meta.url), 'utf8');
const controlsSource = readFileSync(new URL('../../src/coins/DevelopmentCoinControls.jsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8');

describe('Redeem development presentation boundary', () => {
  it('removes the redundant hero copy and keeps reward cards at the top', () => {
    expect(redeemSource).not.toContain('Turn learning into rewards');
    expect(redeemSource).not.toContain('Coins are non-cash learning rewards');
    expect(redeemSource).not.toContain('Redeem Rewards');
    expect(redeemSource.indexOf('redeem-catalog')).toBeLessThan(redeemSource.indexOf('CoinHistory'));
  });

  it('uses sticky responsive balance presentation', () => {
    expect(styles).toMatch(/\.redeem-balance-position \{[^}]*position: sticky/);
    expect(styles).toMatch(/@media \(max-width: 800px\)[^{]*\{[^}]*\.redeem-balance-position/);
  });

  it('compile-time gates controls and has no deployable API function', () => {
    expect(redeemSource).toContain('import.meta.env.DEV');
    expect(controlsSource).toContain('/api/dev/coins/set-balance');
    expect(existsSync(new URL('../../api/dev/coins/set-balance.js', import.meta.url))).toBe(false);
  });
});
