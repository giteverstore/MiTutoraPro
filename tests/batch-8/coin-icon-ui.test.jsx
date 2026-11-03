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
  it('uses the shared golden coin asset for referral rewards', () => {
    render(<ReferralOverview profile={{ totalReferred: 0, qualified: 0, calculatedRewardsMinor: 0 }} />);
    const reward = screen.getByText('Calculated rewards').closest('article');
    expect(reward).toHaveTextContent('₹0.00');
    expect(reward.querySelector('img.coin-icon')).toHaveClass('coin-icon', 'referral-coin-icon');
    expect(reward.querySelector('img.coin-icon')).toHaveAttribute('src', expect.stringContaining('golden_coin_4k_transparent.png'));
  });

  it('uses the shared asset without changing the Daily Challenge balance contract', () => {
    render(<CoinBalanceBadge />);
    const balance = screen.getByLabelText('0 coins');
    expect(balance).toHaveTextContent('0coins');
    expect(balance.querySelector('img.coin-icon')).toHaveAttribute('src', expect.stringContaining('golden_coin_4k_transparent.png'));
  });

  it('keeps the shared icon implementation and all active gold token consumers', () => {
    const icon = render(<CoinIcon className="context-icon" size={18} />).container.querySelector('img');
    expect(icon).toHaveClass('coin-icon', 'context-icon');
    expect(icon).toHaveAttribute('src', expect.stringContaining('golden_coin_4k_transparent.png'));
    expect(icon).toHaveAttribute('alt', '');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveAttribute('width', '18');
    expect(icon).toHaveAttribute('height', '18');
    expect(icon.closest('div').querySelector('svg')).not.toBeInTheDocument();

    const home = readFileSync('src/styles/pages/home.css', 'utf8');
    const shell = readFileSync('src/styles/layout/app-shell.css', 'utf8');
    const challenges = readFileSync('src/styles/pages/challenges.css', 'utf8');
    const referrals = readFileSync('src/styles/pages/referrals.css', 'utf8');
    const challengePage = readFileSync('src/challenges/ChallengesPage.jsx', 'utf8');
    const redeem = readFileSync('src/coins/RedeemPage.jsx', 'utf8');
    expect(shell).toMatch(/\.coin-icon\s*\{[^}]*object-fit:\s*contain/s);
    expect(shell).not.toMatch(/\.coin-icon\s*\{[^}]*color:/s);
    expect(home).toMatch(/\.redeem-balance>\.coin-icon\s*\{[^}]*width:\s*1\.5rem;[^}]*height:\s*1\.5rem;/s);
    expect(shell).toMatch(/\.coin-balance-badge \.coin-icon\s*\{[^}]*width:\s*var\(--icon-sm\)/s);
    expect(referrals).toMatch(/\.referral-overview article>\.coin-icon\s*\{[^}]*width:\s*1\.5rem;[^}]*height:\s*1\.5rem;/s);
    expect(redeem).toContain('<CoinIcon />');
    expect(redeem).toContain("state.status === 'ready' ? state.balance");
    expect(challengePage.match(/<CoinIcon \/>/g)).toHaveLength(1);
    expect(challengePage).not.toMatch(/\bCoins\b/);
    expect(challengePage).not.toContain('+{todayEntry.metadata.rewardCoins} coins');
    expect(challengePage).not.toContain('+{todayEntry.metadata.rewardCoins} coins earned');
    expect(challengePage).toContain('+{celebration?.rewardAmount ?? 0}');
    expect(challenges).toMatch(/\.challenge-history\s*\{[^}]*border-color:\s*#d3dce6;/s);
    expect(challenges).toMatch(/\.challenge-history>header\s*\{[^}]*border-bottom-color:\s*#d3dce6;/s);
    expect(challenges).toMatch(/\.challenge-history-list article\s*\{[^}]*border-bottom-color:\s*#d3dce6;/s);
    expect(challenges).toMatch(/\[data-theme="dark"\] \.challenge-history\s*\{[^}]*border-color:\s*var\(--color-border\);/s);
  });
});
