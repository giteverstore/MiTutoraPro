import { cleanup, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CoinIcon } from '../../src/coins/CoinIcon';
import { ReferralOverview } from '../../src/referrals/ReferralOverview';

vi.mock('../../src/auth/AuthService', () => ({ authService: { getCurrentUser: () => null } }));
vi.mock('../../src/repositories/firestore/CoinAccountRepository', () => ({
  CoinAccountRepository: class CoinAccountRepository {},
}));

const { CoinBalanceBadge } = await import('../../src/coins/CoinBalanceBadge');

afterEach(cleanup);

describe('Canonical coin icon presentation', () => {
  it('uses the shared Lucide coin glyph for referral rewards', () => {
    render(<ReferralOverview profile={{ totalReferred: 0, qualified: 0, calculatedRewardsMinor: 0 }} />);
    const reward = screen.getByText('Calculated rewards').closest('article');
    expect(reward).toHaveTextContent('₹0.00');
    expect(reward.querySelector('svg')).toHaveClass('lucide-coins', 'coin-icon', 'referral-coin-icon');
  });

  it('uses the shared glyph without changing the Daily Challenge balance contract', () => {
    render(<CoinBalanceBadge />);
    const balance = screen.getByLabelText('0 coins');
    expect(balance).toHaveTextContent('0coins');
    expect(balance.querySelector('svg')).toHaveClass('lucide-coins', 'coin-icon');
  });

  it('keeps the shared icon implementation and all active gold token consumers', () => {
    const icon = render(<CoinIcon className="context-icon" />).container.querySelector('svg');
    expect(icon).toHaveClass('lucide-coins', 'coin-icon', 'context-icon');

    const home = readFileSync('src/styles/pages/home.css', 'utf8');
    const shell = readFileSync('src/styles/layout/app-shell.css', 'utf8');
    const challenges = readFileSync('src/styles/pages/challenges.css', 'utf8');
    const challengePage = readFileSync('src/challenges/ChallengesPage.jsx', 'utf8');
    const redeem = readFileSync('src/coins/RedeemPage.jsx', 'utf8');
    expect(shell).toMatch(/\.coin-icon\s*\{[^}]*color:\s*var\(--color-coin\)/s);
    expect(home).toMatch(/\.redeem-balance>svg\s*\{[^}]*width:\s*1\.5rem;[^}]*height:\s*1\.5rem;/s);
    expect(shell).toMatch(/\.coin-balance-badge svg\s*\{[^}]*width:\s*var\(--icon-sm\)/s);
    expect(redeem).toContain('<CoinIcon />');
    expect(redeem).toContain("state.status === 'ready' ? state.balance");
    expect(challenges).toMatch(/\.challenge-today-meta \.coin-icon\s*\{[^}]*color:\s*var\(--color-coin\)/s);
    expect(challengePage.match(/<CoinIcon \/>/g)).toHaveLength(3);
    expect(challengePage).not.toMatch(/\bCoins\b/);
    expect(challengePage).toContain('+{todayEntry.metadata.rewardCoins} coins');
    expect(challengePage).toContain('+{todayEntry.metadata.rewardCoins} coins earned');
    expect(challengePage).toContain('+{celebration?.rewardAmount ?? 0}');
  });
});
