import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getReferralProfile = vi.fn();
vi.mock('../../src/auth/UserContext', () => ({ useUser: () => ({ user: { id: 'owner-1' } }) }));
vi.mock('../../src/referrals/ReferralService', () => ({ referralService: { getReferralProfile } }));

const { ReferralsPage } = await import('../../src/referrals/ReferralsPage');

const profile = {
  referralCode: 'MITABC234',
  referralLink: 'https://ycoders.com/?ref=MITABC234',
  totalReferred: 2,
  attributed: 1,
  qualified: 1,
  calculatedRewardsMinor: 4990,
  history: [
    { id: 'referral-12345678', status: 'QUALIFIED', attributedAt: '2026-09-10T00:00:00Z', calculatedRewardMinor: 4990 },
    { id: '8e46b11c-extra', status: 'ATTRIBUTED', attributedAt: '2026-09-10T00:00:00Z', calculatedRewardMinor: null },
  ],
};

beforeEach(() => {
  getReferralProfile.mockResolvedValue(profile);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Referral page cleanup', () => {
  it('starts directly with referral functionality and keeps only three summary metrics', async () => {
    render(<ReferralsPage />);
    expect(await screen.findByText(profile.referralLink)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Referral' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Your referral code and link' })).not.toBeInTheDocument();
    expect(screen.queryByText('Copy your code or share your personal referral link.')).not.toBeInTheDocument();
    expect(screen.queryByText('Learning is better together.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Invite friends and earn a calculated referral reward/)).not.toBeInTheDocument();
    expect(screen.queryByText('Spread the word')).not.toBeInTheDocument();
    expect(screen.queryByText('How it works')).not.toBeInTheDocument();
    expect(screen.getAllByText(profile.referralCode)).toHaveLength(1);
    expect(screen.queryAllByText('Referral Code')).toHaveLength(1);
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getByText('Referred').closest('article').querySelector('img')).toHaveAttribute('src', '/assets/ui-icons/group.png');
    expect(screen.getByText('Qualified', { selector: '.referral-overview small' }).closest('article').querySelector('img')).toHaveAttribute('src', '/assets/ui-icons/quality.png');
    expect(screen.getByText('Calculated rewards').closest('article').querySelector('img.coin-icon')).toHaveAttribute('src', expect.stringContaining('golden_coin_4k_transparent.png'));
    expect(screen.getByText('Referral History')).toBeInTheDocument();
    expect(screen.getByText('Referral 8e46b11c')).toBeInTheDocument();
    expect(screen.getByText('Attributed', { selector: '.referral-status' })).toBeInTheDocument();
    expect(screen.getByText('Not calculated')).toBeInTheDocument();
    expect(screen.getAllByText('₹49.90')).not.toHaveLength(0);
  });

  it('preserves both Copy actions and removes the Share action', async () => {
    render(<ReferralsPage />);
    await screen.findByText(profile.referralLink);
    fireEvent.click(screen.getByRole('button', { name: 'Copy Code' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(profile.referralCode));
    fireEvent.click(screen.getByRole('button', { name: 'Copy Link' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(profile.referralLink));
    expect(screen.queryByRole('button', { name: 'Share Invitation' })).not.toBeInTheDocument();
  });

  it('moves the complete frozen referral policy into the FAQ', async () => {
    render(<ReferralsPage />);
    await screen.findByText('Frequently Asked Questions');
    const answers = [
      /must use it before making their first qualifying Premium purchase/i,
      /Free users earn a 10% referral reward and Premium users earn 15%/i,
      /first verified qualifying Premium purchase/i,
      /not applied retroactively/i,
      /7-day cooling period/i,
      /Refunds, reversals, or disputes/i,
      /Self-referrals are not allowed/i,
    ];
    answers.forEach((answer) => expect(screen.getByText(answer)).toBeInTheDocument());
    expect(screen.queryByText('Need to know', { exact: true })).not.toBeInTheDocument();
    const firstQuestion = screen.getByText('How do referrals work?').closest('details');
    expect(firstQuestion).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('How do referrals work?'));
    expect(firstQuestion).toHaveAttribute('open');
  });

  it('uses the reviewed neutral card, field, history, and FAQ presentation', () => {
    const css = readFileSync('src/styles/pages/referrals.css', 'utf8');
    expect(css).toMatch(/\.referral-overview article\s*\{[^}]*background:\s*#fff;[^}]*border:\s*1px solid #d3dce6;/s);
    expect(css).toMatch(/\.invite-friends,[\s\S]*?\.referral-faq\s*\{[^}]*border:\s*1px solid #d3dce6;/s);
    expect(css).toMatch(/\.referral-fields>div\s*\{[^}]*background:\s*#fff;[^}]*border:\s*1px solid #d3dce6;/s);
    expect(css).toMatch(/\.referral-history-table article\s*\{[^}]*color:\s*var\(--color-text\);[^}]*border-top:\s*1px solid #d3dce6;/s);
    expect(css).toMatch(/\.referral-status,[\s\S]*?\.referral-reward-status\s*\{[^}]*color:\s*var\(--color-text\);/s);
    expect(css).not.toMatch(/\.referral-status,[\s\S]*?\.referral-reward-status\s*\{[^}]*(?:background|border-radius|padding):/s);
    expect(css).toMatch(/\.referral-faq details\s*\{[^}]*border:\s*1px solid #d3dce6;/s);
    expect(css).toMatch(/\[data-theme="dark"\] \.referral-overview article,[\s\S]*?background:\s*var\(--color-surface\);[^}]*border-color:\s*var\(--color-border\);/s);
  });
});
