import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  history: [{ id: 'referral-12345678', status: 'QUALIFIED', attributedAt: '2026-09-10T00:00:00Z', calculatedRewardMinor: 4990 }],
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
    expect(screen.getByText('Referral History')).toBeInTheDocument();
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
  });
});
